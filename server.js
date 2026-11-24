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

// Higienizador de strings JSON com quebras de linha literais emitidas por LLMs
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
      if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else if (char.charCodeAt(0) < 32) {
        result += ' ';
      } else {
        result += char;
      }
    } else {
      result += char;
    }
  }
  return result;
}

// Extrator resiliente de arquivos em 6 camadas
function extractProjectFiles(rawText) {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    throw new Error('A resposta devolvida pela IA está vazia.');
  }

  const cleaned = rawText.trim();

  // ESTRATÉGIA 1: Parsing JSON Direto (se a IA enviou JSON perfeito)
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

  // ESTRATÉGIA 2: Parsing JSON com Higienização de Linhas/Aspas
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

  // ESTRATÉGIA 3: Extração Regex de Campos de Arquivo de JSON Truncado
  try {
    const fileEntries = [];
    const nameRegex = /"name"\s*:\s*"([^"]+)"/g;
    let nameMatch;
    
    while ((nameMatch = nameRegex.exec(cleaned)) !== null) {
      const fileName = nameMatch[1];
      const startIndex = nameMatch.index;
      const contentKeyIndex = cleaned.indexOf('"content"', startIndex);

      if (contentKeyIndex !== -1 && contentKeyIndex - startIndex < 300) {
        const colonIndex = cleaned.indexOf(':', contentKeyIndex);
        const quoteStartIndex = cleaned.indexOf('"', colonIndex);
        
        if (quoteStartIndex !== -1) {
          let contentValue = '';
          let i = quoteStartIndex + 1;
          let isEscaped = false;

          while (i < cleaned.length) {
            const c = cleaned[i];
            if (isEscaped) {
              if (c === 'n') contentValue += '\n';
              else if (c === 'r') contentValue += '\r';
              else if (c === 't') contentValue += '\t';
              else contentValue += c;
              isEscaped = false;
            } else if (c === '\\') {
              isEscaped = true;
            } else if (c === '"') {
              const lookAhead = cleaned.substring(i + 1, i + 30).trim();
              if (lookAhead.startsWith(',') || lookAhead.startsWith('}') || lookAhead.startsWith(']')) {
                break;
              } else {
                contentValue += c;
              }
            } else {
              contentValue += c;
            }
            i++;
          }

          if (contentValue.trim().length > 0) {
            fileEntries.push({
              name: fileName,
              language: fileName.endsWith('.html') ? 'html' : (fileName.endsWith('.css') ? 'css' : 'javascript'),
              content: contentValue.trim()
            });
          }
        }
      }
    }

    if (fileEntries.length > 0) {
      return {
        projectName: 'Aplicação Web',
        description: 'Gerado a partir do código estruturado',
        summary: 'Arquivos gerados e recuperados com sucesso.',
        files: fileEntries
      };
    }
  } catch {}

  // ESTRATÉGIA 4: Delimitadores Explícitos (### FILE: nome.ext ou [Arquivo: nome.ext])
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
      projectName: 'Aplicação Web',
      description: 'Gerado via delimitadores de arquivos',
      summary: 'Arquivos compilados com sucesso.',
      files: filesFromDelimiters
    };
  }

  // ESTRATÉGIA 5: Extração por Blocos de Código Markdown
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
      projectName: 'Aplicação Web',
      description: 'Gerado por blocos markdown',
      summary: 'Código compilado com sucesso.',
      files: filesFromBlocks
    };
  }

  // ESTRATÉGIA 6: Garantia Absoluta (Detecção de Código HTML/CSS/JS Bruto)
  const fallbackFiles = [];
  if (cleaned.includes('<html') || cleaned.includes('<!DOCTYPE') || cleaned.includes('<body')) {
    fallbackFiles.push({
      name: 'index.html',
      language: 'html',
      content: cleaned
    });
    fallbackFiles.push({
      name: 'style.css',
      language: 'css',
      content: '/* Estilos embutidos no HTML ou gerados pelo template */\nbody { font-family: sans-serif; }'
    });
    fallbackFiles.push({
      name: 'script.js',
      language: 'javascript',
      content: '// Scripts funcionais integrados'
    });

    return {
      projectName: 'Aplicação Web',
      description: 'Aplicação recuperada do código direto',
      summary: 'Código HTML identificado e compilado.',
      files: fallbackFiles
    };
  }

  // Se for texto explicativo, empacota num HTML limpo para visualização imediata
  return {
    projectName: 'Aplicação Web',
    description: 'Resultado do assistente',
    summary: 'Instrução processada com sucesso.',
    files: [
      {
        name: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>\n<html lang="pt">\n<head>\n  <meta charset="UTF-8">\n  <title>CodeForge AI</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div class="content-wrapper">\n    ${cleaned.replace(/\n/g, '<br>')}\n  </div>\n</body>\n</html>`
      },
      {
        name: 'style.css',
        language: 'css',
        content: 'body { font-family: system-ui, sans-serif; padding: 2rem; background: #F8FAFC; color: #0F172A; line-height: 1.6; }\n.content-wrapper { background: #FFFFFF; padding: 2rem; border-radius: 12px; border: 1px solid #E2E8F0; max-width: 800px; margin: auto; }'
      },
      {
        name: 'script.js',
        language: 'javascript',
        content: '// Código inicial'
      }
    ]
  };
}

const SYSTEM_PROMPT = `Você é o CodeForge AI, um engenheiro de software autônomo de nível sênior.
Sua missão é gerar aplicações completas, funcionais e modernas em HTML, CSS e JavaScript.

Você DEVE estruturar sua resposta preferencialmente no seguinte formato JSON:
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
      "content": "// lógica"
    }
  ]
}

Se preferir ou se o código for extenso, você também pode usar delimitadores claros como:
### FILE: index.html
\`\`\`html
<!DOCTYPE html>
...
\`\`\`

### FILE: style.css
\`\`\`css
...
\`\`\`

### FILE: script.js
\`\`\`javascript
...
\`\`\`

REGRAS:
1. NÃO utilize emojis em nenhuma parte do código ou textos.
2. Não use placeholders como "TODO" ou comentários de código incompleto.
3. Garanta que o formulário de marcação e os botões tenham comportamentos funcionais com JavaScript.`;

// Endpoint com Streaming SSE e Resiliência Total
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
    if (!res.writableEnded) {
      res.write(':\n\n');
    }
  }, 8000);

  sendEvent('status', { message: 'A conectar à OpenRouter (Nemotron 3 Ultra)...' });

  const controller = new AbortController();
  const apiTimeout = setTimeout(() => controller.abort(), 180000);

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
      contextualPrompt += '\n--- FIM DO CÓDIGO ATUAL ---\nAtualize preservando estabilidade e retorne todos os arquivos completos.';
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
        max_tokens: 8192,
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

    sendEvent('status', { message: 'A sintetizar código e componentes funcionais...' });

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

    sendEvent('status', { message: 'A compilar arquivos e montar o preview...' });

    const project = extractProjectFiles(fullAccumulatedText);
    sendEvent('complete', { project });
    res.end();

  } catch (err) {
    clearInterval(heartbeatInterval);
    clearTimeout(apiTimeout);

    console.error('[Streaming Error]', err);
    if (!res.writableEnded) {
      const msg = err.name === 'AbortError'
        ? 'A requisição atingiu o tempo limite. Tente uma instrução mais objetiva.'
        : (err.message || 'Erro durante a compilação do código.');
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