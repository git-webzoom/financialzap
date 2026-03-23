# 🚀 FinancialZap — Sistema de Disparos em Massa via API Oficial WhatsApp (Meta)

## 📋 Descrição

Plataforma SaaS multi-tenant para gerenciamento e disparo em massa de mensagens WhatsApp utilizando exclusivamente a **API Oficial da Meta (Cloud API)**. O sistema permite que clientes conectem suas próprias WABAs informando o Token de Acesso e o WABA ID, gerenciem templates, façam upload de contatos via CSV e realizem campanhas de disparo com divisão automática entre múltiplos templates.

---

## 🎯 Objetivo

Oferecer uma ferramenta profissional e escalável para disparos em massa no WhatsApp, com foco em:
- Conformidade total com as políticas da Meta
- Aquecimento gradual de contas novas
- Divisão inteligente de disparos entre templates
- Gestão centralizada de múltiplas WABAs e números

---

## 🏗️ Tecnologias

### Frontend
- **React** + **Vite** — Interface rápida e moderna
- **Tailwind CSS** — Estilização utilitária
- **React Router** — Navegação entre páginas
- **Axios** — Chamadas HTTP à API interna

### Backend
- **Node.js** + **Express** — Servidor da aplicação
- **BullMQ** + **Redis** — Fila de disparos com controle de rate limit
- **JWT** — Autenticação e sessões
- **Multer** — Upload de arquivos CSV

### Banco de Dados
- **SQLite** (via better-sqlite3) — Banco inicial, simples e sem necessidade de instalação no VPS

### Infraestrutura
- **VPS Linux** (Ubuntu) — Hospedagem da aplicação
- **PM2** — Gerenciamento de processos Node.js
- **Nginx** — Proxy reverso

### Integrações Externas
- **Meta Cloud API** (graph.facebook.com) — Envio de mensagens e gestão de WABAs

---

## 👥 Modelo de Negócio

**Multi-tenant SaaS** — Cada cliente possui sua própria conta no sistema e conecta suas próprias WABAs informando manualmente o Token de Acesso e o WABA ID. O sistema criptografa e armazena esses tokens com segurança para realizar chamadas à API da Meta em nome do cliente.

---

## ✅ Funcionalidades

### Autenticação
- Cadastro e login com e-mail e senha
- Recuperação de senha
- Autenticação via JWT

### Gestão de WABAs (Contas WhatsApp Business)
- Conexão de WABAs via **cadastro manual**: o usuário informa o Token de Acesso e o WABA ID
- Após salvar, o sistema chama automaticamente a API da Meta para buscar o `business_id` e `business_name` da WABA
- As WABAs são **agrupadas visualmente por BM** no painel, usando o `business_id` como agrupador
- A BM **não é uma entidade gerenciada diretamente** — é apenas um rótulo de agrupamento derivado da WABA
- Reconectar ou revogar acesso de uma WABA

**Dados exibidos de cada WABA** (tudo que a API da Meta retornar):
- Nome e ID da WABA
- Status da conta (ativa, suspensa, banida, restrita)
- Moeda e fuso horário configurados
- Alertas e restrições ativos (exibidos com destaque visual)

**Dados exibidos de cada número** (tudo que a API da Meta retornar):
- Número de telefone formatado e nome de exibição (display name)
- Status do número (ativo, pendente, banido, suspenso)
- Rating de qualidade (verde / amarelo / vermelho)
- Tier de disparo atual e limite diário:
  - Tier 1 → 1.000 disparos/dia
  - Tier 2 → 10.000 disparos/dia
  - Tier 3 → 100.000 disparos/dia
  - Tier 4 → ilimitado
- Verificação de negócio (verificado ou não)
- Alertas e restrições do número (exibidos com destaque em vermelho/laranja)
- Qualquer outro campo retornado pela API é exibido no painel

### Gestão de Templates

**Armazenamento local (cache):**
- Os templates são armazenados no banco de dados local — a página nunca chama a API da Meta diretamente para listar
- Cada template salvo localmente registra o campo `last_sync_at` (data/hora da última sincronização)
- O painel exibe: *"Última sincronização: há X horas"*
- **Sincronização automática** ocorre nos seguintes momentos:
  - Ao conectar uma WABA nova — sincroniza os templates dela imediatamente
  - Ao criar um template novo pelo sistema — salva localmente sem precisar resincronizar tudo
  - Uma vez por dia em background (job agendado)
- **Sincronização manual** — botão "Sincronizar" disponível na página de templates, chama a API da Meta e atualiza o banco local

**Listagem e status:**
- Listagem lida do banco local (rápido, sem depender da API)
- Status de aprovação de cada template (aprovado / pendente / rejeitado)
- Criação de novos templates diretamente pelo sistema

