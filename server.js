import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const PRIMARY_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

// Fallback nativo na OpenRouter para redundância em caso de fila no Nemotron
const FALLBACK_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-exp:free'
];

app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(express.static(__dirname));

// Health check para o Render
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'healthy', uptime: Math.floor(process.uptime()) });
});

app.get('/api/status', (req, res) => {
  const hasKey = Boolean(OPENROUTER_API_KEY && OPENROUTER_API_KEY.trim().length > 0);
  res.json({
    status: 'online',
    model: PRIMARY_MODEL,
    hasApiKey: hasKey
  });
});

// Extrator resiliente de arquivos do projeto gerado pela IA
function extractProjectFiles(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('A resposta da IA está vazia.');
  }

  let cleaned = rawText.trim();

  // 1. Tentar bloco ```json ... ```
  const jsonBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonBlock && jsonBlock[1]) {
    cleaned = jsonBlock[1].trim();
  }

  // 2. Extrair objeto JSON balanceado
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = cleaned.substring(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed.files && Array.isArray(parsed.files) && parsed.files.length > 0) {
        return parsed;
      }
    } catch {
      // Avança para parsing por blocos
    }
  }

  // 3. Fallback inteligente para blocos de código individuais
  const files = [];
  const codeRegex = /```(html|css|javascript|js|json)?\s*(?:<!--\s*([a-zA-Z0-9._-]+)\s*-->|\/\*\s*([a-zA-Z0-9._-]+)\s*\*\/)?\s*([\s\S]*?)```/gi;
  let match;

  while ((match = codeRegex.exec(rawText)) !== null) {
    const lang = (match[1] || 'plaintext').toLowerCase();
    const explicitName = match[2] || match[3];
    const content = match[4].trim();

    let fileName = explicitName;
    if (!fileName) {
      if (lang === 'html' && !files.some(f => f.name === 'index.html')) fileName = 'index.html';
      else if (lang === 'css' && !files.some(f => f.name === 'style.css')) fileName = 'style.css';
      else if ((lang === 'javascript' || lang === 'js') && !files.some(f => f.name === 'script.js')) fileName = 'script.js';
      else fileName = `arquivo_${files.length + 1}.${lang === 'javascript' ? 'js' : lang}`;
    }

    files.push({
      name: fileName,
      language: lang === 'js' ? 'javascript' : lang,
      content: content
    });
  }

  if (files.length > 0) {
    return {
      projectName: 'Aplicação Web',
      description: 'Gerado por CodeForge AI',
      summary: 'Arquivos de código criados com sucesso.',
      files: files
    };
  }

  throw new Error('Não foi possível estruturar os arquivos. Por favor, reenvie a instrução.');
}

const SYSTEM_PROMPT = `Você é o CodeForge AI, um assistente avançado de engenharia de software para geração de código funcional.
Sua resposta DEVE ser EXCLUSIVAMENTE um objeto JSON válido, sem texto introdutório antes ou depois.
Não utilize emojis em nenhuma parte do código ou das mensagens.
Gere código web moderno, completo, limpo e pronto para execução no navegador.

ESTRUTURA OBRIGATÓRIA DO JSON:
{
  "projectName": "Nome do Projeto",
  "description": "Breve descrição",
  "summary": "Resumo das funcionalidades criadas",
  "files": [
    {
      "name": "index.html",
      "language": "html",
      "content": "<!DOCTYPE html>..."
    },
    {
      "name": "style.css",
      "language": "css",
      "content": "/* estilos */"
    },
    {
      "name": "script.js",
      "language": "javascript",
      "content": "// lógica"
    }
  ]
}`;

