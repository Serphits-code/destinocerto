# Escopo do Projeto: Sistema de Sincronização de Arquivos com Deduplicação (Electron + Web + VPS)

**Documento de Especificação Técnica e Funcional**  
*Versão:* 1.0  
*Data:* Julho de 2026  
*Status:* Aprovado / Pronto para Desenvolvimento  

---

## 1. Visão Geral do Projeto

O **SyncCloud Deduplication System** é um ecossistema completo de sincronização e armazenamento de arquivos em tempo real. O sistema conecta clientes **Desktop (Electron)** e uma **Interface Web Responsiva** a um servidor central rodando em uma **VPS**.

O principal diferencial técnico do sistema é a **Deduplicação de Dados por Hash SHA-256 no lado do cliente**, garantindo que arquivos idênticos enviados por diferentes usuários ou mantidos em diferentes pastas ocupem espaço físico **uma única vez** no disco rígido da VPS.

### Objetivos Principais
- **Economia de Armazenamento e Banda:** Eliminar redundância física de arquivos na nuvem através de identificação por impressão digital (hash).
- **Multiplataforma:** Aplicação desktop nativa para Windows (com integração à bandeja/tray) e painel Web totalmente responsivo.
- **Controle Granular de Permissões (ACL):** Painel administrativo para criação de usuários e atribuição seletiva de pastas.
- **Interface Flutuante e Reativa:** Design minimalista com paleta em tons de azul escuro e laranja vibrante, com animações de carregamento escalonado ("construção de tela").
- **Teto Rigoroso de Armazenamento:** Imposição de cota global na VPS (ex: 20 GB) monitorada em tempo real.

---

## 2. Arquitetura de Deduplicação & Gestão de Cota

### 2.1 Princípio do Objeto Único vs. Ponteiros Lógicos

A estrutura física do sistema de arquivos na VPS é completamente desacoplada da árvore lógica de diretórios visualizada pelos usuários.

```
       ESTRUTURA LÓGICA (Usuários)                ESTRUTURA FÍSICA (VPS)
 ┌──────────────────────────────────────┐     ┌──────────────────────────────┐
 │ Usuário A: /Projetos/pdf_100mb.pdf   │────┐│                              │
 ├──────────────────────────────────────┤    ││ /storage/objects/            │
 │ Usuário B: /Documentos/manual.pdf    │────┼─► e3b0c44298fc1c149afbf4c... │
 ├──────────────────────────────────────┤    ││ (100 MB gravados em disco)  │
 │ Usuário C: /Backup/manual_v1.pdf     │────┘│                              │
 └──────────────────────────────────────┘     └──────────────────────────────┘
```

1. **Armazenamento Físico (`/storage/objects/`):**
   - Os arquivos são salvos no disco da VPS nomeados estritamente pelo seu hash SHA-256 (ex: `a1b2c3d4e5f6...bin`).
   - Não há nomes originais, extensões ou caminhos de pastas gravados diretamente no sistema de arquivos do servidor.

2. **Banco de Dados (Ponteiros Lógicos):**
   - A tabela de ponteiros mapeia: `[ID_Ponteiro, Nome_Original, Extensão, Caminho_Pasta, ID_Usuario, Hash_Fisico]`.
   - Quando 10 usuários possuem o mesmo arquivo de 100 MB, a VPS armazena **100 MB físicos** e **10 registros leves** no banco de dados.

3. **Garbage Collector (Coleta de Lixo Automatizada):**
   - Sempre que um usuário exclui um arquivo ou pasta, apenas os ponteiros no banco de dados são removidos.
   - Um serviço em segundo plano verifica ciclicamente arquivos físicos no disco que possuem **zero ponteiros vinculados**.
   - Se o número de ponteiros for zero, o arquivo físico é permanentemente deletado da VPS, liberando espaço real.

---

### 2.2 Gestão de Cota Global do Servidor

- A cota limite do ambiente é definida centralmente no arquivo `.env` da VPS (ex: `MAX_STORAGE_GB=20`).
- **Cálculo Realista:** O consumo exibido na interface representa a **soma do tamanho dos arquivos físicos desduplicados**, e não a soma virtual das pastas dos usuários.
- **Barra de Cota Dinâmica:** Exibida na barra de status do Electron e no topo do painel Web, atualizada via WebSocket a cada alteração.

---

## 3. Módulos do Sistema

### 3.1 Módulo 1: Aplicação Desktop (Electron)

