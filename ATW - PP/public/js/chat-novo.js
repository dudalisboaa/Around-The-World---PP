// ==================== CHAT APPLICATION ====================
// Real-time chat with Socket.io integration
// ========================================================

const API_BASE_URL = 'http://localhost:3002/api';

// ==================== STATE ====================
const state = {
    currentUser: null,
    socket: null,
    activeConversationId: null,
    currentChatUser: null,
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Chat inicializando...');
    
    state.currentUser = getCurrentUser();
    
    if (!state.currentUser) {
        console.warn('❌ Usuário não autenticado');
        showToast('Faça login para usar o chat', 'error');
        return;
    }
    
    console.log('✅ Usuário autenticado:', state.currentUser.nome);
    
    // Inicializar Socket.io
    initializeSocket();
    
    // Carregar conversas
    loadConversations();
    
    // Configurar event listeners
    setupEventListeners();
});

// ==================== SOCKET.IO ====================
function initializeSocket() {
    state.socket = io('http://localhost:3002', {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
    });

    state.socket.on('connect', () => {
        console.log('🔌 Socket conectado:', state.socket.id);
        
        // Autenticar socket
        state.socket.emit('authenticate', { userId: state.currentUser.id });
    });

    state.socket.on('authenticated', (data) => {
        if (data.success) {
            console.log('✅ Socket autenticado');
        } else {
            console.error('❌ Falha na autenticação do socket');
        }
    });

    // Receber nova mensagem
    state.socket.on('new_message', (data) => {
        console.log('💬 Nova mensagem recebida:', data);
        
        // Se for da conversa ativa, adicionar à UI
        if (state.activeConversationId && data.conversa_id == state.activeConversationId) {
            appendMessage(data);
        }
        
        // Atualizar lista de conversas
        loadConversations();
    });

    // Indicador de digitação
    state.socket.on('user_typing', (data) => {
        if (state.activeConversationId && data.conversaId == state.activeConversationId) {
            showTypingIndicator(data.usuario_nome || 'Alguém');
        }
    });

    // Mensagens marcadas como lidas
    state.socket.on('messages_read', (data) => {
        if (state.activeConversationId && data.conversaId == state.activeConversationId) {
            updateMessagesStatus('read');
        }
    });

    state.socket.on('disconnect', () => {
        console.warn('⚠️ Socket desconectado');
    });

    state.socket.on('connect_error', (error) => {
        console.error('❌ Erro de conexão:', error);
    });
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    // Formulário de mensagem
    const messageForm = document.getElementById('formEnviarMensagem');
    if (messageForm) {
        messageForm.addEventListener('submit', handleSendMessage);
    }

    // Busca de conversas
    const searchInput = document.getElementById('searchConversa');
    if (searchInput) {
        searchInput.addEventListener('input', filterConversations);
    }

    // Botão de nova conversa
    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', openNewChatModal);
    }

    // Botão de deletar conversa
    const deleteBtn = document.getElementById('btnDeletarConversa');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', deleteConversation);
    }

    // Modal de nova conversa
    setupNewChatModal();

    // Monitorar digitação
    const inputMensagem = document.getElementById('inputMensagem');
    if (inputMensagem) {
        let typingTimeout;
        
        inputMensagem.addEventListener('input', () => {
            if (!state.activeConversationId || !state.socket) return;

            clearTimeout(typingTimeout);
            state.socket.emit('typing', { 
                conversaId: state.activeConversationId,
                usuario_nome: state.currentUser.nome
            });

            typingTimeout = setTimeout(() => {
                // Stop typing after 2 seconds of inactivity
            }, 2000);
        });
    }
}