// Endpoint com Streaming SSE e Proteção contra AbortError
app.post('/api/generate', async (req, res) => {
  const { prompt, conversationHistory = [], currentFiles = [] } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'A instrução não pode estar vazia.' });
  }

  const activeApiKey = OPENROUTER_API_KEY.trim();
  if (!activeApiKey) {
    return res.status(500).json({
      error: 'A chave OPENROUTER_API_KEY não está configurada no painel Environment do Render.'
    });
  }

  // Cabeçalhos essenciais para desativar buffer no proxy do Render / Cloudflare
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const sendEvent = (event, payload) => {
    if (!res.writableEnded) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    }
  };

  // Heartbeat periódico para manter o socket do Render vivo enquanto o modelo processa
  const heartbeatInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(':\n\n'); // Comentário SSE oficial de keep-alive
    }
  }, 10000);

  sendEvent('status', { message: 'A contactar a OpenRouter (Nemotron 3 Ultra)...' });

  // Controlador de Timeout interno de 180s (tempo amplo para o Nemotron 550B gerar todo o código)
  const controller = new AbortController();
  const apiTimeout = setTimeout(() => controller.abort(), 180000);

  // IMPORTANTE: Escutar apenas 'close' na RESPOSTA (res), garantindo que só aborta se o utilizador fechar a página
  res.on('close', () => {
    clearTimeout(apiTimeout);
    clearInterval(heartbeatInterval);
    if (!res.writableEnded) {
      controller.abort();
    }
  });

  try {
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      for (const msg of conversationHistory) {
        if (msg.role && msg.content) {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: typeof msg.content === 'object' ? JSON.stringify(msg.content) : String(msg.content)
          });
        }
      }
    }

    let contextualPrompt = prompt.trim();
    if (Array.isArray(currentFiles) && currentFiles.length > 0) {
      contextualPrompt += '\n\n--- CÓDIGO ATUAL DO PROJETO ---\n';
      for (const f of currentFiles) {
        contextualPrompt += `\n[${f.name}]\n${f.content}\n`;
      }
      contextualPrompt += '\n--- FIM DO CÓDIGO ATUAL ---\nAtualize preservando estabilidade e retorne todos os arquivos completos no JSON.';
    }

    messages.push({ role: 'user', content: contextualPrompt });

    const siteUrl = `${req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http'}://${req.get('host') || 'render.com'}`;

    const openRouterResponse = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${activeApiKey}`,
        'HTTP-Referer': siteUrl,
        'X-Title': 'CodeForge AI Platform',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: PRIMARY_MODEL,
        models: FALLBACK_MODELS,
        messages: messages,
        temperature: 0.2,
        max_tokens: 4096,
        stream: true
      }),
      signal: controller.signal
    });

    if (!openRouterResponse.ok) {
      const errText = await openRouterResponse.text();
      let errorMsg = `Erro na OpenRouter (${openRouterResponse.status})`;
      if (openRouterResponse.status === 401) errorMsg = 'Chave OPENROUTER_API_KEY inválida.';
      if (openRouterResponse.status === 429) errorMsg = 'Limite de taxa excedido na OpenRouter. Aguarde alguns instantes.';
      
      clearInterval(heartbeatInterval);
      clearTimeout(apiTimeout);
      sendEvent('error', { error: errorMsg, details: errText });
      return res.end();
    }

    sendEvent('status', { message: 'A sintetizar código e lógica dos componentes...' });

    let fullAccumulatedText = '';
    let lastProgressUpdate = 0;
    const reader = openRouterResponse.body.getReader();
    const decoder = new TextDecoder();
    let streamBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      streamBuffer += decoder.decode(value, { stream: true });
      const lines = streamBuffer.split('\n');
      streamBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullAccumulatedText += delta;
              const now = Date.now();
              if (now - lastProgressUpdate > 250) {
                lastProgressUpdate = now;
                sendEvent('progress', { charCount: fullAccumulatedText.length });
              }
            }
          } catch {
            // Fragmentos de streaming parciais são esperados
          }
        }
      }
    }

    clearInterval(heartbeatInterval);
    clearTimeout(apiTimeout);

    sendEvent('status', { message: 'A compilar arquivos e preparar o preview...' });

    const project = extractProjectFiles(fullAccumulatedText);
    sendEvent('complete', { project });
    res.end();

  } catch (err) {
    clearInterval(heartbeatInterval);
    clearTimeout(apiTimeout);

    console.error('[Streaming Error]', err);
    if (!res.writableEnded) {
      const msg = err.name === 'AbortError'
        ? 'A requisição demorou mais de 3 minutos e atingiu o tempo limite. Tente uma instrução mais concisa.'
        : (err.message || 'Erro durante o streaming do código.');
      sendEvent('error', { error: msg });
      res.end();
    }
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const server = app.listen(PORT, HOST, () => {
  console.log(`[CodeForge AI] Rodando em http://${HOST}:${PORT}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));