**Formulário de criação de template:**
- **Nome do template** — sem espaços, apenas letras minúsculas e underline (exigência da Meta)
- **Escolha da WABA e número** ao qual o template pertence
- **Categoria** — Marketing, Utilidade ou Autenticação (conforme opções da Meta)
- **Idioma** — seleção do idioma do template
- **Copy da mensagem** — campo de texto com as variáveis no formato `{{1}}`, `{{2}}`, etc.
  - Cada variável detectada na copy **abre automaticamente um campo de exemplo** (exigido pela Meta para aprovação)
  - Exemplo: se a copy tem `{{1}}` e `{{2}}`, aparecem dois campos: "Exemplo para {{1}}" e "Exemplo para {{2}}"
- **Mídia** (opcional) — escolha entre:
  - Imagem (upload de arquivo)
  - Vídeo (upload de arquivo)
  - Nenhuma
- **Botão** (opcional) — escolha entre:
  - Botão com link externo → campos: nome do botão + URL
  - Botão de resposta rápida → campo: texto do botão
  - Sem botão

### Disparos em Massa

O fluxo de criação de campanha é dividido em **4 etapas (wizard)**:

---

#### Etapa 1 — Upload do CSV
- Upload do arquivo CSV com os contatos
- Prévia das primeiras linhas do arquivo
- Identificação automática das colunas disponíveis

---

#### Etapa 2 — Configuração do Disparo
- **Nome da campanha**
- **Escolha da WABA e número** de origem do disparo
- **Velocidade de disparo** — quantas mensagens por segundo (respeitando o limite da Meta)
- **Tipo de disparo:**
  - Imediato — dispara assim que confirmar
  - Agendado — exibe campos de data e hora para agendar
- **Escolha de um ou mais templates** para a campanha
- **Divisão automática de contatos entre templates:**
  - Exemplo: 9.000 contatos ÷ 3 templates = 3.000 cada
  - Distribuição configurável (igual ou com pesos personalizados)

---

#### Etapa 3 — Personalização da Mensagem
Para cada template selecionado:
- **Mídia** — upload de imagem ou vídeo (somente se o template tiver mídia configurada)
- **Variáveis fixas** — campos preenchidos manualmente (mesmo valor para todos os contatos)
- **Variáveis dinâmicas do CSV** — colunas do arquivo CSV substituídas automaticamente em qualquer ponto da copy usando a sintaxe `{{nome_da_coluna}}`
  - Exemplo: `Olá, {{nome}}! Seu pedido {{cod_pedido}} está pronto.`
- O botão **não é configurado aqui** — ele já foi definido na criação do template e é exibido apenas como informação

---

#### Etapa 4 — Revisão, Teste e Confirmação
- Resumo completo de todos os dados da campanha
- **Disparo de teste** — independente da quantidade de templates selecionados, o sistema pega o primeiro template da lista e envia uma mensagem de teste para um número informado pelo usuário
- Botão **Confirmar e Disparar** para iniciar a campanha

### Histórico de Campanhas
- Lista de todas as campanhas enviadas
- Status em tempo real (em andamento / concluído / com erros)
- Relatório por campanha:
  - Total de contatos
  - Mensagens enviadas
  - Entregas confirmadas
  - Falhas e motivos
- Exportação de relatório em CSV

### Aquecimento de Números
- BMs são exibidas como agrupadores das WABAs (via `business_id`) — não são cadastradas manualmente
- Acompanhamento do status de aquecimento de cada número
- **Plano de aquecimento automático** — define o volume diário crescente e o sistema executa automaticamente
  - Exemplo de régua:
    - Dias 1-3: 100 disparos/dia
    - Dias 4-7: 300 disparos/dia
    - Dias 8-14: 700 disparos/dia
    - Dias 15-21: 2.000 disparos/dia
    - Dias 22-30: 5.000 disparos/dia
- Alertas automáticos se o rating do número cair
- Pausa automática de número com problemas
- Histórico de volume por número por dia

### Configurações
- Dados da conta do usuário
- Troca de senha
- Gerenciar WABAs conectadas

---

## 📄 Páginas do Sistema

| Página | Descrição |
|---|---|
| `/login` | Login e cadastro |
| `/dashboard` | Visão geral — disparos, status das WABAs, métricas |
| `/wabas` | WABAs agrupadas por BM (via business_id) + números conectados |
| `/templates` | Gestão e criação de templates |
| `/disparos/novo` | Wizard de criação de campanha — 4 etapas: CSV → Configuração → Personalização → Revisão e Teste |
| `/disparos/historico` | Histórico e relatórios de campanhas |
| `/aquecimento` | Plano de aquecimento por número — régua de volume diário |
| `/configuracoes` | Dados da conta e configurações gerais |

---

## 🗄️ Estrutura de Banco de Dados (Tabelas Principais)

