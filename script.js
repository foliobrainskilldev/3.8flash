/**
 * CODEFORGE AI — Lógica do Frontend (Estilo Lovable)
 * Renderização direta da aplicação em tempo real com Tailwind CSS, Monaco Editor e SSE
 */

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();

  const state = {
    currentProject: {
      projectName: 'Clínica Sorriso Saudável',
      description: 'Website de exemplo pronto a usar',
      summary: 'Website inicial renderizado com Tailwind CSS e marcação de consultas.',
      files: [
        {
          name: 'index.html',
          language: 'html',
          content: `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sorriso & Saúde — Clínica Odontológica</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
  <style>body { font-family: 'Inter', sans-serif; }</style>
</head>
<body class="bg-slate-50 text-slate-800 antialiased">
  
  <!-- Navegação -->
  <header class="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
    <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
          <i data-lucide="sparkles" class="w-5 h-5"></i>
        </div>
        <span class="text-xl font-bold tracking-tight text-slate-900">Sorriso<span class="text-blue-600">Saúde</span></span>
      </div>
      <nav class="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
        <a href="#servicos" class="hover:text-blue-600 transition">Tratamentos</a>
        <a href="#equipa" class="hover:text-blue-600 transition">Corpo Clínico</a>
        <a href="#marcacao" class="hover:text-blue-600 transition">Contactos</a>
      </nav>
      <button onclick="document.getElementById('marcacao').scrollIntoView({behavior:'smooth'})" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition">
        Marcar Consulta
      </button>
    </div>
  </header>

  <!-- Hero Section -->
  <section class="max-w-6xl mx-auto px-4 py-20 text-center">
    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 mb-6">
      <i data-lucide="shield-check" class="w-4 h-4"></i> Atendimento de Excelência
    </span>
    <h1 class="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight max-w-3xl mx-auto leading-tight">
      O cuidado moderno que o seu sorriso merece.
    </h1>
    <p class="mt-6 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
      Tecnologia de ponta, profissionais especializados e ambiente confortável para transformar a sua saúde oral com total tranquilidade.
    </p>
    <div class="mt-8 flex flex-wrap justify-center gap-4">
      <button onclick="document.getElementById('marcacao').scrollIntoView({behavior:'smooth'})" class="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/25 transition">
        Agendar Primeira Consulta
      </button>
      <a href="#servicos" class="px-6 py-3.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-semibold transition">
        Ver Tratamentos
      </a>
    </div>
  </section>

  <!-- Serviços -->
  <section id="servicos" class="max-w-6xl mx-auto px-4 py-16">
    <div class="text-center mb-12">
      <h2 class="text-3xl font-bold text-slate-900">Especialidades Clínicas</h2>
      <p class="text-slate-600 mt-2">Soluções completas para toda a família.</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div class="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
        <div class="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6">
          <i data-lucide="smile" class="w-6 h-6"></i>
        </div>
        <h3 class="text-xl font-bold text-slate-900 mb-2">Ortodontia Invisível</h3>
        <p class="text-slate-600 text-sm leading-relaxed">Alinhadores modernos, confortáveis e impercetíveis para corrigir o seu sorriso no dia a dia.</p>
      </div>

      <div class="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
        <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6">
          <i data-lucide="sparkle" class="w-6 h-6"></i>
        </div>
        <h3 class="text-xl font-bold text-slate-900 mb-2">Branqueamento a Laser</h3>
        <p class="text-slate-600 text-sm leading-relaxed">Resultados visíveis logo na primeira sessão através de tecnologia laser indolor e segura.</p>
      </div>

      <div class="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
        <div class="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-6">
          <i data-lucide="award" class="w-6 h-6"></i>
        </div>
        <h3 class="text-xl font-bold text-slate-900 mb-2">Implantes e Reabilitação</h3>
        <p class="text-slate-600 text-sm leading-relaxed">Devolução total da mastigação e confiança estética com materiais de titânio de grau superior.</p>
      </div>
    </div>
  </section>

  <!-- Formulário de Agendamento Interativo -->
  <section id="marcacao" class="max-w-4xl mx-auto px-4 py-16">
    <div class="bg-white p-8 md:p-12 rounded-3xl border border-slate-200 shadow-xl">
      <div class="text-center mb-8">
        <h2 class="text-2xl md:text-3xl font-bold text-slate-900">Marcação de Consulta Imediata</h2>
        <p class="text-slate-600 text-sm mt-2">Preencha os dados abaixo para reservar o seu horário connosco.</p>
      </div>
      <form id="form-consulta" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Nome Completo</label>
            <input type="text" id="paciente-nome" required placeholder="Ex: Maria Fernandes" class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Telemóvel / WhatsApp</label>
            <input type="tel" id="paciente-tel" required placeholder="Ex: 912 345 678" class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm">
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Tratamento Desejado</label>
            <select id="paciente-servico" class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm bg-white">
              <option>Consulta de Avaliação</option>
              <option>Branqueamento Dentário</option>
              <option>Ortodontia (Aparelhos)</option>
              <option>Limpeza / Destartarização</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Data Preferencial</label>
            <input type="date" id="paciente-data" required class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm">
          </div>
        </div>
        <button type="submit" class="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-base shadow-lg transition">
          Confirmar Marcação Online
        </button>
      </form>
      <div id="mensagem-sucesso" class="hidden mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-center font-medium"></div>
    </div>
  </section>

  <!-- Rodapé -->
  <footer class="border-t border-slate-200 py-10 bg-white text-center text-xs text-slate-500">
    <p>© 2026 Sorriso & Saúde. Desenvolvido e Renderizado via CodeForge Lovable Engine.</p>
  </footer>

  <script src="script.js"></script>
</body>
</html>`
        },
        {
          name: 'style.css',
          language: 'css',
          content: '/* Estilos complementares de animação e utilitários */\nhtml { scroll-behavior: smooth; }\n.btn-pulse:active { transform: scale(0.98); }'
        },
        {
          name: 'script.js',
          language: 'javascript',
          content: `document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    lucide.createIcons();
  }

  const form = document.getElementById('form-consulta');
  const alertBox = document.getElementById('mensagem-sucesso');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = document.getElementById('paciente-nome').value;
      const data = document.getElementById('paciente-data').value;
      
      alertBox.textContent = 'Obrigado, ' + nome + '! O seu agendamento para ' + data + ' foi submetido com sucesso.';
      alertBox.classList.remove('hidden');
      form.reset();
      
      setTimeout(() => {
        alertBox.classList.add('hidden');
      }, 6000);
    });
  }
});`
        }
      ]
    },
    activeFile: 'index.html',
    activeView: 'preview', // PREVIEW É O PADRÃO (ESTILO LOVABLE)
    isGenerating: false,
    conversationHistory: [],
    monacoInstance: null,
    serverWakeRetries: 0
  };

  const elements = {
    apiStatusBadge: document.getElementById('api-status-badge'),
    apiStatusText: document.getElementById('api-status-text'),
    modalKeyStatus: document.getElementById('modal-key-status'),
    modalKeyText: document.getElementById('modal-key-text'),

    chatMessages: document.getElementById('chat-messages'),
    emptyState: document.getElementById('empty-state'),
    promptForm: document.getElementById('prompt-form'),
    promptInput: document.getElementById('prompt-input'),
    btnSubmit: document.getElementById('btn-submit'),
    submitIcon: document.getElementById('submit-icon'),

    chipFix: document.getElementById('chip-fix'),
    chipImprove: document.getElementById('chip-improve'),

    btnNewProject: document.getElementById('btn-new-project'),
    btnOpenSettings: document.getElementById('btn-open-settings'),

    tabBtnCode: document.getElementById('tab-btn-code'),
    tabBtnPreview: document.getElementById('tab-btn-preview'),
    fileTabsBar: document.getElementById('file-tabs-bar'),
    codeViewPane: document.getElementById('code-view-pane'),
    previewViewPane: document.getElementById('preview-view-pane'),
    previewUpdateDot: document.getElementById('preview-update-dot'),

    btnCopyCode: document.getElementById('btn-copy-code'),
    btnDownloadFile: document.getElementById('btn-download-file'),
    btnDownloadZip: document.getElementById('btn-download-zip'),
    btnRefreshPreview: document.getElementById('btn-refresh-preview'),
    btnOpenWindow: document.getElementById('btn-open-window'),
    btnFullscreenToggle: document.getElementById('btn-fullscreen-toggle'),
    previewIframe: document.getElementById('preview-iframe'),

    settingsModal: document.getElementById('settings-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnConfirmSettings: document.getElementById('btn-confirm-settings'),
    btnClearStorage: document.getElementById('btn-clear-storage'),
    toastContainer: document.getElementById('toast-container')
  };

  // Inicializador do Monaco Editor
  function initMonacoEditor() {
    window.require.config({ 
      paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } 
    });

    window.require(['vs/editor/editor.main'], () => {
      const initialFile = state.currentProject.files.find(f => f.name === state.activeFile) || state.currentProject.files[0];
      
      state.monacoInstance = monaco.editor.create(document.getElementById('monaco-container'), {
        value: initialFile ? initialFile.content : '',
        language: getLanguageFromFilename(initialFile ? initialFile.name : 'index.html'),
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 13.5,
        fontFamily: "'JetBrains Mono', monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        lineNumbers: 'on',
        renderLineHighlight: 'all',
        tabSize: 2
      });

      // Hot-reload dinâmico do Preview ao editar o código
      state.monacoInstance.onDidChangeModelContent(() => {
        const fileObj = state.currentProject.files.find(f => f.name === state.activeFile);
        if (fileObj) {
          fileObj.content = state.monacoInstance.getValue();
          saveStateToStorage();
          updatePreview();
        }
      });

      renderFileTabs();
      updatePreview();
    });
  }

  function getLanguageFromFilename(filename) {
    if (filename.endsWith('.html') || filename.endsWith('.htm')) return 'html';
    if (filename.endsWith('.css')) return 'css';
    if (filename.endsWith('.js') || filename.endsWith('.mjs')) return 'javascript';
    if (filename.endsWith('.json')) return 'json';
    return 'plaintext';
  }

  function renderFileTabs() {
    elements.fileTabsBar.innerHTML = '';

    state.currentProject.files.forEach(file => {
      const tab = document.createElement('button');
      tab.className = `file-tab ${file.name === state.activeFile ? 'active' : ''}`;
      
      let iconName = 'file-code';
      if (file.name.endsWith('.html')) iconName = 'code';
      if (file.name.endsWith('.css')) iconName = 'palette';
      if (file.name.endsWith('.js')) iconName = 'file-text';

      tab.innerHTML = `<i data-lucide="${iconName}"></i><span>${file.name}</span>`;
      tab.addEventListener('click', () => {
        switchView('code');
        selectFile(file.name);
      });

      elements.fileTabsBar.appendChild(tab);
    });

    lucide.createIcons();
  }

  function selectFile(filename) {
    state.activeFile = filename;
    const file = state.currentProject.files.find(f => f.name === filename);
    if (!file || !state.monacoInstance) return;

    const model = monaco.editor.createModel(file.content, getLanguageFromFilename(filename));
    state.monacoInstance.setModel(model);
    renderFileTabs();
  }

  // Motor de Sandbox do Live Preview (Gera a aplicação viva na tela)
  function updatePreview() {
    const htmlFile = state.currentProject.files.find(f => f.name.endsWith('.html')) || state.currentProject.files[0];
    const cssFile = state.currentProject.files.find(f => f.name.endsWith('.css'));
    const jsFile = state.currentProject.files.find(f => f.name.endsWith('.js'));

    if (!htmlFile) {
      elements.previewIframe.srcdoc = '<p style="padding: 2rem; font-family: sans-serif;">Nenhum arquivo HTML disponível.</p>';
      return;
    }

    let bundle = htmlFile.content;

    // Garante que o Tailwind CSS e Lucide Icons estão sempre presentes para o render funcionar
    if (!bundle.includes('cdn.tailwindcss.com')) {
      bundle = bundle.replace('<head>', '<head>\n<script src="https://cdn.tailwindcss.com"></script>');
    }
    if (!bundle.includes('unpkg.com/lucide')) {
      bundle = bundle.replace('<head>', '<head>\n<script src="https://unpkg.com/lucide@latest"></script>');
    }

    // Injeta CSS
    if (cssFile && cssFile.content) {
      if (bundle.includes('</head>')) {
        bundle = bundle.replace('</head>', `<style>\n${cssFile.content}\n</style>\n</head>`);
      } else {
        bundle = `<style>\n${cssFile.content}\n</style>\n` + bundle;
      }
    }

    // Injeta JS e inicializa Lucide de imediato dentro do iframe
    const safeJs = `
      <script>
        try {
          ${jsFile ? jsFile.content : ''}
          window.addEventListener('load', () => { if (window.lucide) lucide.createIcons(); });
        } catch(err) {
          console.error("Erro na aplicação:", err);
        }
      </script>
    `;

    if (bundle.includes('</body>')) {
      bundle = bundle.replace('</body>', `${safeJs}\n</body>`);
    } else {
      bundle = bundle + safeJs;
    }

    elements.previewIframe.srcdoc = bundle;
    elements.previewUpdateDot.style.display = 'block';
  }

  function switchView(view) {
    state.activeView = view;
    if (view === 'code') {
      elements.tabBtnCode.classList.add('active');
      elements.tabBtnPreview.classList.remove('active');
      elements.codeViewPane.classList.add('active');
      elements.previewViewPane.classList.remove('active');
      if (state.monacoInstance) state.monacoInstance.layout();
    } else {
      elements.tabBtnPreview.classList.add('active');
      elements.tabBtnCode.classList.remove('active');
      elements.previewViewPane.classList.add('active');
      elements.codeViewPane.classList.remove('active');
      elements.previewUpdateDot.style.display = 'none';
      updatePreview();
    }
  }

  elements.tabBtnCode.addEventListener('click', () => switchView('code'));
  elements.tabBtnPreview.addEventListener('click', () => switchView('preview'));

  document.querySelectorAll('.device-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      elements.previewIframe.style.maxWidth = btn.getAttribute('data-width');
    });
  });

  elements.btnRefreshPreview.addEventListener('click', () => {
    updatePreview();
    showToast('Aplicação recarregada.', 'info');
  });

  elements.btnOpenWindow.addEventListener('click', () => {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(elements.previewIframe.srcdoc);
      newWindow.document.close();
    } else {
      showToast('Permita popups para abrir o website.', 'error');
    }
  });

  elements.btnFullscreenToggle.addEventListener('click', () => {
    const workspace = document.getElementById('workspace-panel');
    if (!document.fullscreenElement) {
      workspace.requestFullscreen().catch(() => showToast('Ecrã inteiro bloqueado.', 'error'));
    } else {
      document.exitFullscreen();
    }
  });

  function createThinkingBubble() {
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble assistant';
    bubble.id = 'active-thinking-bubble';

    bubble.innerHTML = `
      <div class="thinking-bubble">
        <div class="thinking-header">
          <div class="pulse-dot"></div>
          <span id="thinking-model-title">Lovable Engine a construir...</span>
          <span class="thinking-counter-badge" id="thinking-counter-badge">A ligar</span>
        </div>
        <div class="thinking-status-text" id="thinking-step-text">A contactar a inteligência artificial...</div>
      </div>
    `;

    elements.chatMessages.appendChild(bubble);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    lucide.createIcons();

    return {
      updateStatus: (msg) => {
        const textElem = document.getElementById('thinking-step-text');
        if (textElem) textElem.textContent = msg;
      },
      updateCount: (chars) => {
        const badge = document.getElementById('thinking-counter-badge');
        if (badge) badge.textContent = `${chars.toLocaleString()} caracteres`;
      },
      remove: () => {
        const elem = document.getElementById('active-thinking-bubble');
        if (elem) elem.remove();
      }
    };
  }

  // Submissão com Auto-Switch para o Live Preview (Experiência Lovable)
  async function submitInstruction(instructionText) {
    if (!instructionText || state.isGenerating) return;

    const prompt = instructionText.trim();
    if (!prompt) return;

    if (elements.emptyState) {
      elements.emptyState.style.display = 'none';
    }

    appendMessageToChat('user', prompt);
    state.conversationHistory.push({ role: 'user', content: prompt });
    setGeneratingState(true);

    const thinkingUI = createThinkingBubble();

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          conversationHistory: state.conversationHistory,
          currentFiles: state.currentProject.files
        })
      });

      if (!response.ok) {
        throw new Error(`O servidor retornou erro HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let projectPayload = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || '';

        for (const block of blocks) {
          if (!block.trim()) continue;
          let eventType = 'message';
          let dataStr = '';

          const lines = block.split('\n');
          for (const l of lines) {
            if (l.startsWith('event: ')) eventType = l.slice(7).trim();
            if (l.startsWith('data: ')) dataStr = l.slice(6).trim();
          }

          if (dataStr) {
            const parsedData = JSON.parse(dataStr);
            if (eventType === 'status') {
              thinkingUI.updateStatus(parsedData.message);
            } else if (eventType === 'progress') {
              thinkingUI.updateCount(parsedData.charCount);
            } else if (eventType === 'complete') {
              projectPayload = parsedData.project;
            } else if (eventType === 'error') {
              throw new Error(parsedData.error);
            }
          }
        }
      }

      if (!projectPayload || !projectPayload.files || projectPayload.files.length === 0) {
        throw new Error('Não foi possível estruturar os arquivos.');
      }

      state.currentProject = projectPayload;
      state.conversationHistory.push({
        role: 'assistant',
        content: `Projeto: ${projectPayload.projectName}. Resumo: ${projectPayload.summary}`
      });

      thinkingUI.remove();
      appendMessageToChat('assistant', projectPayload.summary, projectPayload.files);

      const primaryFile = state.currentProject.files.find(f => f.name === 'index.html') || state.currentProject.files[0];
      state.activeFile = primaryFile.name;
      
      if (state.monacoInstance) {
        const model = monaco.editor.createModel(primaryFile.content, getLanguageFromFilename(primaryFile.name));
        state.monacoInstance.setModel(model);
      }

      renderFileTabs();

      // Transição automática para o Live Preview (Tal como no Lovable.dev)
      switchView('preview');
      updatePreview();
      saveStateToStorage();
      showToast('Website renderizado e pronto a usar.', 'success');

    } catch (err) {
      thinkingUI.remove();
      console.error(err);
      appendMessageToChat('assistant', `Aviso: ${err.message}`);
      showToast(err.message, 'error');
    } finally {
      setGeneratingState(false);
      elements.promptInput.value = '';
      adjustTextareaHeight();
    }
  }

  function setGeneratingState(generating) {
    state.isGenerating = generating;
    elements.btnSubmit.disabled = generating;
    elements.promptInput.disabled = generating;

    if (generating) {
      elements.submitIcon.setAttribute('data-lucide', 'loader-2');
      elements.submitIcon.classList.add('spin-animation');
    } else {
      elements.submitIcon.setAttribute('data-lucide', 'play');
      elements.submitIcon.classList.remove('spin-animation');
    }
    lucide.createIcons();
  }

  function appendMessageToChat(role, text, files = []) {
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${role}`;

    const body = document.createElement('div');
    body.className = 'bubble-body';

    if (role === 'assistant') {
      const header = document.createElement('div');
      header.className = 'bubble-header';
      header.innerHTML = '<i data-lucide="sparkles"></i><span>Lovable Engine</span>';
      body.appendChild(header);
    }

    const contentParagraph = document.createElement('p');
    contentParagraph.textContent = text;
    body.appendChild(contentParagraph);

    if (files && files.length > 0) {
      const filesContainer = document.createElement('div');
      filesContainer.className = 'bubble-files-list';

      files.forEach(f => {
        const fileChip = document.createElement('span');
        fileChip.className = 'bubble-file-chip';
        fileChip.innerHTML = `<i data-lucide="file"></i><span>${f.name}</span>`;
        filesContainer.appendChild(fileChip);
      });

      body.appendChild(filesContainer);
    }

    bubble.appendChild(body);
    elements.chatMessages.appendChild(bubble);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

    lucide.createIcons();
  }

  elements.promptForm.addEventListener('submit', (e) => {
    e.preventDefault();
    submitInstruction(elements.promptInput.value);
  });

  elements.promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      elements.promptForm.dispatchEvent(new Event('submit'));
    }
  });

  function adjustTextareaHeight() {
    elements.promptInput.style.height = 'auto';
    elements.promptInput.style.height = Math.min(elements.promptInput.scrollHeight, 160) + 'px';
  }

  elements.promptInput.addEventListener('input', adjustTextareaHeight);

  document.querySelectorAll('.pill-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      elements.promptInput.value = prompt;
      submitInstruction(prompt);
    });
  });

  elements.chipFix.addEventListener('click', () => {
    submitInstruction('Analise o código, corrija possíveis problemas de layout no Tailwind ou erros de JavaScript e melhore a usabilidade do site.');
  });

  elements.chipImprove.addEventListener('click', () => {
    submitInstruction('Eleve o nível estético da aplicação: adicione animações suaves, sombras refinadas e melhore a responsividade com Tailwind CSS.');
  });

  elements.btnCopyCode.addEventListener('click', async () => {
    const file = state.currentProject.files.find(f => f.name === state.activeFile);
    if (!file) return;

    try {
      await navigator.clipboard.writeText(file.content);
      showToast(`Código de ${file.name} copiado.`, 'success');
    } catch {
      showToast('Falha ao copiar código.', 'error');
    }
  });

  elements.btnDownloadFile.addEventListener('click', () => {
    const file = state.currentProject.files.find(f => f.name === state.activeFile);
    if (!file) return;

    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Download de ${file.name} concluído.`, 'info');
  });

  elements.btnDownloadZip.addEventListener('click', async () => {
    if (!state.currentProject.files || state.currentProject.files.length === 0) {
      showToast('Nenhum arquivo para download.', 'error');
      return;
    }

    try {
      const zip = new JSZip();
      state.currentProject.files.forEach(file => zip.file(file.name, file.content));

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(state.currentProject.projectName || 'projeto').toLowerCase().replace(/\s+/g, '-')}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Projeto ZIP exportado.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Falha ao gerar arquivo ZIP.', 'error');
    }
  });

  elements.btnNewProject.addEventListener('click', () => {
    if (confirm('Deseja iniciar um novo projeto? O histórico atual será limpo.')) {
      localStorage.removeItem('codeforge_saved_state');
      window.location.reload();
    }
  });

  async function checkServerStatus() {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error();
      const data = await res.json();

      if (data.hasApiKey) {
        elements.apiStatusBadge.className = 'status-badge online';
        elements.apiStatusText.textContent = 'Lovable Online';
        elements.modalKeyStatus.style.borderColor = 'var(--accent-green)';
        elements.modalKeyText.textContent = 'OPENROUTER_API_KEY ativa no Render.';
      } else {
        elements.apiStatusBadge.className = 'status-badge offline';
        elements.apiStatusText.textContent = 'Chave Ausente';
        elements.modalKeyStatus.style.borderColor = 'var(--accent-amber)';
        elements.modalKeyText.textContent = 'Configure OPENROUTER_API_KEY no painel Environment do Render.';
      }
    } catch {
      if (state.serverWakeRetries < 3) {
        state.serverWakeRetries++;
        elements.apiStatusBadge.className = 'status-badge offline';
        elements.apiStatusText.textContent = 'A ligar servidor...';
        setTimeout(checkServerStatus, 3500);
      } else {
        elements.apiStatusBadge.className = 'status-badge offline';
        elements.apiStatusText.textContent = 'Servidor Indisponível';
      }
    }
  }

  elements.btnOpenSettings.addEventListener('click', () => elements.settingsModal.classList.add('active'));
  elements.btnCloseModal.addEventListener('click', () => elements.settingsModal.classList.remove('active'));
  elements.btnConfirmSettings.addEventListener('click', () => elements.settingsModal.classList.remove('active'));

  elements.btnClearStorage.addEventListener('click', () => {
    if (confirm('Deseja limpar os dados salvos localmente?')) {
      localStorage.removeItem('codeforge_saved_state');
      showToast('Armazenamento local limpo.', 'info');
      setTimeout(() => window.location.reload(), 600);
    }
  });

  function saveStateToStorage() {
    try {
      const payload = {
        project: state.currentProject,
        history: state.conversationHistory,
        activeFile: state.activeFile
      };
      localStorage.setItem('codeforge_saved_state', JSON.stringify(payload));
    } catch (e) {
      console.warn('Erro ao salvar no localStorage:', e);
    }
  }

  function loadStateFromStorage() {
    try {
      const raw = localStorage.getItem('codeforge_saved_state');
      if (!raw) return;

      const saved = JSON.parse(raw);
      if (saved && saved.project && saved.project.files) {
        state.currentProject = saved.project;
        state.conversationHistory = saved.history || [];
        state.activeFile = saved.activeFile || 'index.html';

        if (elements.emptyState && state.conversationHistory.length > 0) {
          elements.emptyState.style.display = 'none';
        }

        state.conversationHistory.forEach(msg => appendMessageToChat(msg.role, msg.content));
      }
    } catch (e) {
      console.warn('Erro ao restaurar do localStorage:', e);
    }
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'alert-triangle';

    toast.innerHTML = `<i data-lucide="${icon}"></i><span>${message}</span>`;
    elements.toastContainer.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3800);
  }

  loadStateFromStorage();
  checkServerStatus();
  initMonacoEditor();
});