// ==================== CONVERSAS ====================
async function loadConversations() {
    try {
        const container = document.getElementById('conversasList');
        if (!container) return;

        container.innerHTML = '<div class="loading">Carregando conversas...</div>';

        const response = await fetch(`${API_BASE_URL}/chat/conversas/${state.currentUser.id}`);
        const data = await response.json();

        if (!data.success) {
            container.innerHTML = '<div class="loading">Erro ao carregar conversas</div>';
            return;
        }

        if (data.data.length === 0) {
            container.innerHTML = '<div class="loading">Nenhuma conversa. Crie uma nova!</div>';
            return;
        }

        container.innerHTML = '';
        data.data.forEach(conversa => {
            container.appendChild(createConversationItem(conversa));
        });

        console.log(`✅ ${data.data.length} conversas carregadas`);
    } catch (error) {
        console.error('❌ Erro ao carregar conversas:', error);
        const container = document.getElementById('conversasList');
        if (container) {
            container.innerHTML = '<div class="loading">Erro de conexão</div>';
        }
    }
}

function createConversationItem(conversa) {
    const item = document.createElement('div');
    item.className = 'conversa-item';
    item.dataset.conversaId = conversa.id;
    
    if (state.activeConversationId == conversa.id) {
        item.classList.add('active');
    }

    // Determinar nome - SEMPRE usar outro_usuario.nome para individual
    let nome = conversa.nome || 'Conversa';

    if (conversa.tipo === 'individual' && conversa.outro_usuario && conversa.outro_usuario.nome) {
        nome = conversa.outro_usuario.nome.trim();
    }

    // Preview da última mensagem
    let preview = 'Nenhuma mensagem';

    if (conversa.ultima_mensagem) {
        preview = conversa.ultima_mensagem.conteudo.substring(0, 40);
        if (preview.length === 40) preview += '...';
    }

    // Badge de não lidas
    const badge = conversa.nao_lidas > 0 
        ? `<span class="conversa-badge">${conversa.nao_lidas}</span>` 
        : '';

    item.innerHTML = `
        <div class="conversa-info">
            <div class="conversa-nome">${nome}</div>
            <p class="conversa-preview">${preview}</p>
        </div>
        ${badge}
    `;

    item.addEventListener('click', () => loadConversation(conversa.id));
    
    return item;
}

async function loadConversation(conversaId) {
    try {
        console.log('📂 Carregando conversa:', conversaId);
        
        state.activeConversationId = conversaId;

        // Atualizar UI
        document.querySelectorAll('.conversa-item').forEach(item => {
            item.classList.toggle('active', item.dataset.conversaId == conversaId);
        });

        // Mostrar área de chat
        const chatEmpty = document.getElementById('chatEmpty');
        const chatContent = document.getElementById('chatContent');
        if (chatEmpty) chatEmpty.style.display = 'none';
        if (chatContent) chatContent.style.display = 'flex';

        // Carregar mensagens
        const response = await fetch(
            `${API_BASE_URL}/chat/mensagens/${conversaId}?usuarioId=${state.currentUser.id}`
        );
        const data = await response.json();

        if (!data.success) {
            showToast('Erro ao carregar mensagens', 'error');
            return;
        }

        // Renderizar mensagens
        const container = document.getElementById('mensagensContainer');
        container.innerHTML = '';

        if (data.data.length === 0) {
            container.innerHTML = '<div class="empty-messages">Nenhuma mensagem ainda</div>';
        } else {
            data.data.forEach(msg => appendMessage(msg, false));
            scrollToBottom();
        }

        // Focar input
        document.getElementById('inputMensagem')?.focus();

        // Marcar como lida
        state.socket.emit('mark_as_read', { conversaId });

        // Carregar header
        loadConversationHeader(conversaId);

        // Recarregar lista de conversas
        setTimeout(() => loadConversations(), 500);

        console.log(`✅ ${data.data.length} mensagens carregadas`);
    } catch (error) {
        console.error('❌ Erro ao carregar conversa:', error);
        showToast('Erro ao carregar conversa', 'error');
    }
}

