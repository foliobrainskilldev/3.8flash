/**
 * CODEFORGE AI — Lógica do Frontend
 * Atualizado com tratamento resiliente de respostas compiladas e proteção de renderização
 */

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();

  const state = {
    currentProject: {
      projectName: 'Novo Projeto',
      description: '',
      summary: '',
      files: [
        {
          name: 'index.html',
          language: 'html',
          content: '<!DOCTYPE html>\n<html lang="pt">\n<head>\n  <meta charset="UTF-8">\n  <title>CodeForge AI App</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div class="welcome-box">\n    <h1>CodeForge AI</h1>\n    <p>Pronto. Descreva a aplicação desejada na caixa à esquerda.</p>\n  </div>\n  <script src="script.js"></script>\n</body>\n</html>'
        },
        {
          name: 'style.css',
          language: 'css',
          content: 'body {\n  font-family: sans-serif;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  height: 100vh;\n  margin: 0;\n  background-color: #F8FAFC;\n  color: #0F172A;\n}\n\n.welcome-box {\n  text-align: center;\n  background: #FFFFFF;\n  padding: 2.5rem;\n  border-radius: 12px;\n  border: 1px solid #E2E8F0;\n  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);\n}'
        },
        {
          name: 'script.js',
          language: 'javascript',
          content: '// Código funcional da aplicação\nconsole.log("CodeForge AI: Pronto.");'
        }
      ]
    },
    activeFile: 'index.html',
    activeView: 'code',
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

      state.monacoInstance.onDidChangeModelContent(() => {
        const fileObj = state.currentProject.files.find(f => f.name === state.activeFile);
        if (fileObj) {
          fileObj.content = state.monacoInstance.getValue();
          saveStateToStorage();
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
    if (filename.endsWith('.py')) return 'python';
    if (filename.endsWith('.svg')) return 'xml';
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
      if (file.name.endsWith('.json')) iconName = 'database';

      tab.innerHTML = `<i data-lucide="${iconName}"></i><span>${file.name}</span>`;
      tab.addEventListener('click', () => selectFile(file.name));

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

  function updatePreview() {
    const htmlFile = state.currentProject.files.find(f => f.name.endsWith('.html')) || state.currentProject.files[0];
    const cssFile = state.currentProject.files.find(f => f.name.endsWith('.css'));
    const jsFile = state.currentProject.files.find(f => f.name.endsWith('.js'));

    if (!htmlFile) {
      elements.previewIframe.srcdoc = '<p style="padding: 2rem; font-family: sans-serif;">Nenhum arquivo HTML disponível.</p>';
      return;
    }

    let bundle = htmlFile.content;

    if (cssFile && cssFile.content) {
      if (bundle.includes('</head>')) {
        bundle = bundle.replace('</head>', `<style>\n${cssFile.content}\n</style>\n</head>`);
      } else {
        bundle = `<style>\n${cssFile.content}\n</style>\n` + bundle;
      }
    }

    if (jsFile && jsFile.content) {
      const safeJs = `
        <script>
          try {
            ${jsFile.content}
          } catch(err) {
            console.error("Erro no Preview:", err);
          }
        </script>
      `;

      if (bundle.includes('</body>')) {
        bundle = bundle.replace('</body>', `${safeJs}\n</body>`);
      } else {
        bundle = bundle + safeJs;
      }
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
    showToast('Pré-visualização atualizada.', 'info');
  });

  elements.btnOpenWindow.addEventListener('click', () => {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(elements.previewIframe.srcdoc);
      newWindow.document.close();
    } else {
      showToast('Permita popups para abrir em nova janela.', 'error');
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
          <span id="thinking-model-title">Nemotron 3 Ultra em execução...</span>
          <span class="thinking-counter-badge" id="thinking-counter-badge">A ligar</span>
        </div>
        <div class="thinking-status-text" id="thinking-step-text">A contactar a OpenRouter...</div>
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
        if (badge) badge.textContent = `${chars.toLocaleString()} chars gerados`;
      },
      remove: () => {
        const elem = document.getElementById('active-thinking-bubble');
        if (elem) elem.remove();
      }
    };
  }

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
        throw new Error('Não foi possível estruturar os arquivos devolvidos.');
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
      updatePreview();
      saveStateToStorage();
      showToast('Código compilado com sucesso.', 'success');

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
      elements.submitIcon.setAttribute('data-lucide', 'audio-waveform');
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
      header.innerHTML = '<i data-lucide="sparkles"></i><span>CodeForge Engine</span>';
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
    submitInstruction('Analise todos os arquivos atuais, corrija erros e garanta total estabilidade.');
  });

  elements.chipImprove.addEventListener('click', () => {
    submitInstruction('Aprimore a tipografia, o contraste visual e o espaçamento dos componentes existentes.');
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
    if (confirm('Deseja iniciar um novo projeto? Todo o histórico não guardado será redefinido.')) {
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
        elements.apiStatusText.textContent = 'Render Conectado';
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
        elements.apiStatusText.textContent = 'A acordar servidor...';
        elements.modalKeyText.textContent = 'Instância do Render em Cold Start. Aguarde...';
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
    if (confirm('Deseja limpar todos os dados salvos localmente?')) {
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