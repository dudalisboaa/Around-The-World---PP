
# 🌍 Around the World

**Around the World** é uma aplicação web voltada para o **turismo solo**, desenvolvida com o objetivo de **conectar viajantes desacompanhados** que desejam encontrar parceiros de viagem, formar grupos, compartilhar itinerários e trocar experiências de maneira segura e interativa.

O sistema oferece **cadastro e login de usuários, criação de postagens, chat em tempo real, perfis personalizáveis e integração completa com banco de dados MySQL**, unindo tecnologia, turismo e interação social em um único ambiente digital.

---

## 💻 Demonstração

🗺️ **Around the World Logo**

*<img width="636" height="480" alt="image" src="https://github.com/user-attachments/assets/1f66c0cc-61aa-41c1-81ff-5b741f2d2456" />
*

---

## 📁 Estrutura do Projeto

```
AROUNDTHEWORLD/
├── backend/                # Servidor Node.js (API + Chat)
│   ├── server.js           # Servidor principal Express + Socket.io
│   ├── db.js               # Conexão MySQL e funções de consulta
│   ├── db.sql              # Banco de dados utilizado
│
├── frontend/               # Interface do usuário (HTML, CSS, JS)
│   ├── html/               # Páginas principais (home, feed, chat, perfil)
│   ├── css/                # Estilos de cada página
│   ├── js/                 # Scripts de interação com a API
│   ├── assets/             # Imagens, ícones e recursos visuais
│   └── uploads/            # Upload de imagens de usuários e postagens
│
└── README.md               # Documentação do projeto
```

---

## 🚀 Tecnologias Utilizadas

### 🔧 **Backend**

* **Node.js** >= 16.0.0 — Ambiente de execução do servidor
* **Express** ^4.18.2 — Framework para criação das rotas HTTP
* **MySQL2** ^3.6.0 — Conexão e manipulação do banco de dados
* **Socket.io** ^4.8.1 — Comunicação em tempo real (chat)
* **bcrypt** — Criptografia de senhas
* **CORS / body-parser / express.json()** — Controle e tratamento de requisições
* **Nodemon** — Hot reload durante o desenvolvimento

### 🎨 **Frontend**

* **HTML** — Estrutura das páginas
* **CSS** — Estilo e responsividade
* **JavaScript (Vanilla)** — Lógica e integração com a API
* **Socket.io Client** — Chat em tempo real no navegador
* **Figma** — Protótipo visual e design da interface

### 🗄️ **Banco de Dados**

* **MySQL** — Banco relacional para armazenamento de dados de usuários, postagens e interações

---

## ⚙️ Instalação e Execução

### 1️⃣ Clone o repositório

```bash
git clone https://github.com/dudalisboaa/Around-The-World---PP.git
cd ATW-PP/backend
```

### 2️⃣ Instale as dependências

```bash
npm install
```

### 3️⃣ Configure o banco de dados MySQL

Crie o banco de dados manualmente ou deixe que o sistema crie as tabelas ao iniciar:

```sql
CREATE DATABASE ATW;
USE ATW;
```

Edite o arquivo `db.js` com suas credenciais do MySQL:

```js
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'sua_senha',
  database: 'ATW3',
  port: 3306,
  charset: 'utf8mb4'
};
```

### 4️⃣ Inicie o servidor

Em produção:

```bash
npm start
```

## 🧠 Funcionalidades

### 👤 Usuários

* 📝 Cadastro e login seguro com `bcrypt`
* ✏️ Edição de perfil (nome, e-mail, senha, preferências)
* 🖼️ Upload de fotos de perfil
* 🔍 Pesquisa de outros viajantes
* 🔒 Sistema de autenticação e validação de credenciais

### 🌍 Viagens e Postagens

* 📸 Criação de postagens com título, imagem e comentário
* 🗺️ Compartilhamento de itinerários de viagem
* ❤️ Curtir e 💬 comentar em publicações
* 🗑️ Exclusão de postagens próprias

### 💬 Chat em Tempo Real

* 💌 Conversas privadas entre usuários
* 🔔 Notificação de novas mensagens
* 👥 Criação de grupos de conversa
* 🕓 Indicador de mensagem enviada/lida

### 🧭 Experiência do Usuário

* Interface leve, intuitiva e responsiva
* Página principal com feed de viagens
* Pop-ups interativos para comentários e curiosidades
* Conexão direta entre viajantes com interesses semelhantes

