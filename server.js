import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Configurações de ambiente no Render
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0'; // Obrigatório para escutar dentro dos contentores do Render
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const MODEL_NAME = 'nvidia/nemotron-3-ultra-550b-a55b:free';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

// Habilita trust proxy para proxies reversos (HTTPS no Render)
app.set('trust proxy', 1);

// Middlewares
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Headers de segurança
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Servir arquivos estáticos da raiz
app.use(express.static(__dirname));

// Endpoint de Health Check dedicado para o Render Dashboard
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Rota de status da conexão e chaves
app.get('/api/status', (req, res) => {
  const hasKey = Boolean(OPENROUTER_API_KEY && OPENROUTER_API_KEY.trim().length > 0);
  res.json({
    status: 'online',
    model: MODEL_NAME,
    hasApiKey: hasKey
  });
});

// Extração robusta de JSON retornado pela IA
function extractJSONFromResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('A resposta devolvida pela IA está vazia.');
  }

  let cleaned = rawText.trim();

  // Remove blocos de markdown ```json ... ``` se existirem
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  }

  // Localiza o primeiro '{' e o último '}'
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (parseError) {
    try {
      const sanitized = cleaned
        .replace(/[\u0000-\u001F]+/g, (match) => {
          if (match === '\n') return '\\n';
          if (match === '\r') return '\\r';
          if (match === '\t') return '\\t';
          return '';
        });
      return JSON.parse(sanitized);
    } catch {
      throw new Error('A IA não devolveu um JSON estruturado válido. Tente especificar novamente o pedido.');
    }
  }
}

// Prompt de Sistema
const SYSTEM_PROMPT = `Você é o motor de inteligência artificial do CodeForge AI, um ambiente profissional de desenvolvimento similar ao Cursor e Bolt.new.
Sua missão é gerar aplicações completas, funcionais, modernas e prontas para uso a partir da especificação do utilizador.

REGRAS OBRIGATÓRIAS:
1. Responda ESTRITAMENTE com um objeto JSON válido, sem texto explicativo antes ou depois.
2. Não utilize emojis em nenhuma parte do código gerado ou nos textos de resumo.
3. Gere código robusto, completo, sem placeholders como "/* implemente aqui */" ou "TODO".
4. Divida projetos web em múltiplos arquivos adequados: 'index.html', 'style.css', 'script.js' e arquivos adicionais se necessário.
5. O código HTML deve importar 'style.css' com <link rel="stylesheet" href="style.css"> e 'script.js' com <script src="script.js"></script>.
6. Na resposta JSON, cada arquivo deve conter o código integral pronto para execução.

ESTRUTURA DO JSON DE RESPOSTA OBRIGATÓRIA:
{
  "projectName": "Nome Curto do Projeto",
  "description": "Descrição sucinta do projeto",
  "summary": "Resumo objetivo das implementações ou alterações efetuadas",
  "files": [
    {
      "name": "index.html",
      "language": "html",
      "content": "<!DOCTYPE html>\\n<html lang=\\"pt\\">..."
    },
    {
      "name": "style.css",
      "language": "css",
      "content": "/* Estilos modernos */"
    },
    {
      "name": "script.js",
      "language": "javascript",
      "content": "// Comportamentos funcionais"
    }
  ]
}`;

// Endpoint de geração e conversação contínua
app.post('/api/generate', async (req, res) => {
  const { prompt, conversationHistory = [], currentFiles = [] } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Uma instrução válida deve ser fornecida.' });
  }

  const activeApiKey = OPENROUTER_API_KEY.trim();
  if (!activeApiKey) {
    return res.status(500).json({
      error: 'A chave OPENROUTER_API_KEY não foi configurada nas variáveis de ambiente do Render.'
    });
  }

  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

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

    let contextualUserPrompt = prompt.trim();
    if (Array.isArray(currentFiles) && currentFiles.length > 0) {
      contextualUserPrompt += '\n\n--- ESTADO ATUAL DOS ARQUIVOS DO PROJETO ---\n';
      for (const file of currentFiles) {
        contextualUserPrompt += `\n[Arquivo: ${file.name}]\n${file.content}\n`;
      }
      contextualUserPrompt += '\n--- FIM DOS ARQUIVOS ATUAIS ---\nAtualize ou expanda os arquivos preservando as funcionalidades anteriores e devolva todos os arquivos necessários completos.';
    }

    messages.push({
      role: 'user',
      content: contextualUserPrompt
    });

    // Timeout de 120 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    // Domínio no Render dinâmico para os cabeçalhos de identificação da OpenRouter
    const hostHeader = req.get('host') || 'render.com';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const siteUrl = `${protocol}://${hostHeader}`;

    const openRouterResponse = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${activeApiKey}`,
        'HTTP-Referer': siteUrl,
        'X-Title': 'CodeForge AI on Render',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: messages,
        temperature: 0.2,
        top_p: 0.95
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!openRouterResponse.ok) {
      const errorText = await openRouterResponse.text();
      let errorMsg = `Erro retornado pela OpenRouter (${openRouterResponse.status})`;

      if (openRouterResponse.status === 401) {
        errorMsg = 'Chave da API OpenRouter inválida ou expirada.';
      } else if (openRouterResponse.status === 429) {
        errorMsg = 'Limite de requisições excedido na OpenRouter (Rate Limit). Aguarde um momento.';
      } else if (openRouterResponse.status === 502 || openRouterResponse.status === 503) {
        errorMsg = 'O serviço da OpenRouter ou o modelo Nvidia Nemotron está temporariamente instável.';
      }

      console.error(`Falha OpenRouter (${openRouterResponse.status}):`, errorText);
      return res.status(openRouterResponse.status).json({ error: errorMsg, details: errorText });
    }

    const data = await openRouterResponse.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return res.status(502).json({ error: 'Resposta sem conteúdo válido retornado pelo modelo.' });
    }

    const aiMessage = data.choices[0].message.content;
    const parsedProject = extractJSONFromResponse(aiMessage);

    if (!parsedProject.files || !Array.isArray(parsedProject.files) || parsedProject.files.length === 0) {
      return res.status(422).json({
        error: 'O modelo não gerou arquivos válidos. Tente reformular a instrução.'
      });
    }

    return res.json({
      success: true,
      project: {
        projectName: parsedProject.projectName || 'Projeto CodeForge',
        description: parsedProject.description || 'Aplicação gerada por IA',
        summary: parsedProject.summary || 'Código gerado com sucesso.',
        files: parsedProject.files
      },
      rawResponse: aiMessage
    });

  } catch (err) {
    console.error('Erro de processamento:', err);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Tempo limite esgotado (120s). O modelo demorou para processar.' });
    }
    return res.status(500).json({ error: err.message || 'Erro interno no servidor ao processar o código.' });
  }
});

// Rota Catch-All para servir index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Inicialização do servidor com Host 0.0.0.0
const server = app.listen(PORT, HOST, () => {
  console.log(`[Render] CodeForge AI em execução em http://${HOST}:${PORT}`);
  console.log(`[Render] Modelo ativo: ${MODEL_NAME}`);
  console.log(`[Render] Estado da chave OPENROUTER_API_KEY: ${OPENROUTER_API_KEY ? 'Presente' : 'Ausente no Render Dashboard'}`);
});

// Gestão de encerramento gracioso para o Render
const handleShutdown = (signal) => {
  console.log(`[Render] Sinal ${signal} recebido. A fechar servidor com segurança...`);
  server.close(() => {
    console.log('[Render] Servidor encerrado.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));