```
users               — Contas dos clientes no SaaS
wabas               — WABAs conectadas (token criptografado, waba_id, business_id, business_name)
                      → business_id e business_name são buscados da API da Meta ao conectar
                      → usados apenas para agrupamento visual no painel
phone_numbers       — Números de cada WABA
templates           — Templates de cada WABA (cache local)
                      → campos: waba_id, template_id, nome, status, categoria, idioma,
                        estrutura completa (corpo, variáveis, mídia, botões), last_sync_at
campaigns           — Campanhas de disparo
campaign_contacts   — Contatos de cada campanha e status de envio
warming_plans       — Planos de aquecimento por número
warming_logs        — Histórico diário de volume por número
```

---

## 📡 Endpoints da Meta API Utilizados

| Ação | Endpoint |
|---|---|
| Buscar business_id da WABA | `GET /{waba-id}?fields=id,name,owner_business_info` |
| Listar números da WABA | `GET /{waba-id}/phone_numbers` |
| Listar templates da WABA | `GET /{waba-id}/message_templates` |
| Criar template | `POST /{waba-id}/message_templates` |
| Enviar mensagem | `POST /{phone-number-id}/messages` |
| Status do número | `GET /{phone-number-id}` |

---

## 🔐 Fluxo de Conexão de WABA

```
1. Usuário acessa a página WABAs
2. Informa o Token de Acesso e o WABA ID nos campos do formulário
3. Clica em "Conectar WABA"
4. Backend chama a API da Meta: GET /{waba-id}?fields=id,name,owner_business_info
5. Sistema salva no banco: token criptografado (AES-256-GCM), waba_id, business_id, business_name
6. Sistema busca automaticamente todos os números daquela WABA e salva no banco
7. Sistema sincroniza todos os templates daquela WABA para o banco local (com last_sync_at)
8. No painel, a WABA aparece agrupada sob o nome da BM correspondente
```

---

## ⚡ Fila de Disparos (BullMQ + Redis)

- Cada mensagem é um job na fila
- Worker processa respeitando o rate limit da Meta
- Reprocessamento automático em caso de falha temporária
- Prioridade por campanha e por tier do número

---

## 🚦 Regras de Negócio Importantes

- Um número novo começa no **Tier 1** (1.000 disparos/dia)
- O tier sobe automaticamente com uso saudável (Meta decide)
- Números com rating vermelho são pausados automaticamente
- Divisão de contatos entre templates é feita por fatiamento sequencial do CSV
- Tokens de acesso dos clientes são criptografados com AES-256-GCM antes de salvar no banco

---

## 📁 Estrutura de Pastas Completa

> Cada pasta tem uma responsabilidade clara. A IA e o desenvolvedor sabem exatamente onde criar e encontrar cada arquivo.

