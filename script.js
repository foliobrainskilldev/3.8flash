/**
 * CODEFORGE AI — Lógica do Frontend
 * Atualizado com suporte a cold-start e resiliência em nuvem (Render)
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
          content: '<!DOCTYPE html>\n<html lang="pt">\n<head>\n  <meta charset="UTF-8">\n  <title>CodeForge AI App</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div class="welcome-box">\n    <h1>CodeForge AI</h1>\n    <p>Pronto no Render. Descreva o que deseja construir no painel à esquerda.</p>\n  </div>\n  <script src="script.js"></script>\n</body>\n</html>'
        },
        {
          name: 'style.css',
          language: 'css',
          content: 'body {\n  font-family: sans-serif;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  height: 100vh;\n  margin: 0;\n  background-color: #F8FAFC;\n  color: #0F172A;\n}\n\n.welcome-box {\n  text-align: center;\n  background: #FFFFFF;\n  padding: 2.5rem;\n  border-radius: 12px;\n  border: 1px solid #E2E8F0;\n  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);\n}'
        },
        {
          name: 'script.js',
          language: 'javascript',
          content: '// Código funcional da aplicação\nconsole.log("CodeForge AI: Ambiente de execução pronto.");'
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
    submitText: document.getElementById('submit-text'),

    chipFix: document.getElementById('chip-fix'),
    chipImprove: document.getElementById('chip-improve'),
    chipExplain: document.getElementById('chip-explain'),

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

  // Inicialização Monaco Editor
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
      elements.previewIframe.srcdoc = '<p style="padding: 2rem; font-family: sans-serif;">Nenhum arquivo HTML disponível para exibição.</p>';
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
            console.error("Erro no script do Preview:", err);
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
      workspace.requestFullscreen().catch(() => showToast('Modo ecrã inteiro bloqueado pelo navegador.', 'error'));
    } else {
      document.exitFullscreen();
    }
  });

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

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Falha ao processar o código no servidor Render.');
      }

      state.currentProject = data.project;
      
      state.conversationHistory.push({
        role: 'assistant',
        content: `Projeto: ${data.project.projectName}. Resumo: ${data.project.summary}`
      });

      appendMessageToChat('assistant', data.project.summary, data.project.files);

      const primaryFile = state.currentProject.files.find(f => f.name === 'index.html') || state.currentProject.files[0];
      state.activeFile = primaryFile.name;
      
      if (state.monacoInstance) {
        const model = monaco.editor.createModel(primaryFile.content, getLanguageFromFilename(primaryFile.name));
        state.monacoInstance.setModel(model);
      }

      renderFileTabs();
      updatePreview();
      saveStateToStorage();
      showToast('Código gerado com sucesso.', 'success');

    } catch (err) {
      console.error(err);
      appendMessageToChat('assistant', `Aviso de Erro: ${err.message}`);
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
      elements.submitText.textContent = 'A gerar...';
      elements.submitIcon.setAttribute('data-lucide', 'loader-2');
      elements.submitIcon.classList.add('spin-animation');
    } else {
      elements.submitText.textContent = 'Gerar código';
      elements.submitIcon.setAttribute('data-lucide', 'send');
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
      header.innerHTML = '<i data-lucide="bot"></i><span>CodeForge AI</span>';
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
    elements.promptInput.style.height = Math.min(elements.promptInput.scrollHeight, 180) + 'px';
  }

  elements.promptInput.addEventListener('input', adjustTextareaHeight);

  document.querySelectorAll('.suggestion-card').forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.getAttribute('data-prompt');
      elements.promptInput.value = prompt;
      submitInstruction(prompt);
    });
  });

  elements.chipFix.addEventListener('click', () => {
    submitInstruction('Analise o código atual de todos os arquivos, corrija erros e inconsistências mantendo o projeto funcional.');
  });

  elements.chipImprove.addEventListener('click', () => {
    submitInstruction('Melhore a estética, refinamento visual, tipografia e espaçamentos dos arquivos atuais.');
  });

  elements.chipExplain.addEventListener('click', () => {
    submitInstruction('Explique objetivamente a arquitetura do projeto atual e a responsabilidade de cada arquivo.');
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
    if (confirm('Deseja iniciar um novo projeto? Todo o progresso não guardado será redefinido.')) {
      localStorage.removeItem('codeforge_saved_state');
      window.location.reload();
    }
  });

  // Resiliência de verificação com suporte a Cold Start do Render
  async function checkServerStatus() {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error('Servidor a responder com erro');
      const data = await res.json();

      if (data.hasApiKey) {
        elements.apiStatusBadge.className = 'status-badge online';
        elements.apiStatusText.textContent = 'Render Conectado';
        elements.modalKeyStatus.style.borderColor = 'var(--accent-green)';
        elements.modalKeyText.textContent = 'OPENROUTER_API_KEY ativa nas variáveis do Render.';
      } else {
        elements.apiStatusBadge.className = 'status-badge offline';
        elements.apiStatusText.textContent = 'Chave Ausente';
        elements.modalKeyStatus.style.borderColor = 'var(--accent-amber)';
        elements.modalKeyText.textContent = 'Configure OPENROUTER_API_KEY no painel Environment do Render.';
      }
    } catch (err) {
      // Caso a instância gratuita do Render esteja a arrancar (cold start)
      if (state.serverWakeRetries < 4) {
        state.serverWakeRetries++;
        elements.apiStatusBadge.className = 'status-badge offline';
        elements.apiStatusText.textContent = 'A acordar servidor Render...';
        elements.modalKeyText.textContent = 'A instância gratuita do Render está a iniciar (Cold Start). Aguarde alguns segundos...';
        setTimeout(checkServerStatus, 4000);
      } else {
        elements.apiStatusBadge.className = 'status-badge offline';
        elements.apiStatusText.textContent = 'Servidor Indisponível';
        elements.modalKeyText.textContent = 'Não foi possível estabelecer ligação com a instância no Render.';
      }
    }
  }

  elements.btnOpenSettings.addEventListener('click', () => elements.settingsModal.classList.add('active'));
  elements.btnCloseModal.addEventListener('click', () => elements.settingsModal.classList.remove('active'));
  elements.btnConfirmSettings.addEventListener('click', () => elements.settingsModal.classList.remove('active'));

  elements.btnClearStorage.addEventListener('click', () => {
    if (confirm('Deseja limpar todos os dados e histórico salvos localmente?')) {
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