async function loadConversationHeader(conversaId) {
    try {
        const response = await fetch(`${API_BASE_URL}/chat/conversas/${state.currentUser.id}`);
        const data = await response.json();

        if (!data.success) return;

        const conversa = data.data.find(c => c.id == conversaId);
        if (!conversa) return;

        // Atualizar nome
        const nameEl = document.getElementById('outroUsuarioNome');
        if (nameEl) {
            nameEl.textContent = conversa.outro_usuario?.nome || conversa.nome || 'Conversa';
        }

        // Salvar info do usuário do chat
        state.currentChatUser = conversa.outro_usuario || null;

        console.log('✅ Header atualizado');
    } catch (error) {
        console.error('❌ Erro ao carregar header:', error);
    }
}

// ==================== MENSAGENS ====================
async function handleSendMessage(event) {
    event.preventDefault();

    const input = document.getElementById('inputMensagem');
    const message = input.value.trim();

    if (!message || !state.activeConversationId) {
        showToast('Selecione uma conversa', 'error');
        return;
    }

    try {
        // Limpar campo
        input.value = '';
        input.focus();

        // Remover "nenhuma mensagem"
        const empty = document.querySelector('.empty-messages');
        if (empty) empty.remove();

        // Enviar via Socket.io
        state.socket.emit('send_message', {
            conversaId: state.activeConversationId,
            conteudo: message
        });

        console.log('📤 Mensagem enviada');
    } catch (error) {
        console.error('❌ Erro ao enviar:', error);
        showToast('Erro ao enviar mensagem', 'error');
    }
}

function appendMessage(message, scroll = true) {
    const container = document.getElementById('mensagensContainer');
    if (!container) return;

    // Remover "nenhuma mensagem"
    const empty = container.querySelector('.empty-messages');
    if (empty) empty.remove();

    const el = document.createElement('div');
    el.className = 'message';
    el.dataset.messageId = message.id;

    const isSent = message.usuario_id == state.currentUser.id;
    el.classList.add(isSent ? 'sent' : 'received');

    el.innerHTML = `
        <div class="message-content">${escapeHtml(message.conteudo)}</div>
        <div class="message-time">${formatTime(message.data_envio)}</div>
    `;

    container.appendChild(el);

    // Remover indicador de digitação
    document.querySelector('.typing-indicator')?.remove();

    if (scroll) scrollToBottom();
}

