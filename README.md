# Destino Certo - Sistema de Sincronização & Deduplicação por Hash (VPS + Web)

Sistema corporativo de alto desempenho com **deduplicação por HASH SHA-256 no lado do cliente**, ponteiros lógicos, controle de acesso ACL granular, cota de armazenamento e servidor WebSocket para sincronização em tempo real.

---

## 🚀 Estrutura do Repositório

```text
destinocerto/
├── backend/            # API REST (Express + Prisma SQLite + WebSockets + Deduplicação)
├── frontend-web/       # Painel Web Responsivo (Vite + React + TypeScript + Windows Fluent UI)
├── logo/               # Identidade Visual e Arquivos SVG (dcl.svg)
├── .env.example        # Modelo de variáveis de ambiente
└── package.json        # Scripts raiz do projeto
```

---

## 📋 Passo a Passo para Instalação e Execução na VPS (Linux/Ubuntu)

### 1. Conectar na VPS via SSH e Criar a Pasta do Projeto

```bash
# Conectar na VPS
ssh usuario@ip-da-sua-vps

# Atualizar pacotes do sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20+ e Git (caso não estejam instalados)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential
```

### 2. Clonar o Repositório do GitHub

```bash
# Navegar para o diretório de hospedagem (ex: /var/www ou /home/usuario)
cd /var/www

# Clonar o repositório oficial
git clone https://github.com/Serphits-code/destinocerto.git

# Entrar na pasta do projeto
cd destinocerto
```

### 3. Configurar as Variáveis de Ambiente

```bash
# Copiar o modelo .env para o backend
cp .env.example backend/.env

# (Opcional) Editar as variáveis se desejar alterar porta ou cota
nano backend/.env
```

*Conteúdo do `backend/.env`:*
```env
PORT=3000
MAX_STORAGE_GB=20
DATABASE_URL="file:./sync_cloud.db"
JWT_SECRET="destinocerto_vps_secure_token_key_2026"
```

### 4. Instalar Dependências e Inicializar o Banco de Dados

```bash
# Instalar dependências do Backend e Frontend
npm --prefix backend install
npm --prefix frontend-web install

# Gerar tabelas e semear o banco SQLite
cd backend
npx prisma generate
npx prisma db push
npm run db:seed
cd ..
```

### 5. Compilar o Frontend Web

```bash
# Build de produção do Frontend
npm --prefix frontend-web run build
```

### 6. Executar o Servidor na VPS (usando PM2)

Para manter o servidor rodando 24/7 na VPS mesmo após fechar o terminal SSH:

```bash
# Instalar o gerenciador de processos PM2 globalmente
sudo npm install -g pm2

# Iniciar o servidor Backend com PM2
cd /var/www/destinocerto/backend
pm2 start npm --name "destinocerto-backend" -- run dev

# Salvar processos para iniciar com a VPS
pm2 save
pm2 startup
```

---

## 🛠️ Comandos Rápidos na VPS

- **Verificar Status do Servidor**: `pm2 status`
- **Ver Logs em Tempo Real**: `pm2 logs destinocerto-backend`
- **Reiniciar Servidor**: `pm2 restart destinocerto-backend`
- **Atualizar Código (Git Pull)**:
  ```bash
  git pull origin main
  cd backend && npx prisma db push && cd ..
  pm2 restart destinocerto-backend
  ```
