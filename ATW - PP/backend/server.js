const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { connectDB, executeQuery } = require('./db');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3002;

// Criar servidor HTTP para Socket.io
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));


// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../public/uploads/posts');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'post-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos de imagem são permitidos!'), false);
        }
    }
});

// Configuração para fotos de perfil
const profileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../public/uploads/profiles');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const profileUpload = multer({ 
    storage: profileStorage,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB para fotos de perfil
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos de imagem são permitidos!'), false);
        }
    }
});


// Log de requisições
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// ===== ROTAS DE AUTENTICAÇÃO =====

// Cadastro
app.post('/api/auth/cadastro', async (req, res) => { // Rota para cadastrar um novo usuário
    try {
        const { nome, email, senha, descricao } = req.body;

        // Validação dos campos obrigatórios
        if (!nome || !email || !senha) {
            return res.status(400).json({ success: false, message: 'Nome, email e senha são obrigatórios' });
        }

        // Validar email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Email inválido' });
        }

        // Validar senha
        if (senha.length < 6) {
            return res.status(400).json({ success: false, message: 'Senha deve ter no mínimo 6 caracteres' });
        }

        // Verifica se email já existe
        const existing = await executeQuery('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'Este email já está cadastrado' });
        }

        // Hash da senha
        const hashedPassword = await bcrypt.hash(senha, 10);

        // Insere novo usuário no banco de dados
        const result = await executeQuery(`
            INSERT INTO usuarios (nome, email, senha, descricao)
            VALUES (?, ?, ?, ?)
        `, [nome, email, hashedPassword, descricao || null]);

        console.log('✅ Usuário cadastrado com sucesso:', { id: result.insertId, nome, email });

        res.status(201).json({
            success: true,
            message: 'Usuário cadastrado com sucesso!',
            data: { id: result.insertId, nome, email }
        });

    } catch (error) {
        console.error('❌ Erro no cadastro:', error.message);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Atualizar usuário
app.put('/api/users/update', async (req, res) => { // Atualiza informações do usuário
    try {
        const { usuario_id, nome, email, senha, descricao } = req.body;

        // Validação de campos obrigatórios
        if (!usuario_id || !nome || !email) {
            return res.json({ success: false, message: 'ID do usuário, nome e email são obrigatórios' });
        }

        // Verifica se usuário existe
        const userExists = await executeQuery('SELECT id FROM usuarios WHERE id = ?', [usuario_id]);
        if (userExists.length === 0) {
            return res.json({ success: false, message: 'Usuário não encontrado' });
        }

        // Verifica se o email já está sendo usado por outro usuário
        const emailExists = await executeQuery('SELECT id FROM usuarios WHERE email = ? AND id != ?', [email, usuario_id]);
        if (emailExists.length > 0) {
            return res.json({ success: false, message: 'Este email já está sendo usado por outro usuário' });
        }

        // Prepara query de atualização
        let updateQuery = 'UPDATE usuarios SET nome = ?, email = ?, descricao = ?';
        let updateParams = [nome, email, descricao || null];

        // Adiciona nova senha, se fornecida
        if (senha) {
            const hashedPassword = await bcrypt.hash(senha, 10);
            updateQuery += ', senha = ?';
            updateParams.push(hashedPassword);
        }

        updateQuery += ' WHERE id = ?';
        updateParams.push(usuario_id);

        // Executa atualização
        await executeQuery(updateQuery, updateParams);

        console.log('Usuário atualizado:', { id: usuario_id, nome, email });

        res.json({
            success: true,
            message: 'Perfil atualizado com sucesso!',
            data: { id: usuario_id, nome, email, descricao }
        });

    } catch (error) {
        console.error('❌ Erro ao atualizar usuário:', error);
        res.json({ success: false, message: 'Erro interno do servidor: ' + error.message });
    }
});

// Upload de avatar
app.post('/api/users/upload-avatar', profileUpload.single('avatar'), async (req, res) => { // Upload de imagem de perfil do usuário
    try {
        const { usuario_id } = req.body;

        // Verifica se ID e arquivo foram enviados
        if (!usuario_id || !req.file) {
            return res.json({ success: false, message: 'Usuário e arquivo são obrigatórios' });
        }

        // Caminho da imagem
        const avatarPath = `/uploads/profiles/${req.file.filename}`;


        // Atualiza no banco de dados
        await executeQuery('UPDATE usuarios SET foto_perfil = ? WHERE id = ?', [avatarPath, usuario_id]);

        console.log('✅ Avatar atualizado para usuário:', usuario_id);

        res.json({
            success: true,
            message: 'Foto de perfil atualizada com sucesso!',
            data: { foto_perfil: avatarPath }
        });

    } catch (error) {
        console.error('❌ Erro ao fazer upload do avatar:', error);
        res.json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => { // Rota de login do usuário
    try {
        const { email, senha } = req.body;

        // Valida dados
        if (!email || !senha) {
            return res.status(400).json({ success: false, message: 'Email e senha são obrigatórios' });
        }

        // Buscar usuário com e-mail
        const users = await executeQuery('SELECT * FROM usuarios WHERE email = ?', [email]);

        // Se não achar usuário, falha
        if (users.length === 0) {
            console.log('❌ Login falhou: Email não encontrado -', email);
            return res.status(401).json({ success: false, message: 'Email ou senha incorretos' });
        }

        const user = users[0];

        // Comparar senha com hash
        const passwordMatch = await bcrypt.compare(senha, user.senha);
        if (!passwordMatch) {
            console.log('❌ Login falhou: Senha incorreta -', email);
            return res.status(401).json({ success: false, message: 'Email ou senha incorretos' });
        }

        console.log('✅ Login realizado com sucesso:', { id: user.id, nome: user.nome, email: user.email });
        
        // Remover senha da resposta
        delete user.senha;

        res.status(200).json({
            success: true,
            message: 'Login realizado com sucesso!',
            data: { usuario: user, redirectTo: '/feed' }
        });

    } catch (error) {
        console.error('❌ Erro no login:', error.message);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// ===== ROTAS DE POSTAGENS =====

// Criar postagem
app.post('/api/posts/postar', upload.single('photo'), async (req, res) => { // Cria uma nova postagem. Pode ter conteúdo de texto e/ou uma imagem enviada via Multer
    try {
        const { usuario_id, conteudo } = req.body; // Extrai dados do corpo da requisição

        if (!usuario_id || (!conteudo && !req.file)) { // Validação: precisa de texto ou imagem
            return res.json({ success: false, message: 'Usuário e conteúdo (ou imagem) são obrigatórios' });
        }

        // Caminho da imagem, caso foi enviada
        const imagePath = req.file ? `/uploads/posts/${req.file.filename}` : null;

        // Insere postagem no banco de dados
        const result = await executeQuery(
            'INSERT INTO postagens (usuario_id, conteudo, imagem) VALUES (?, ?, ?)',
            [usuario_id, conteudo || '', imagePath]
        );

        console.log('✅ Postagem criada:', result.insertId);

        res.json({
            success: true,
            message: 'Postagem criada com sucesso!',
            data: { id: result.insertId, usuario_id, conteudo, imagem: imagePath }
        });

    } catch (error) {
        console.error('❌ Erro ao criar postagem:', error);
        res.json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Obter feed
app.get('/api/posts/feed', async (req, res) => { // Retorna uma lista de postagens recentes + comentários

    try {
        const posts = await executeQuery(`
            SELECT 
                p.id, p.conteudo, p.imagem, p.curtidas, p.data_criacao as created_at,
                u.id as usuario_id, u.nome as usuario_nome, u.email as usuario_email, u.foto_perfil
            FROM postagens p
            JOIN usuarios u ON p.usuario_id = u.id
            ORDER BY p.data_criacao DESC
            LIMIT 20
        `); // Busca as 20 postagens mais recentes

        // Para cada post, busca até 3 comentários
        for (let post of posts) {
            const comments = await executeQuery(`
                SELECT 
                    c.id, c.conteudo, c.data_criacao as created_at,
                    u.id as usuario_id, u.nome as usuario_nome, u.foto_perfil
                FROM comentarios c
                JOIN usuarios u ON c.usuario_id = u.id
                WHERE c.postagem_id = ?
                ORDER BY c.data_criacao ASC
                LIMIT 3
            `, [post.id]);

            post.comentarios_lista = comments; // Adiciona comentários dentro do objeto do post
        }

        res.json({ success: true, data: posts }); // Retorna o feed com comentários 

    } catch (error) {
        console.error('❌ Erro ao obter feed:', error);
        res.json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Curtir postagem
app.post('/api/posts/curtir', async (req, res) => { // Adiciona ou remove curtida em uma postagem
    try {
        const { postagem_id, usuario_id } = req.body;

        if (!postagem_id || !usuario_id) { // Validação
            return res.json({ success: false, message: 'Postagem e usuário são obrigatórios' });
        }

        // Verificar se usuário já curtiu
        const existing = await executeQuery('SELECT id FROM curtidas WHERE postagem_id = ? AND usuario_id = ?', [postagem_id, usuario_id]);

        let acao;
        if (existing.length > 0) {
            // Se já foi curtida, remove curtida
            await executeQuery('DELETE FROM curtidas WHERE postagem_id = ? AND usuario_id = ?', [postagem_id, usuario_id]);
            acao = 'descurtiu';
        } else {
            // Se não curtiu, adiciona curtida
            await executeQuery('INSERT INTO curtidas (postagem_id, usuario_id) VALUES (?, ?)', [postagem_id, usuario_id]);
            acao = 'curtiu';
        }

        // Conta total de curtidas
        const total = await executeQuery('SELECT COUNT(*) as count FROM curtidas WHERE postagem_id = ?', [postagem_id]);
        const totalCurtidas = total[0].count;

        // Atualiza contador na postagem
        await executeQuery('UPDATE postagens SET curtidas = ? WHERE id = ?', [totalCurtidas, postagem_id]);

        res.json({
            success: true,
            message: `Postagem ${acao} com sucesso!`,
            data: { postagem_id, usuario_id, acao, total_curtidas: totalCurtidas }
        });

    } catch (error) {
        console.error('❌ Erro ao curtir:', error);
        res.json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Comentar postagem
app.post('/api/posts/comentar', async (req, res) => { // Adiciona comentário em uma postagem
    try {
        const { postagem_id, usuario_id, conteudo } = req.body;

        if (!postagem_id || !usuario_id || !conteudo) { // Validação
            return res.json({ success: false, message: 'Todos os campos são obrigatórios' });
        }

        // Insere comentário no banco
        const result = await executeQuery('INSERT INTO comentarios (postagem_id, usuario_id, conteudo) VALUES (?, ?, ?)',
            [postagem_id, usuario_id, conteudo]);

        // Conta total de comentários
        const total = await executeQuery('SELECT COUNT(*) as count FROM comentarios WHERE postagem_id = ?', [postagem_id]);
        const totalComentarios = total[0].count;

        // Atualiza contador de comentários na tabela postagens
        await executeQuery('UPDATE postagens SET comentarios = ? WHERE id = ?', [totalComentarios, postagem_id]);

        console.log('✅ Comentário adicionado:', result.insertId);

        res.json({
            success: true,
            message: 'Comentário adicionado com sucesso!',
            data: { id: result.insertId, postagem_id, usuario_id, conteudo }
        });

    } catch (error) {
        console.error('❌ Erro ao comentar:', error);
        res.json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Deletar postagem (apenas para criador)
app.delete('/api/posts/deletar/:id', async (req, res) => { // Remove postagem (se for criador)
    try {
        const postId = req.params.id; // ID da postagem vindo da URL
        const { usuario_id } = req.body; // ID do usuário enviado no body

        if (!postId || !usuario_id) { // Validação
            return res.json({ success: false, message: 'Post ID e usuário são obrigatórios' });
        }

        // Verificar se o usuário é o criador do post
        const post = await executeQuery('SELECT * FROM postagens WHERE id = ?', [postId]);

        if (post.length === 0) {
            return res.json({ success: false, message: 'Postagem não encontrada' });
        }

        // Verificar se é o criador do post
        const isOwner = post[0].usuario_id === parseInt(usuario_id);

        if (!isOwner) {
            return res.json({ success: false, message: 'Você não tem permissão para deletar este post' });
        }

        // Deleta comentários primeiro
        await executeQuery('DELETE FROM comentarios WHERE postagem_id = ?', [postId]);

        // Deleta curtidas
        await executeQuery('DELETE FROM curtidas WHERE postagem_id = ?', [postId]);

        // Deleta postagem
        await executeQuery('DELETE FROM postagens WHERE id = ?', [postId]);

        console.log('✅ Postagem deletada:', postId, 'por usuário:', usuario_id);

        res.json({
            success: true,
            message: 'Postagem deletada com sucesso!',
            data: { postagem_id: postId }
        });

    } catch (error) {
        console.error('❌ Erro ao deletar postagem:', error);
        res.json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Obter informações de um usuário específico
app.get('/api/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'ID do usuário é obrigatório' });
        }

        // Buscar informações do usuário
        const users = await executeQuery('SELECT id, nome, email, foto_perfil, descricao, data_criacao FROM usuarios WHERE id = ?', [userId]);

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        const user = users[0];

        // Buscar posts do usuário
        const posts = await executeQuery(`
            SELECT 
                p.id, p.conteudo, p.imagem, p.curtidas, p.comentarios, p.data_criacao as created_at
            FROM postagens p
            WHERE p.usuario_id = ?
            ORDER BY p.data_criacao DESC
            LIMIT 10
        `, [userId]);

        // Contar total de posts
        const totalPosts = await executeQuery('SELECT COUNT(*) as count FROM postagens WHERE usuario_id = ?', [userId]);

        res.json({
            success: true,
            data: {
                user: user,
                posts: posts,
                stats: {
                    total_posts: totalPosts[0].count
                }
            }
        });

    } catch (error) {
        console.error('❌ Erro ao obter usuário:', error.message);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Obter todos os usuários
app.get('/api/users', async (req, res) => {
    try {
        const users = await executeQuery(
            'SELECT id, nome, email, foto_perfil, data_criacao FROM usuarios LIMIT 100',
            []
        );

        res.json({
            success: true,
            data: users
        });

    } catch (error) {
        console.error('❌ Erro ao obter usuários:', error.message);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Rota alias para compatibilidade
app.get('/api/users/todos', async (req, res) => {
    try {
        const users = await executeQuery(
            'SELECT id, nome, email, foto_perfil, data_criacao FROM usuarios LIMIT 100',
            []
        );

        res.json({
            success: true,
            data: users
        });

    } catch (error) {
        console.error('❌ Erro ao obter usuários:', error.message);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// ===== ROTAS FRONTEND =====

// Página inicial - redirecionar para home
app.get('/', (req, res) => {
    res.sendFile('html/home.html', { root: '../public' });
});

app.get('/home', (req, res) => {
    res.sendFile('html/home.html', { root: '../public' });
});

app.get('/inicial', (req, res) => {
    res.sendFile('html/home.html', { root: '../public' });
});

app.get('/login-teste', (req, res) => {
    res.sendFile('html/login-teste.html', { root: '../public' });
});

app.get('/login', (req, res) => {
    res.sendFile('html/login.html', { root: '../public' });
});

app.get('/cadastro', (req, res) => {
    res.sendFile('html/cadastro.html', { root: '../public' });
});

app.get('/feed', (req, res) => {
    res.sendFile('html/feed.html', { root: '../public' });
});

app.get('/chat', (req, res) => {
    res.sendFile('html/chat.html', { root: '../public' });
});

app.get('/profile', (req, res) => {
    res.sendFile('html/profile.html', { root: '../public' });
});

// ===== ROTAS DE CHAT =====

// Obter ou criar conversa individual
app.post('/api/chat/conversa', async (req, res) => {
    try {
        const { usuario1_id, usuario2_id } = req.body;

        if (!usuario1_id || !usuario2_id) {
            return res.status(400).json({ success: false, message: 'Ambos os IDs de usuários são obrigatórios' });
        }

        if (usuario1_id === usuario2_id) {
            return res.status(400).json({ success: false, message: 'Não é possível criar conversa com você mesmo' });
        }

        // Procurar conversa existente
        const conversa = await executeQuery(`
            SELECT DISTINCT c.id 
            FROM conversas c
            JOIN participantes_conversa p1 ON c.id = p1.conversa_id AND p1.usuario_id = ?
            JOIN participantes_conversa p2 ON c.id = p2.conversa_id AND p2.usuario_id = ?
            WHERE c.tipo = 'individual'
            LIMIT 1
        `, [usuario1_id, usuario2_id]);

        let conversa_id;

        if (conversa.length > 0) {
            conversa_id = conversa[0].id;
        } else {
            // Criar nova conversa individual
            const result = await executeQuery(
                'INSERT INTO conversas (tipo) VALUES (?)',
                ['individual']
            );
            conversa_id = result.insertId;

            // Adicionar participantes
            await executeQuery(
                'INSERT INTO participantes_conversa (conversa_id, usuario_id) VALUES (?, ?)',
                [conversa_id, usuario1_id]
            );
            await executeQuery(
                'INSERT INTO participantes_conversa (conversa_id, usuario_id) VALUES (?, ?)',
                [conversa_id, usuario2_id]
            );
        }

        res.json({ success: true, data: { conversa_id } });

    } catch (error) {
        console.error('❌ Erro ao obter/criar conversa:', error.message);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Obter conversas do usuário
app.get('/api/chat/conversas/:usuario_id', async (req, res) => {
    try {
        const usuario_id = req.params.usuario_id;

        if (!usuario_id) {
            return res.status(400).json({ success: false, message: 'ID do usuário é obrigatório' });
        }

        // Buscar conversas com último mensagem
        const conversas = await executeQuery(`
            SELECT 
                c.id,
                c.tipo,
                c.nome,
                c.data_criacao,
                u_outro.id AS outro_usuario_id,
                u_outro.nome AS outro_usuario_nome,
                u_outro.email AS outro_usuario_email,
                u_outro.foto_perfil AS outro_usuario_foto,
                u_outro.descricao AS outro_usuario_descricao,
                MAX(m.data_envio) AS ultima_mensagem_data,
                (SELECT conteudo FROM mensagens WHERE conversa_id = c.id ORDER BY data_envio DESC LIMIT 1) AS ultima_mensagem_conteudo,
                (SELECT id FROM mensagens WHERE conversa_id = c.id ORDER BY data_envio DESC LIMIT 1) AS ultima_mensagem_id,
                (SELECT usuario_id FROM mensagens WHERE conversa_id = c.id ORDER BY data_envio DESC LIMIT 1) AS ultima_mensagem_usuario_id,
                (SELECT data_envio FROM mensagens WHERE conversa_id = c.id ORDER BY data_envio DESC LIMIT 1) AS ultima_mensagem_data_envio,
                (SELECT COUNT(*) FROM mensagens WHERE conversa_id = c.id AND usuario_id != ? AND status != 'lida') AS nao_lidas
            FROM conversas c
            JOIN participantes_conversa p ON c.id = p.conversa_id AND p.status = 'ativo'
            JOIN usuarios u_outro ON u_outro.id IN (
                SELECT usuario_id FROM participantes_conversa 
                WHERE conversa_id = c.id AND usuario_id != ? AND status = 'ativo'
            )
            LEFT JOIN mensagens m ON c.id = m.conversa_id
            WHERE ? IN (SELECT usuario_id FROM participantes_conversa WHERE conversa_id = c.id AND status = 'ativo')
            GROUP BY c.id, u_outro.id
            ORDER BY ultima_mensagem_data DESC
        `, [usuario_id, usuario_id, usuario_id]);

        // Formatar resposta
        const conversas_formatadas = conversas.map(conv => {
            return {
                id: conv.id,
                tipo: conv.tipo,
                nome: conv.nome || null,
                data_criacao: conv.data_criacao,
                outro_usuario: {
                    id: conv.outro_usuario_id,
                    nome: conv.outro_usuario_nome.trim(),
                    email: conv.outro_usuario_email,
                    foto_perfil: conv.outro_usuario_foto,
                    descricao: conv.outro_usuario_descricao
                },
                ultima_mensagem: conv.ultima_mensagem_conteudo ? {
                    id: conv.ultima_mensagem_id,
                    conteudo: conv.ultima_mensagem_conteudo,
                    data_envio: conv.ultima_mensagem_data_envio,
                    usuario_id: conv.ultima_mensagem_usuario_id
                } : null,
                nao_lidas: conv.nao_lidas || 0
            };
        });

        res.json({ success: true, data: conversas_formatadas });

    } catch (error) {
        console.error('❌ Erro ao obter conversas:', error.message);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Obter mensagens de uma conversa
app.get('/api/chat/mensagens/:conversa_id', async (req, res) => {
    try {
        const conversa_id = req.params.conversa_id;
        const usuario_id = req.query.usuarioId || req.query.usuario_id;

        if (!conversa_id || !usuario_id) {
            return res.status(400).json({ success: false, message: 'Conversa ID e usuário ID são obrigatórios' });
        }

        // Buscar mensagens
        const mensagens = await executeQuery(`
            SELECT 
                m.id, m.conversa_id, m.usuario_id, m.conteudo, m.data_envio, m.status,
                u.nome as usuario_nome, u.foto_perfil as foto_perfil
            FROM mensagens m
            JOIN usuarios u ON m.usuario_id = u.id
            WHERE m.conversa_id = ?
            ORDER BY m.data_envio ASC
        `, [conversa_id]);

        // Marcar mensagens como lidas
        await executeQuery(
            'UPDATE mensagens SET status = "lida" WHERE conversa_id = ? AND usuario_id != ? AND status != "lida"',
            [conversa_id, usuario_id]
        );

        res.json({ success: true, data: mensagens });

    } catch (error) {
        console.error('❌ Erro ao obter mensagens:', error.message);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Enviar mensagem
app.post('/api/chat/enviar', async (req, res) => {
    try {
        const { conversa_id, usuario_id, conteudo } = req.body;

        if (!conversa_id || !usuario_id || !conteudo) {
            return res.status(400).json({ success: false, message: 'Conversa, usuário e conteúdo são obrigatórios' });
        }

        // Insere mensagem no banco
        const result = await executeQuery(
            'INSERT INTO mensagens (conversa_id, usuario_id, conteudo) VALUES (?, ?, ?)',
            [conversa_id, usuario_id, conteudo]
        );

        const mensagem = {
            id: result.insertId,
            conversa_id,
            usuario_id,
            conteudo,
            status: 'enviada',
            data_envio: new Date()
        };

        // Emitir via Socket.io para participantes da conversa
        io.to(`conversa_${conversa_id}`).emit('nova_mensagem', mensagem);

        res.json({ success: true, message: 'Mensagem enviada!', data: mensagem });

    } catch (error) {
        console.error('❌ Erro ao enviar mensagem:', error.message);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Buscar usuários para nova conversa
app.get('/api/chat/usuarios/buscar', async (req, res) => {
    try {
        const termo = req.query.termo;
        const usuarioId = req.query.usuarioId;

        if (!termo || termo.length < 2) {
            return res.status(400).json({ success: false, message: 'Termo deve ter pelo menos 2 caracteres' });
        }

        if (!usuarioId) {
            return res.status(400).json({ success: false, message: 'ID do usuário é obrigatório' });
        }

        // Buscar usuários que correspondem ao termo, exceto o usuário atual
        const usuarios = await executeQuery(`
            SELECT id, nome, email, foto_perfil, descricao
            FROM usuarios 
            WHERE (nome LIKE ? OR email LIKE ? OR descricao LIKE ?) AND id != ?
            LIMIT 10
        `, [`%${termo}%`, `%${termo}%`, `%${termo}%`, usuarioId]);

        res.json({ success: true, data: usuarios });

    } catch (error) {
        console.error('❌ Erro ao buscar usuários:', error.message);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Criar nova conversa individual
app.post('/api/chat/conversas/criar', async (req, res) => {
    try {
        const { usuarioId, outroUsuarioId, tipo } = req.body;

        if (!usuarioId || !outroUsuarioId) {
            return res.status(400).json({ success: false, message: 'IDs dos usuários são obrigatórios' });
        }

        if (usuarioId === outroUsuarioId) {
            return res.status(400).json({ success: false, message: 'Não é possível criar conversa com você mesmo' });
        }

        // Verificar se conversa já existe
        const conversa_existente = await executeQuery(`
            SELECT DISTINCT c.id 
            FROM conversas c
            JOIN participantes_conversa p1 ON c.id = p1.conversa_id AND p1.usuario_id = ?
            JOIN participantes_conversa p2 ON c.id = p2.conversa_id AND p2.usuario_id = ?
            WHERE c.tipo = 'individual'
            LIMIT 1
        `, [usuarioId, outroUsuarioId]);

        let conversa_id;

        if (conversa_existente.length > 0) {
            conversa_id = conversa_existente[0].id;
        } else {
            // Criar nova conversa
            const result = await executeQuery(
                'INSERT INTO conversas (tipo) VALUES (?)',
                [tipo || 'individual']
            );
            conversa_id = result.insertId;

            // Adicionar participantes
            await executeQuery(
                'INSERT INTO participantes_conversa (conversa_id, usuario_id) VALUES (?, ?)',
                [conversa_id, usuarioId]
            );
            await executeQuery(
                'INSERT INTO participantes_conversa (conversa_id, usuario_id) VALUES (?, ?)',
                [conversa_id, outroUsuarioId]
            );
        }

        res.json({ success: true, data: { id: conversa_id } });

    } catch (error) {
        console.error('❌ Erro ao criar conversa:', error.message);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Deletar conversa
app.delete('/api/chat/conversas/:conversa_id', async (req, res) => {
    try {
        const { conversa_id } = req.params;
        const { usuarioId } = req.body;

        if (!usuarioId) {
            return res.status(400).json({ success: false, message: 'ID do usuário é obrigatório' });
        }

        // Verificar se o usuário é participante da conversa
        const participante = await executeQuery(`
            SELECT id FROM participantes_conversa 
            WHERE conversa_id = ? AND usuario_id = ?
        `, [conversa_id, usuarioId]);

        if (participante.length === 0) {
            return res.status(403).json({ success: false, message: 'Acesso negado' });
        }

        // Deletar todas as mensagens da conversa
        await executeQuery('DELETE FROM mensagens WHERE conversa_id = ?', [conversa_id]);

        // Deletar participantes da conversa
        await executeQuery('DELETE FROM participantes_conversa WHERE conversa_id = ?', [conversa_id]);

        // Deletar a conversa
        await executeQuery('DELETE FROM conversas WHERE id = ?', [conversa_id]);

        console.log(`✅ Conversa ${conversa_id} deletada por usuário ${usuarioId}`);
        res.json({ success: true, message: 'Conversa deletada com sucesso' });

    } catch (error) {
        console.error('❌ Erro ao deletar conversa:', error.message);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Info da API
app.get('/api', (req, res) => {
    res.json({
        message: 'Around the World está funcionando!',
        version: '1.0.0',
        endpoints: {
            'POST /api/auth/cadastro': 'Cadastrar usuário',
            'POST /api/auth/login': 'Fazer login',
            'POST /api/posts/postar': 'Criar postagem',
            'GET /api/posts/feed': 'Obter feed',
            'POST /api/posts/curtir': 'Curtir postagem',
            'POST /api/posts/comentar': 'Comentar postagem',
            'GET /api/users/:id': 'Obter perfil de usuário',
            'GET /api/chat/conversas/:usuario_id': 'Obter conversas',
            'GET /api/chat/mensagens/:usuario_id/:outro_usuario_id': 'Obter mensagens',
            'POST /api/chat/enviar': 'Enviar mensagem'
        }
    });
});

// 404
app.use('*', (req, res) => { // Caso rota não exista
    if (req.originalUrl.startsWith('/api/')) { // Se for rota de API, retorna JSON de erro
        res.status(404).json({ success: false, message: 'Endpoint não encontrado' });
    } else {  // Caso contrário, redireciona para home
        res.sendFile('html/home.html', { root: '../public' });
    }
});

// ===== WEBSOCKET (Socket.io) =====
io.on('connection', (socket) => {
    console.log('🔌 Novo cliente conectado:', socket.id);

    // Autenticar usuário
    socket.on('authenticate', async (data) => {
        try {
            const userId = data.userId;
            socket.userId = userId;
            socket.join(`user_${userId}`);
            
            // Entrar nas salas das conversas do usuário
            const conversas = await executeQuery(`
                SELECT DISTINCT conversa_id 
                FROM participantes_conversa 
                WHERE usuario_id = ? AND status = 'ativo'
            `, [userId]);
            
            conversas.forEach(conv => {
                socket.join(`conversa_${conv.conversa_id}`);
            });
            
            console.log(`✅ Usuário ${userId} autenticado no socket e entrou em ${conversas.length} conversas`);
            socket.emit('authenticated', { success: true, userId });
        } catch (error) {
            console.error('❌ Erro na autenticação:', error);
            socket.emit('authenticated', { success: false });
        }
    });

    // Enviar mensagem
    socket.on('send_message', async (data) => {
        const { conversaId, conteudo } = data;
        
        try {
            if (!socket.userId || !conversaId || !conteudo) {
                socket.emit('erro_mensagem', { message: 'Dados incompletos' });
                return;
            }

            // Salvar no banco
            const result = await executeQuery(
                'INSERT INTO mensagens (conversa_id, usuario_id, conteudo) VALUES (?, ?, ?)',
                [conversaId, socket.userId, conteudo]
            );

            // Buscar dados do usuário
            const usuario = await executeQuery('SELECT nome, foto_perfil FROM usuarios WHERE id = ?', [socket.userId]);

            const mensagem = {
                id: result.insertId,
                conversa_id: conversaId,
                usuario_id: socket.userId,
                conteudo,
                status: 'enviada',
                data_envio: new Date(),
                usuario_nome: usuario[0]?.nome,
                foto_perfil: usuario[0]?.foto_perfil
            };

            // Enviar para todos na conversa
            io.to(`conversa_${conversaId}`).emit('new_message', mensagem);

            console.log(`✅ Mensagem enviada na conversa ${conversaId}`);
        } catch (error) {
            console.error('❌ Erro ao enviar mensagem:', error);
            socket.emit('erro_mensagem', { message: 'Erro ao enviar mensagem' });
        }
    });

    // Marcar mensagens como lidas
    socket.on('mark_as_read', async (data) => {
        try {
            const { conversaId } = data;
            
            if (!socket.userId || !conversaId) return;

            // Atualizar banco
            await executeQuery(
                'UPDATE mensagens SET status = "lida" WHERE conversa_id = ? AND usuario_id != ? AND status != "lida"',
                [conversaId, socket.userId]
            );

            // Notificar outros usuários
            io.to(`conversa_${conversaId}`).emit('messages_read', { 
                conversaId,
                userId: socket.userId 
            });

            console.log(`✅ Mensagens marcadas como lidas na conversa ${conversaId}`);
        } catch (error) {
            console.error('❌ Erro ao marcar como lida:', error);
        }
    });

    // Indicador de digitação
    socket.on('typing', (data) => {
        const { conversaId } = data;
        
        if (!socket.userId || !conversaId) return;

        io.to(`conversa_${conversaId}`).emit('user_typing', { 
            conversaId,
            userId: socket.userId 
        });

        console.log(`✍️ Usuário ${socket.userId} está digitando na conversa ${conversaId}`);
    });

    // Entrar em uma conversa
    socket.on('join_conversation', (data) => {
        const { conversaId } = data;
        socket.join(`conversa_${conversaId}`);
        console.log(`✅ Socket entrou na conversa ${conversaId}`);
    });

    // Sair de uma conversa
    socket.on('leave_conversation', (data) => {
        const { conversaId } = data;
        socket.leave(`conversa_${conversaId}`);
        console.log(`❌ Socket saiu da conversa ${conversaId}`);
    });

    // Usuário desconecta
    socket.on('disconnect', () => {
        console.log('❌ Cliente desconectado:', socket.id);
    });

    socket.on('error', (error) => {
        console.error('⚠️ Erro no socket:', error);
    });
});

// // Iniciar servidor
async function startServer() {
    try {
        // conecta ao banco
        await connectDB();

        // inicia servidor com Socket.io
        server.listen(PORT, () => {
            console.log('');
            console.log('Acesse a aplicacao em:');
            console.log('   http://localhost:3002');
            console.log('');
            console.log('Paginas disponiveis:');
            console.log('   Home:     http://localhost:3002/');
            console.log('   Login:    http://localhost:3002/login');
            console.log('   Cadastro: http://localhost:3002/cadastro');
            console.log('   Feed:     http://localhost:3002/feed (requer login)');
            console.log('   Chat:     http://localhost:3002/chat (requer login)');
            console.log('   Perfil:   http://localhost:3002/profile (requer login)');
            console.log('');
            console.log('Porta: ' + PORT);
            console.log('Banco: ATW2@localhost:3306');
            console.log('Socket.io: Conectado');
            console.log('');
        });
        // Se erro, encerra
    } catch (error) {
        console.error('Erro ao iniciar servidor:', error);
        process.exit(1);
    }
}

// Executa a função para iniciar
startServer();
