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

const FALLBACK_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-exp:free'
];

app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

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

// Extrator resiliente de JSON com suporte a blocos markdown parciais
function extractProjectFiles(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('A resposta da IA está vazia.');
  }

  let cleaned = rawText.trim();

  // 1. Tentar localizar bloco ```json ... ```
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
      // Avança para extração por blocos se o JSON estiver incompleto
    }
  }

  // 3. Fallback: extrair múltiplos blocos de código
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
      description: 'Gerado a partir do código estruturado da IA',
      summary: 'Arquivos de código criados com sucesso.',
      files: files
    };
  }

  throw new Error('Não foi possível estruturar os arquivos gerados. Por favor, tente novamente com uma instrução mais direta.');
}

const SYSTEM_PROMPT = `Você é o CodeForge AI, um ambiente profissional de desenvolvimento.
Sua resposta DEVE ser ESTRITAMENTE um objeto JSON válido, sem texto introdutório e sem explicações fora do JSON.
Não utilize emojis em nenhuma parte do código ou textos.
Gere código web funcional, moderno, sem dependências externas complexas.

ESTRUTURA DO JSON:
{
  "projectName": "Nome do Projeto",
  "description": "Descrição sucinta",
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
      "content": "// código javascript"
    }
  ]
}`;

// Endpoint com Streaming SSE (Server-Sent Events)
app.post('/api/generate', async (req, res) => {
  const { prompt, conversationHistory = [], currentFiles = [] } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'A instrução não pode estar vazia.' });
  }

  const activeApiKey = OPENROUTER_API_KEY.trim();
  if (!activeApiKey) {
    return res.status(500).json({
      error: 'A chave OPENROUTER_API_KEY não foi configurada nas variáveis de ambiente do Render.'
    });
  }

  // Ativa Server-Sent Events imediatamente para evitar timeout de inatividade no Render
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (event, payload) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  sendEvent('status', { message: 'A conectar à OpenRouter (Nemotron 3 Ultra)...' });

  const controller = new AbortController();
  req.on('close', () => controller.abort());

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
      contextualPrompt += '\n\n--- CÓDIGO ATUAL DOS ARQUIVOS ---\n';
      for (const f of currentFiles) {
        contextualPrompt += `\n[${f.name}]\n${f.content}\n`;
      }
      contextualPrompt += '\n--- FIM DOS ARQUIVOS ---\nAtualize preservando o código estável e retorne todos os arquivos completos no JSON.';
    }

    messages.push({ role: 'user', content: contextualPrompt });

    const siteUrl = `${req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http'}://${req.get('host') || 'render.com'}`;

    const openRouterResponse = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${activeApiKey}`,
        'HTTP-Referer': siteUrl,
        'X-Title': 'CodeForge AI on Render',
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
              if (now - lastProgressUpdate > 300) {
                lastProgressUpdate = now;
                sendEvent('progress', { charCount: fullAccumulatedText.length });
              }
            }
          } catch {
            // Ignora fragmentos temporários de JSON
          }
        }
      }
    }

    sendEvent('status', { message: 'A compilar arquivos e preparar o preview...' });

    const project = extractProjectFiles(fullAccumulatedText);
    sendEvent('complete', { project });
    res.end();

  } catch (err) {
    console.error('[Streaming Error]', err);
    if (!res.writableEnded) {
      sendEvent('error', { error: err.message || 'Erro durante o streaming do código.' });
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