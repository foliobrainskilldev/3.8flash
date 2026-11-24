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
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(express.static(__dirname));

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

// Higienizador resiliente de strings JSON
function sanitizeJSONString(str) {
  let result = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      result += char;
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      result += char;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    if (inString) {
      if (char === '\n') result += '\\n';
      else if (char === '\r') result += '\\r';
      else if (char === '\t') result += '\\t';
      else if (char.charCodeAt(0) < 32) result += ' ';
      else result += char;
    } else {
      result += char;
    }
  }
  return result;
}

// Extrator resiliente em múltiplas camadas no padrão Lovable
function extractProjectFiles(rawText) {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    throw new Error('A resposta devolvida pela IA está vazia.');
  }

  const cleaned = rawText.trim();

  // 1. Parsing JSON Direto
  try {
    let directCandidate = cleaned;
    const jsonMatch = directCandidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonMatch && jsonMatch[1]) directCandidate = jsonMatch[1].trim();

    const firstBrace = directCandidate.indexOf('{');
    const lastBrace = directCandidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const parsed = JSON.parse(directCandidate.substring(firstBrace, lastBrace + 1));
      if (parsed.files && Array.isArray(parsed.files) && parsed.files.length > 0) {
        return parsed;
      }
    }
  } catch {}

  // 2. Parsing JSON Higienizado
  try {
    let candidate = cleaned;
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      candidate = candidate.substring(firstBrace, lastBrace + 1);
      const sanitized = sanitizeJSONString(candidate);
      const parsed = JSON.parse(sanitized);
      if (parsed.files && Array.isArray(parsed.files) && parsed.files.length > 0) {
        return parsed;
      }
    }
  } catch {}

  // 3. Extração por Delimitadores de Arquivo (### FILE: nome.ext)
  const filesFromDelimiters = [];
  const delimiterRegex = /(?:###\s*FILE:?|===\s*FILE:?|\[Arquivo:?)\s*([a-zA-Z0-9._-]+)[^\n]*\n([\s\S]*?)(?=(?:###\s*FILE:?|===\s*FILE:?|\[Arquivo:?)|$)/gi;
  let delMatch;

  while ((delMatch = delimiterRegex.exec(cleaned)) !== null) {
    const fileName = delMatch[1].trim();
    let fileContent = delMatch[2].trim();

    const codeWrap = fileContent.match(/```(?:[a-zA-Z0-9]+)?\s*([\s\S]*?)\s*```/);
    if (codeWrap && codeWrap[1]) fileContent = codeWrap[1].trim();

    filesFromDelimiters.push({
      name: fileName,
      language: fileName.endsWith('.html') ? 'html' : (fileName.endsWith('.css') ? 'css' : 'javascript'),
      content: fileContent
    });
  }

  if (filesFromDelimiters.length > 0) {
    return {
      projectName: 'Aplicação Web Lovable',
      description: 'Aplicação gerada com Tailwind CSS e JavaScript interativo',
      summary: 'Aplicação construída e pronta para execução.',
      files: filesFromDelimiters
    };
  }

  // 4. Sniffer de Blocos de Código Markdown
  const filesFromBlocks = [];
  const blockRegex = /```(html|css|javascript|js)?\s*(?:<!--\s*([a-zA-Z0-9._-]+)\s*-->|\/\*\s*([a-zA-Z0-9._-]+)\s*\*\/)?\s*([\s\S]*?)```/gi;
  let bMatch;

  while ((bMatch = blockRegex.exec(cleaned)) !== null) {
    const lang = (bMatch[1] || 'html').toLowerCase();
    const explicitName = bMatch[2] || bMatch[3];
    const content = bMatch[4].trim();

    let name = explicitName;
    if (!name) {
      if (lang === 'html' && !filesFromBlocks.some(f => f.name === 'index.html')) name = 'index.html';
      else if (lang === 'css' && !filesFromBlocks.some(f => f.name === 'style.css')) name = 'style.css';
      else if ((lang === 'javascript' || lang === 'js') && !filesFromBlocks.some(f => f.name === 'script.js')) name = 'script.js';
      else name = `arquivo_${filesFromBlocks.length + 1}.${lang === 'javascript' ? 'js' : lang}`;
    }

    filesFromBlocks.push({
      name: name,
      language: lang === 'js' ? 'javascript' : lang,
      content: content
    });
  }

  if (filesFromBlocks.length > 0) {
    return {
      projectName: 'Aplicação Web Lovable',
      description: 'Aplicação completa extraída com sucesso',
      summary: 'Arquivos compilados e renderizados no preview.',
      files: filesFromBlocks
    };
  }

  // 5. Garantia Final: Código HTML direto transformado em app
  return {
    projectName: 'Aplicação Web',
    description: 'Interface web gerada',
    summary: 'Interface web estruturada e renderizada.',
    files: [
      {
        name: 'index.html',
        language: 'html',
        content: cleaned.includes('<html') ? cleaned : `<!DOCTYPE html>\n<html lang="pt">\n<head>\n  <meta charset="UTF-8">\n  <script src="https://cdn.tailwindcss.com"></script>\n  <script src="https://unpkg.com/lucide@latest"></script>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body class="bg-slate-50 text-slate-900">\n  ${cleaned}\n  <script src="script.js"></script>\n</body>\n</html>`
      },
      {
        name: 'style.css',
        language: 'css',
        content: '@layer utilities {\n  .glass { background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(12px); }\n}'
      },
      {
        name: 'script.js',
        language: 'javascript',
        content: 'document.addEventListener("DOMContentLoaded", () => { if (window.lucide) lucide.createIcons(); });'
      }
    ]
  };
}

