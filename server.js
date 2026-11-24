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

// Fallback nativo da OpenRouter para evitar filas e congelamentos
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

// Health check para Render
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'healthy', uptime: Math.floor(process.uptime()) });
});

// Verificação de status
app.get('/api/status', (req, res) => {
  const hasKey = Boolean(OPENROUTER_API_KEY && OPENROUTER_API_KEY.trim().length > 0);
  res.json({
    status: 'online',
    model: PRIMARY_MODEL,
    hasApiKey: hasKey
  });
});

// Extrator resiliente de JSON com fallback para blocos Markdown
function extractProjectFiles(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('A IA devolveu uma resposta vazia.');
  }

  let cleaned = rawText.trim();

  // 1. Tentar extração via bloco de código ```json ... ```
  const jsonBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonBlock && jsonBlock[1]) {
    cleaned = jsonBlock[1].trim();
  }

  // 2. Tentar parsing JSON direto
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidateJson = cleaned.substring(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(candidateJson);
      if (parsed.files && Array.isArray(parsed.files) && parsed.files.length > 0) {
        return parsed;
      }
    } catch (e) {
      // Continua para o extrator secundário caso o JSON esteja malformado
    }
  }

  // 3. Fallback inteligente: Extrair arquivos por blocos de código markdown se o JSON falhar
  const files = [];
  const codeBlockRegex = /```(html|css|javascript|js|json)?\s*(?:<!--\s*([a-zA-Z0-9._-]+)\s*-->|\/\*\s*([a-zA-Z0-9._-]+)\s*\*\/)?\s*([\s\S]*?)```/gi;
  let match;

  while ((match = codeBlockRegex.exec(rawText)) !== null) {
    const lang = (match[1] || 'plaintext').toLowerCase();
    const explicitName = match[2] || match[3];
    let content = match[4].trim();

    let fileName = explicitName;
    if (!fileName) {
      if (lang === 'html' && !files.some(f => f.name === 'index.html')) fileName = 'index.html';
      else if (lang === 'css' && !files.some(f => f.name === 'style.css')) fileName = 'style.css';
      else if ((lang === 'javascript' || lang === 'js') && !files.some(f => f.name === 'script.js')) fileName = 'script.js';
      else fileName = `file_${files.length + 1}.${lang === 'javascript' ? 'js' : lang}`;
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
      summary: 'Arquivos extraídos e compilados com sucesso.',
      files: files
    };
  }

  throw new Error('Não foi possível interpretar os arquivos gerados pela IA. Por favor, reenvie a instrução.');
}

const SYSTEM_PROMPT = `Você é o CodeForge AI, um assistente avançado de engenharia de software para geração de código funcional.
Sua resposta DEVE ser EXCLUSIVAMENTE um objeto JSON válido, sem texto explicativo antes ou depois.
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
      contextualPrompt += '\n--- FIM DO CÓDIGO ATUAL ---\nAtualize os arquivos preservando estabilidade e retorne todos os arquivos completos no JSON.';
    }

    messages.push({ role: 'user', content: contextualPrompt });

    // Limite de 75 segundos no backend (evita bater nos 100s do proxy do Render)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 75000);

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
        max_tokens: 8192
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!openRouterResponse.ok) {
      const errText = await openRouterResponse.text();
      let userMsg = `Erro na API OpenRouter (${openRouterResponse.status})`;
      if (openRouterResponse.status === 401) userMsg = 'Chave OPENROUTER_API_KEY inválida ou sem créditos.';
      if (openRouterResponse.status === 429) userMsg = 'Limite de taxa atingido na OpenRouter. Tente novamente em instantes.';
      if (openRouterResponse.status >= 500) userMsg = 'Serviço da IA indisponível temporariamente na OpenRouter.';
      
      console.error('[OpenRouter Error]', openRouterResponse.status, errText);
      return res.status(openRouterResponse.status).json({ error: userMsg, details: errText });
    }

    const data = await openRouterResponse.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return res.status(502).json({ error: 'Nenhuma resposta válida recebida do modelo.' });
    }

    const aiText = data.choices[0].message.content;
    const project = extractProjectFiles(aiText);

    return res.json({
      success: true,
      project: {
        projectName: project.projectName || 'Projeto CodeForge',
        description: project.description || '',
        summary: project.summary || 'Código gerado com sucesso.',
        files: project.files
      }
    });

  } catch (err) {
    console.error('[Server Error]', err);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'O modelo demorou mais de 75 segundos para responder. Tente uma instrução mais curta.' });
    }
    return res.status(500).json({ error: err.message || 'Erro interno no servidor ao processar o código.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const server = app.listen(PORT, HOST, () => {
  console.log(`CodeForge AI pronto em http://${HOST}:${PORT}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));