#### Onboarding e Configuração Inicial
1. **Autenticação:** Tela de login com credenciais fornecidas pelo administrador.
2. **Seleção de Diretórios:**
   - **Modo Pasta Única:** Seleção de um diretório raiz no Windows (ex: `C:\Users\Cliente\SyncCloud\`).
   - **Modo Multi-Pastas:** Seleção flexível de múltiplas pastas locais em diretórios distintos para sincronização individual.

#### Engine de Sincronização em Tempo Real
- **File Watcher:** Monitoramento contínuo do sistema de arquivos local (eventos de criação, modificação, renomeação e exclusão).
- **Algoritmo de Upload:**
  ```
  [Evento Arquivo Local]
            │
            ▼
  Calcula Hash SHA-256 Local
            │
            ▼
  Envia Requisição: POST /api/v1/check-hash { hash }
            │
      ┌─────┴─────┐
      │           │
  [Existe?]   [Não Existe?]
      │           │
      │           └─► Realiza Upload em Stream (Chunks)
      │                     │
      └─────────┬───────────┘
                ▼
  Cria/Atualiza Ponteiro Lógico na VPS
  ```

#### System Tray (Bandeja do Sistema Windows)
- **Ícone Dinâmico:**
  - 🟢 *Verde / Sólido:* Tudo sincronizado.
  - 🔵 *Azul / Animado:* Sincronizando alterações em tempo real.
  - 🟠 *Laranja / Alerta:* Cota próxima do limite ou pausa manual.
  - 🔴 *Vermelho / Erro:* Erro de conexão ou falha de autenticação.
- **Menu Rápido (Pop-up no Tray):**
  - Resumo de status: "Sincronizado" ou "Enviando 3 de 12 arquivos (4.2 MB/s)".
  - Indicador visual de cota da VPS (ex: `14.2 GB / 20.0 GB`).
  - Botões rápidos: *Abrir Pasta Local*, *Acessar Painel Web*, *Pausar Sincronização*, *Configurações*.

---

### 3.2 Módulo 2: Painel Web Responsivo

- **Acesso Universal:** Totalmente acessível por navegadores modernos em Desktop, Tablet e Celular.
- **Gerenciador de Arquivos Interativo:**
  - Navegação por árvore de diretórios ou visualização em grade/lista.
  - Operações: Criar pastas, mover arquivos por *drag-and-drop*, renomear, baixar e deletar.
  - Preview nativo no navegador para imagens (PNG, JPG, WebP), PDFs e documentos de texto.
  - Streaming de download inteligente: Ao solicitar o download, a VPS localiza o arquivo físico pelo Hash e o entrega renomeado com o nome original cadastrado no ponteiro.

---

### 3.3 Módulo 3: Painel Administrativo e Controle de Acessos (ACL)

- **Gestão de Contas:**
  - Criação, edição, bloqueio de usuários e redefinição de credenciais.
- **Matriz de Permissões por Pasta:**
  - Atribuição de acesso pasta por pasta para cada usuário.
  - **Níveis de Acesso:**
    - `Sem Acesso`: A pasta e seus conteúdos não aparecem na árvore do usuário.
    - `Leitura`: O usuário pode visualizar e baixar, mas não pode subir, editar ou deletar.
    - `Leitura e Escrita`: Acesso total para sincronização bidirecional, edição e exclusão.
- **Filtragem no Client Electron:** O app Desktop sincroniza apenas as pastas às quais o usuário autenticado possui permissão de `Leitura` ou `Leitura e Escrita`.

---

### 3.4 Módulo 4: Servidor Backend & Serviços VPS

- **API RESTful + WebSockets:**
  - RESTful para autenticação, consultas de hash, upload em partes (chunking) e administração.
  - WebSockets para emissão instantânea de eventos de sincronização e atualização da barra de cota entre todos os clientes conectados.
- **Validação de Cota:** O backend bloqueia uploads imediatamente caso o tamanho total do disco físico atinja o `MAX_STORAGE_GB`.

---

## 4. Design System, UI e Experiência do Usuário (UX)

### 4.1 Identidade Visual e Paleta de Cores

A interface adota um estilo **Clean, Minimalista e Profissional**, combinando segurança tecnológica com destaque visual intuitivo.

| Aplicação | Cor / Código Hex | Descrição Visual |
| :--- | :--- | :--- |
| **Fundo Principal** | `#0D1117` / `#161B22` | Azul Marinho Profundo (Modo Escuro Suave) |
| **Superfícies / Cards** | `#21262D` | Azul Slate para containers, modais e listas |
| **Cor Primária (CTA)** | `#FF7A00` / `#FF9500` | Laranja Vibrante para botões principais e destaques |
| **Cor Secundária** | `#2F81F7` | Azul Tecnológico para links, seleções e bordas ativas |
| **Texto Principal** | `#F0F6FC` | Branco Suave para leitura sem fadiga visual |
| **Texto Secundário** | `#8B949E` | Cinza Neutro para metadados e subtextos |

---

### 4.2 Animações e Transições ("Construção de Tela")

- **Inexistência de Pop-in Abrupto:** Nenhum elemento gráfico surge repentinamente na tela.
- **Staggered Page Load (Entrada Escalonada):**
  - Ao abrir qualquer visualização, os componentes surgem em sequência fluida (sidebar → cabeçalho → lista de pastas → cards de arquivos).
  - Animação baseada em deslocamento suave no eixo Y (`translateY(12px) → translateY(0)`) acompanhada de esmaecimento (`opacity: 0 → 1`).
- **Micro-interações:**
  - Botões de upload com preenchimento interno gradativo.
  - Barras de progresso com transição de largura via `cubic-bezier(0.4, 0, 0.2, 1)`.
  - Mudança de status no tray com transição suave de cor do ícone.

---

## 5. Modelagem de Dados Conceitual

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────────┐
│      USERS       │       │     FOLDERS      │       │   PHYSICAL_OBJECTS   │
├──────────────────┤       ├──────────────────┤       ├──────────────────────┤
│ id (PK)          │       │ id (PK)          │       │ hash_sha256 (PK)     │
│ name             │       │ parent_folder_id │       │ size_bytes           │
│ email            │       │ name             │       │ created_at           │
│ password_hash    │       │ created_at       │       └──────────────────────┘
│ role (admin/user)│       └────────┬─────────┘                  ▲
└────────┬─────────┘                │                            │
         │                          │ 1                          │ 1
         │ 1                        │                            │
         │                          ▼ N                          │ N
         │                 ┌──────────────────┐                  │
         │                 │  FILE_POINTERS   │──────────────────┘
         │                 ├──────────────────┤
         │                 │ id (PK)          │
         │                 │ folder_id (FK)   │
         │                 │ user_id (FK)     │
         │                 │ original_name    │
         │                 │ file_extension   │
         │                 │ hash_sha256 (FK) │
         │                 │ created_at       │
         │                 └──────────────────┘
         │
         ▼ N
┌──────────────────┐
│   PERMISSIONS    │
├──────────────────┤
│ id (PK)          │
│ user_id (FK)     │
│ folder_id (FK)   │
│ access_level     │ (READ, READ_WRITE)
└──────────────────┘
```

---

## 6. Configurações de Ambiente (`.env`)

Exemplo de especificação das variáveis para o backend na VPS:

```env
# Servidor e Porta
PORT=3000
NODE_ENV=production

# Limites de Armazenamento (Cota Global em GB)
MAX_STORAGE_GB=20
STORAGE_PHYSICAL_PATH=/var/app/storage/objects

# Banco de Dados
DATABASE_URL=postgresql://user:password@localhost:5432/sync_cloud_db

# Segurança e Autenticação
JWT_SECRET=super_secret_jwt_key_almeida_studios
HASH_SALT_ROUNDS=12

# Sincronização em Tempo Real
WEBSOCKET_PORT=3001
```

---

## 7. Roteiro de Implementação (Roadmap)

1. **Fase 1: Infraestrutura Backend & DB (VPS)**
   - Configuração do banco de dados relacional e tabelas de ponteiros/hashes.
   - Implementação das rotas de verificação de hash (`/check-hash`), upload em chunks e download.
   - Implementação do Garbage Collector para deleção de objetos órfãos.

2. **Fase 2: Cliente Desktop (Electron)**
   - Desenvolvimento da UI minimalista com animações em CSS/JS.
   - Implementação do File Watcher local e cálculo de SHA-256 via streams de alta performance.
   - Integração com o Tray do Windows e gerenciador de estado do sync.

3. **Fase 3: Painel Web Responsivo & ACL**
   - Construção da interface Web com navegação de pastas e suporte mobile.
   - Desenvolvimento da área administrativa para gestão de usuários e permissões de pastas.

4. **Fase 4: Testes de Carga & Validação de Deduplicação**
   - Simulação de envios simultâneos do mesmo arquivo por múltiplos clientes.
   - Testes de estresse da cota global de 20 GB e resiliência de reconexão de rede.