```
zapdisparo/
│
├── README.md                        ← Documentação geral do projeto
├── plan.md                          ← Plano de execução passo a passo
├── .env.example                     ← Variáveis de ambiente necessárias
├── .gitignore
│
├── frontend/                        ← Tudo que o usuário vê no navegador
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   └── src/
│       │
│       ├── main.jsx                 ← Entrada da aplicação React
│       ├── App.jsx                  ← Rotas principais (React Router)
│       │
│       ├── pages/                   ← UMA pasta por página do sistema
│       │   ├── Login/
│       │   │   └── index.jsx        ← Página de login e cadastro
│       │   ├── Dashboard/
│       │   │   └── index.jsx        ← Visão geral com métricas
│       │   ├── Wabas/
│       │   │   └── index.jsx        ← Lista de WABAs e números
│       │   ├── Templates/
│       │   │   └── index.jsx        ← Listagem e criação de templates
│       │   ├── Disparos/
│       │   │   ├── Novo/
│       │   │   │   └── index.jsx    ← Wizard de nova campanha
│       │   │   └── Historico/
│       │   │       └── index.jsx    ← Histórico e relatórios
│       │   ├── Aquecimento/
│       │   │   └── index.jsx        ← Gestão de BMs e aquecimento
│       │   └── Configuracoes/
│       │       └── index.jsx        ← Dados da conta e WABAs conectadas
│       │
│       ├── components/              ← Componentes reutilizáveis em todo o sistema
│       │   ├── Layout/
│       │   │   ├── Sidebar.jsx      ← Menu lateral de navegação
│       │   │   ├── Header.jsx       ← Cabeçalho com usuário e logout
│       │   │   └── Layout.jsx       ← Wrapper que envolve todas as páginas
│       │   ├── UI/                  ← Elementos visuais genéricos
│       │   │   ├── Button.jsx
│       │   │   ├── Input.jsx
│       │   │   ├── Modal.jsx
│       │   │   ├── Table.jsx
│       │   │   ├── Badge.jsx        ← Status coloridos (ativo/suspenso/etc)
│       │   │   ├── Card.jsx
│       │   │   └── Spinner.jsx
│       │   ├── Wabas/               ← Componentes específicos de WABAs
│       │   │   ├── WabaCard.jsx     ← Card de uma WABA com seus números
│       │   │   ├── NumeroItem.jsx   ← Item de número com rating e tier
│       │   │   └── EmbeddedSignup.jsx ← Formulário de conexão manual (Token + WABA ID)
│       │   ├── Templates/           ← Componentes específicos de templates
│       │   │   ├── TemplateCard.jsx
│       │   │   └── TemplateForm.jsx ← Formulário de criação de template
│       │   ├── Disparos/            ← Componentes do fluxo de disparo
│       │   │   ├── UploadCSV.jsx    ← Upload e prévia do arquivo
│       │   │   ├── MapearColunas.jsx ← Mapear colunas do CSV com variáveis
│       │   │   ├── SelecionarTemplates.jsx ← Escolha e divisão de templates
│       │   │   ├── PreviewMensagem.jsx ← Preview da mensagem final
│       │   │   └── ProgressoDisparo.jsx ← Barra de progresso em tempo real
│       │   └── Aquecimento/         ← Componentes do módulo de aquecimento
│       │       ├── PlanoForm.jsx    ← Formulário de régua de aquecimento
│       │       └── GraficoVolume.jsx ← Gráfico de evolução diária
│       │
│       ├── hooks/                   ← Lógica reutilizável entre componentes
│       │   ├── useAuth.js           ← Estado de autenticação (login/logout/token)
│       │   ├── useWabas.js          ← Buscar e gerenciar WABAs
│       │   ├── useTemplates.js      ← Buscar e criar templates
│       │   ├── useCampanha.js       ← Estado do wizard de disparo
│       │   └── useAquecimento.js    ← Lógica do plano de aquecimento
│       │
│       └── services/                ← Comunicação com o backend
│           ├── api.js               ← Instância do Axios com baseURL e token
│           ├── authService.js       ← Login, cadastro, logout
│           ├── wabaService.js       ← Conectar, listar, revogar WABAs
│           ├── templateService.js   ← Listar do banco local, criar na Meta e salvar local, sincronizar
│           ├── campanhaService.js   ← Criar campanha, upload CSV, status
│           └── aquecimentoService.js ← Planos e histórico de aquecimento
│
└── backend/                         ← Servidor, banco de dados e filas
    ├── server.js                    ← Entrada do servidor Express
    ├── package.json
    └── src/
        │
        ├── routes/                  ← Define os endpoints da API
        │   ├── auth.routes.js       ← /api/auth/*
        │   ├── waba.routes.js       ← /api/wabas/*
        │   ├── template.routes.js   ← /api/templates/*
        │   ├── campanha.routes.js   ← /api/campanhas/*
        │   └── aquecimento.routes.js ← /api/aquecimento/*
        │
        ├── controllers/             ← Recebe a requisição e chama o service
        │   ├── auth.controller.js
        │   ├── waba.controller.js
        │   ├── template.controller.js
        │   ├── campanha.controller.js
        │   └── aquecimento.controller.js
        │
        ├── services/                ← Lógica de negócio e regras do sistema
        │   ├── auth.service.js      ← Hash de senha, geração de JWT
        │   ├── meta.service.js      ← Todas as chamadas à API da Meta
        │   ├── waba.service.js      ← Salvar e buscar WABAs no banco
        │   ├── template.service.js  ← Criar e listar templates
        │   ├── campanha.service.js  ← Criar campanha, dividir contatos, enfileirar
        │   ├── csv.service.js       ← Ler e processar arquivos CSV
        │   └── aquecimento.service.js ← Executar plano de aquecimento diário
        │
        ├── workers/                 ← Fila de disparos em background
        │   ├── disparo.worker.js    ← Processa cada mensagem da fila
        │   └── aquecimento.worker.js ← Executa disparos agendados de aquecimento
        │
        ├── middlewares/             ← Funções que rodam antes dos controllers
        │   ├── auth.middleware.js   ← Verifica se o JWT é válido
        │   └── upload.middleware.js ← Configuração do Multer para CSV
        │
        └── db/                      ← Banco de dados SQLite
            ├── database.js          ← Conexão com o banco (better-sqlite3)
            ├── schema.sql           ← Criação de todas as tabelas
            └── migrate.js           ← Roda o schema automaticamente ao iniciar
```

---

## 📌 Versão Atual

**v0.1 — MVP**
- Foco em: conectar WABA, listar números, disparar com um template, histórico básico

**Próximas versões**
- v0.2 — Múltiplos templates com divisão automática
- v0.3 — Plano de aquecimento automatizado
- v0.4 — Criação de templates pelo sistema
- v1.0 — Multi-tenant completo, relatórios avançados