---

## 🔌 Endpoints da API

| Método         | Endpoint            | Descrição                          |
| -------------- | ------------------- | ---------------------------------- |
| **POST**       | `/register`         | Cadastrar novo usuário             |
| **POST**       | `/login`            | Autenticar usuário                 |
| **GET**        | `/users`            | Listar todos os usuários           |
| **GET**        | `/users/:id`        | Buscar usuário por ID              |
| **PUT**        | `/users/:id`        | Atualizar informações de perfil    |
| **DELETE**     | `/users/:id`        | Excluir usuário                    |
| **POST**       | `/posts`            | Criar nova postagem                |
| **GET**        | `/posts`            | Listar postagens                   |
| **PUT**        | `/posts/:id`        | Editar postagem                    |
| **DELETE**     | `/posts/:id`        | Remover postagem                   |
| **POST**       | `/comments`         | Criar comentário                   |
| **GET**        | `/comments/:postId` | Listar comentários de uma postagem |
| **/socket.io** | *(WebSocket)*       | Canal de chat em tempo real        |

---

## 🗃️ Estrutura do Banco de Dados

-- Criar o banco de dados se não existir e usar 
CREATE DATABASE IF NOT EXISTS ATW2;
USE ATW2;

-- Habilitar verificação de chaves estrangeiras
SET FOREIGN_KEY_CHECKS = 1;

-- Tabela de usuários (tabela principal)
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    descricao TEXT,
    foto_perfil TEXT,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de postagens
CREATE TABLE IF NOT EXISTS postagens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    conteudo TEXT NOT NULL,
    imagem TEXT,
    curtidas INT DEFAULT 0,
    comentarios INT DEFAULT 0,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de comentários
CREATE TABLE IF NOT EXISTS comentarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    postagem_id INT NOT NULL,
    usuario_id INT NOT NULL,
    conteudo TEXT NOT NULL,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (postagem_id) REFERENCES postagens(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de curtidas
CREATE TABLE IF NOT EXISTS curtidas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    postagem_id INT NOT NULL,
    usuario_id INT NOT NULL,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_curtida (postagem_id, usuario_id),
    FOREIGN KEY (postagem_id) REFERENCES postagens(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Selecionar todos os usuários cadastrados (para visualização)
SELECT id, nome, email, descricao, foto_perfil, data_criacao
FROM usuarios 
ORDER BY data_criacao DESC;

-- Tabela de conversas (chats)
CREATE TABLE IF NOT EXISTS conversas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100), -- Nome do grupo (se for chat em grupo)
    tipo ENUM('individual', 'grupo') DEFAULT 'individual',
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de participantes das conversas
CREATE TABLE IF NOT EXISTS participantes_conversa (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversa_id INT NOT NULL,
    usuario_id INT NOT NULL,
    data_entrada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('ativo', 'saiu', 'banido') DEFAULT 'ativo',
    FOREIGN KEY (conversa_id) REFERENCES conversas(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    UNIQUE KEY unique_participante (conversa_id, usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de mensagens
CREATE TABLE IF NOT EXISTS mensagens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversa_id INT NOT NULL,
    usuario_id INT NOT NULL,
    conteudo TEXT NOT NULL,
    data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('enviada', 'entregue', 'lida', 'excluida') DEFAULT 'enviada',
    FOREIGN KEY (conversa_id) REFERENCES conversas(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mostrar estatísticas básicas
SELECT 
    (SELECT COUNT(*) FROM usuarios) as 'Total de Usuários',
    (SELECT COUNT(*) FROM postagens) as 'Total de Postagens',
    (SELECT COUNT(*) FROM comentarios) as 'Total de Comentários',
    (SELECT COUNT(*) FROM curtidas) as 'Total de Curtidas',
    (SELECT COUNT(*) FROM conversas) as 'Total de Conversas',
    (SELECT COUNT(*) FROM mensagens) as 'Total de Mensagens';

-- Mostrar mensagem de sucesso
SELECT 'Banco de dados NetworkUp configurado com sucesso!' as STATUS;

-- 

## 🔧 Requisitos de Sistema

* **Node.js** >= 16.0.0
* **MySQL** >= 5.7
* **Navegador moderno** com suporte a ES6
* Porta **3000** disponível

---


Deseja que eu gere agora o **arquivo `README.md` pronto para download**, já formatado em Markdown (com emojis, tabelas e blocos de código prontos para o GitHub)?