function scrollToBottom() {
    const container = document.getElementById('mensagensContainer');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function showTypingIndicator(userName) {
    const container = document.getElementById('mensagensContainer');
    if (!container) return;

    // Evitar duplicata
    if (container.querySelector('.typing-indicator')) return;

    const el = document.createElement('div');
    el.className = 'typing-indicator';
    el.textContent = `${userName} está digitando...`;

    container.appendChild(el);
    scrollToBottom();

    setTimeout(() => {
        el.remove();
    }, 3000);
}

function updateMessagesStatus(status) {
    // Implementar se necessário
}

function filterConversations() {
    const term = (document.getElementById('searchConversa')?.value || '').toLowerCase();
    
    document.querySelectorAll('.conversa-item').forEach(item => {
        const name = item.querySelector('.conversa-nome')?.textContent.toLowerCase() || '';
        const preview = item.querySelector('.conversa-preview')?.textContent.toLowerCase() || '';
        
        item.style.display = (name.includes(term) || preview.includes(term)) ? 'flex' : 'none';
    });
}

// ==================== NOVA CONVERSA ====================
function setupNewChatModal() {
    const modal = document.getElementById('newChatModal');
    if (!modal) return;

    const closeBtn = modal.querySelector('.close-modal');
    const searchInput = document.getElementById('searchUser');

    // Fechar modal
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // Fechar ao clicar fora
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Buscar usuários
    if (searchInput) {
        let timeout;
        
        searchInput.addEventListener('input', () => {
            clearTimeout(timeout);
            const term = searchInput.value.trim();

            if (term.length < 2) {
                document.getElementById('userSearchResults').innerHTML = '';
                return;
            }

            timeout = setTimeout(() => searchUsers(term), 500);
        });
    }
}

function openNewChatModal() {
    const modal = document.getElementById('newChatModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('searchUser')?.focus();
    }
}

async function searchUsers(term) {
    try {
        const results = document.getElementById('userSearchResults');
        if (!results) return;

        results.innerHTML = '<div class="loading">Buscando...</div>';

        const response = await fetch(
            `${API_BASE_URL}/chat/usuarios/buscar?termo=${term}&usuarioId=${state.currentUser.id}`
        );
        const data = await response.json();

        if (!data.success) {
            results.innerHTML = '<div class="loading">Erro na busca</div>';
            return;
        }

        if (data.data.length === 0) {
            results.innerHTML = '<div class="loading">Nenhum usuário encontrado</div>';
            return;
        }

        results.innerHTML = '';

        data.data.forEach(user => {
            const item = document.createElement('div');
            item.className = 'user-item';

            item.innerHTML = `<div class="user-item-name">${user.nome}</div>`;

            item.addEventListener('click', () => createConversation(user.id));
            results.appendChild(item);
        });

        console.log(`✅ ${data.data.length} usuários encontrados`);
    } catch (error) {
        console.error('❌ Erro na busca:', error);
        const results = document.getElementById('userSearchResults');
        if (results) results.innerHTML = '<div class="loading">Erro de conexão</div>';
    }
}

async function createConversation(userId) {
    try {
        console.log('➕ Criando conversa com usuário:', userId);

        const response = await fetch(`${API_BASE_URL}/chat/conversas/criar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                usuarioId: state.currentUser.id,
                outroUsuarioId: userId,
                tipo: 'individual'
            })
        });

        const data = await response.json();

        if (!data.success) {
            showToast(data.message || 'Erro ao criar conversa', 'error');
            return;
        }

        // Fechar modal
        const modal = document.getElementById('newChatModal');
        if (modal) modal.style.display = 'none';

        // Entrar na sala da conversa
        if (state.socket) {
            state.socket.emit('join_conversation', { conversaId: data.data.id });
        }

        // Recarregar e abrir
        await loadConversations();
        loadConversation(data.data.id);

        showToast('Conversa criada!', 'success');
        console.log('✅ Conversa criada:', data.data.id);
    } catch (error) {
        console.error('❌ Erro ao criar conversa:', error);
        showToast('Erro ao criar conversa', 'error');
    }
}

// ==================== UTILITIES ====================
function getCurrentUser() {
    try {
        const user = localStorage.getItem('currentUser');
        return user ? JSON.parse(user) : null;
    } catch {
        localStorage.removeItem('currentUser');
        return null;
    }
}

function formatTime(dateStr) {
    try {
        const date = new Date(dateStr);
        if (isNaN(date)) return 'Agora';

        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return 'Agora';
    }
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Deletar conversa
async function deleteConversation() {
    if (!state.activeConversationId) {
        showToast('Nenhuma conversa selecionada', 'error');
        return;
    }

    if (!confirm('Tem certeza que deseja deletar esta conversa? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        console.log('🗑️ Deletando conversa:', state.activeConversationId);

        const response = await fetch(
            `${API_BASE_URL}/chat/conversas/${state.activeConversationId}`,
            {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usuarioId: state.currentUser.id
                })
            }
        );

        const data = await response.json();

        if (!data.success) {
            showToast(data.message || 'Erro ao deletar conversa', 'error');
            return;
        }

        // Resetar UI
        state.activeConversationId = null;
        const chatEmpty = document.getElementById('chatEmpty');
        const chatContent = document.getElementById('chatContent');
        if (chatEmpty) chatEmpty.style.display = 'flex';
        if (chatContent) chatContent.style.display = 'none';

        // Recarregar conversas
        await loadConversations();

        showToast('Conversa deletada com sucesso', 'success');
        console.log('✅ Conversa deletada');
    } catch (error) {
        console.error('❌ Erro ao deletar conversa:', error);
        showToast('Erro ao deletar conversa', 'error');
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    }, 10);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