// Prompt de Sistema Inspirado no Lovable.dev
const SYSTEM_PROMPT = `Você é o Lovable AI Engine do CodeForge, um arquiteto e designer de software frontend de classe mundial.
Sua missão é gerar APLICAÇÕES WEB COMPLETAS, INTERATIVAS E MODERNAS que sejam renderizadas diretamente na tela como um produto real.

PADRÃO VISUAL E TECNOLÓGICO OBRIGATÓRIO (ESTILO LOVABLE):
1. Use SEMPRE Tailwind CSS via CDN (<script src="https://cdn.tailwindcss.com"></script>) no cabeçalho do index.html.
2. Use ícones SVG via Lucide (<script src="https://unpkg.com/lucide@latest"></script>) com tags <i data-lucide="..."></i> em botões, menus e cartões.
3. Adicione a fonte Inter do Google Fonts para uma tipografia moderna e elegante.
4. O design DEVE ser rico e com acabamento de produto real: sombras suaves (shadow-sm, shadow-xl), cantos arredondados (rounded-2xl, rounded-xl), gradientes subtis, bordas discretas (border-slate-200) e alternância de cores elegante (ex: slate-900 com azul #2563EB ou esmeralda #059669).
5. O JavaScript em 'script.js' DEVE ser 100% funcional e interativo: modais que abrem e fecham, formulários com validação e feedback visual na tela (toasts ou alertas inline), filtros de pesquisa funcionais, agendamentos salvos no localStorage.

FORMATO DE RESPOSTA (JSON OU DELIMITADORES DE ARQUIVO):
Você pode responder em JSON estruturado:
{
  "projectName": "Nome da Aplicação",
  "description": "Descrição",
  "summary": "Resumo das funcionalidades",
  "files": [
    { "name": "index.html", "language": "html", "content": "<!DOCTYPE html>..." },
    { "name": "style.css", "language": "css", "content": "/* animações */" },
    { "name": "script.js", "language": "javascript", "content": "// interações" }
  ]
}

Ou usando delimitadores:
### FILE: index.html
\`\`\`html
<!DOCTYPE html>...
\`\`\`

### FILE: style.css
\`\`\`css
/* estilos */
\`\`\`

### FILE: script.js
\`\`\`javascript
// lógica
\`\`\`

REGRAS RÍGIDAS:
- Não utilize emojis em nenhuma parte.
- Nunca devolva código incompleto ou placeholders como "// adicione aqui". Escreva todo o código necessário para o site funcionar de imediato.`;

app.post('/api/generate', async (req, res) => {
  const { prompt, conversationHistory = [], currentFiles = [] } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'A instrução não pode estar vazia.' });
  }

  const activeApiKey = OPENROUTER_API_KEY.trim();
  if (!activeApiKey) {
    return res.status(500).json({
      error: 'A chave OPENROUTER_API_KEY não está configurada no Render.'
    });
  }

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

  const heartbeatInterval = setInterval(() => {
    if (!res.writableEnded) res.write(':\n\n');
  }, 8000);

  sendEvent('status', { message: 'A contactar Lovable Engine (Nemotron 3 Ultra)...' });

  const controller = new AbortController();
  const apiTimeout = setTimeout(() => controller.abort(), 180000);

  res.on('close', () => {
    clearTimeout(apiTimeout);
    clearInterval(heartbeatInterval);
    if (!res.writableEnded) controller.abort();
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
      contextualPrompt += '\n--- FIM DO CÓDIGO ATUAL ---\nAtualize preservando as funcionalidades existentes e retorne o código completo.';
    }

    messages.push({ role: 'user', content: contextualPrompt });

    const siteUrl = `${req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http'}://${req.get('host') || 'render.com'}`;

    const openRouterResponse = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${activeApiKey}`,
        'HTTP-Referer': siteUrl,
        'X-Title': 'CodeForge Lovable Platform',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: PRIMARY_MODEL,
        models: FALLBACK_MODELS,
        messages: messages,
        temperature: 0.25,
        max_tokens: 8192,
        stream: true
      }),
      signal: controller.signal
    });

    if (!openRouterResponse.ok) {
      const errText = await openRouterResponse.text();
      clearInterval(heartbeatInterval);
      clearTimeout(apiTimeout);
      sendEvent('error', { error: `Erro na OpenRouter (${openRouterResponse.status})`, details: errText });
      return res.end();
    }

    sendEvent('status', { message: 'A projetar componentes Tailwind CSS e interações...' });

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
          } catch {}
        }
      }
    }

    clearInterval(heartbeatInterval);
    clearTimeout(apiTimeout);

    sendEvent('status', { message: 'A renderizar website no ecossistema Preview...' });

    const project = extractProjectFiles(fullAccumulatedText);
    sendEvent('complete', { project });
    res.end();

  } catch (err) {
    clearInterval(heartbeatInterval);
    clearTimeout(apiTimeout);
    console.error('[Streaming Error]', err);
    if (!res.writableEnded) {
      sendEvent('error', { error: err.name === 'AbortError' ? 'Tempo limite atingido.' : err.message });
      res.end();
    }
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const server = app.listen(PORT, HOST, () => {
  console.log(`[Lovable Engine] CodeForge AI em http://${HOST}:${PORT}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));