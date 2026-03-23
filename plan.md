# 📋 Plano de Execução — FinancialZap
> Guia passo a passo para construir o sistema completo com vibe coding
> Baseado no README.md mais recente

---

## ⚙️ Passo 1 — Preparar o Ambiente Local

**O que fazer manualmente:**
- Instalar Node.js versão 20 ou superior
- Instalar Git
- Instalar o Cursor (recomendado para vibe coding) ou VS Code
- Criar a pasta raiz do projeto: `financialzap/`
- Colocar o `README.md` e o `plan.md` na raiz dessa pasta

**Por que:** O vibe coding precisa ler o README.md para entender o projeto antes de gerar qualquer código.

---

## 🗂️ Passo 2 — Criar a Estrutura de Pastas

**Prompt para o vibe code:**
> "Leia o README.md. Com base na seção 'Estrutura de Pastas Completa', crie toda a estrutura de pastas e arquivos do projeto FinancialZap, separando frontend (React + Vite + Tailwind) e backend (Node.js + Express). Crie os arquivos de configuração iniciais: package.json do frontend e do backend, vite.config.js, tailwind.config.js, .env.example com todas as variáveis necessárias para o projeto, e .gitignore. Não escreva lógica ainda — apenas a estrutura e configurações."

**Resultado esperado:**
```
financialzap/
├── README.md
├── plan.md
├── .env.example
├── .gitignore
├── frontend/
└── backend/
```

---

## 🗄️ Passo 3 — Criar o Banco de Dados SQLite

**Prompt para o vibe code:**
> "Leia o README.md, seção 'Estrutura de Banco de Dados'. Crie o arquivo `backend/src/db/schema.sql` com todas as tabelas descritas: users, wabas, phone_numbers, templates (com campo last_sync_at), campaigns, campaign_contacts, warming_plans e warming_logs. Depois crie o `backend/src/db/database.js` com a conexão usando better-sqlite3, e o `backend/src/db/migrate.js` que executa o schema automaticamente quando o servidor iniciar."

---

## 🔐 Passo 4 — Autenticação (Backend)

**Prompt para o vibe code:**
> "Leia o README.md. Crie o sistema de autenticação completo no backend. Arquivos a criar: `auth.routes.js`, `auth.controller.js` e `auth.service.js`. Rotas necessárias: POST /api/auth/register (cadastro com email e senha), POST /api/auth/login (retorna JWT), POST /api/auth/logout. Use bcrypt para hash de senha e JWT para sessão. Crie também o `auth.middleware.js` que verifica o token JWT e protege as rotas privadas."

---

## 🖥️ Passo 5 — Telas de Login e Cadastro (Frontend)

**Prompt para o vibe code:**
> "Leia o README.md. Crie as páginas de Login e Cadastro em `frontend/src/pages/Login/index.jsx`. Design escuro, moderno e profissional. Deve ter: formulário de login (email + senha), formulário de cadastro (nome + email + senha), validação de campos, mensagens de erro e sucesso, e ao fazer login salvar o JWT no localStorage. Crie também o `authService.js` em services/ para as chamadas de login e cadastro, e o `useAuth.js` em hooks/ para gerenciar o estado de autenticação. Configure o React Router no `App.jsx` com as rotas /login e /cadastro."

---

## 🏠 Passo 6 — Layout Base e Dashboard

**Prompt para o vibe code:**
> "Leia o README.md. Crie o layout base do sistema em `components/Layout/`: Sidebar.jsx com menu de navegação (Dashboard, WABAs, Templates, Disparos, Histórico, Aquecimento, Configurações), Header.jsx com nome do usuário logado e botão de logout, e Layout.jsx que envolve todas as páginas protegidas. Crie a página Dashboard em `pages/Dashboard/index.jsx` com cards mostrando: total de WABAs conectadas, total de disparos hoje, total de mensagens entregues e total de falhas. Dados podem ser mockados por enquanto."

---

## 🔧 Passo 7 — Configuração Manual na Meta *(não é vibe coding)*

**Isso é feito manualmente por você:**

1. Acessar `developers.facebook.com` e criar um App do tipo **Business**
2. Adicionar o produto **WhatsApp** ao app
3. Ativar as permissões: `whatsapp_business_messaging` e `whatsapp_business_management`
4. Anotar o **App ID** e o **App Secret**
5. Em `business.facebook.com`, criar um Usuário do Sistema e gerar um **Token do Sistema**
6. Adicionar a URL do sistema como domínio autorizado no app
7. Configurar o **Embedded Signup** no app
8. Preencher todas as variáveis no arquivo `.env` do projeto

---

## 🔗 Passo 8 — Embedded Signup e Conexão de WABA (Backend)

**Prompt para o vibe code:**
> "Leia o README.md, seção 'Fluxo de Autenticação OAuth'. Crie o backend do Embedded Signup. Arquivos: `waba.routes.js`, `waba.controller.js`, `waba.service.js` e `meta.service.js`. Ao receber o token OAuth via POST /api/wabas/connect, o sistema deve: 1) Chamar a API da Meta para buscar o business_id e business_name da WABA usando o endpoint GET /{waba-id}?fields=id,name,owner_business_info. 2) Salvar no banco: token criptografado, waba_id, business_id, business_name. 3) Buscar e salvar todos os números daquela WABA. 4) Sincronizar os templates daquela WABA para o banco local com last_sync_at. Todas as chamadas à API da Meta ficam centralizadas em meta.service.js."

---

## 📱 Passo 9 — Embedded Signup (Frontend) e Página de WABAs

**Prompt para o vibe code:**
> "Leia o README.md, seção 'Gestão de WABAs'. Crie o componente `EmbeddedSignup.jsx` com o botão que abre o popup OAuth da Meta usando o App ID do .env. Após o cliente autorizar, envia o token para o backend. Crie a página `pages/Wabas/index.jsx` que lista as WABAs agrupadas por BM (usando business_name como cabeçalho de grupo). Para cada WABA exibir todos os dados retornados pela API: nome, ID, status, moeda, fuso horário, alertas e restrições com destaque visual. Para cada número exibir: telefone, display name, status, rating de qualidade (verde/amarelo/vermelho), tier atual com limite diário, verificação de negócio, alertas e restrições em vermelho/laranja. Crie os componentes `WabaCard.jsx` e `NumeroItem.jsx`."

---

## 📝 Passo 10 — Gestão de Templates (Backend)

**Prompt para o vibe code:**
> "Leia o README.md, seção 'Gestão de Templates'. Crie o backend de templates. Arquivos: `template.routes.js`, `template.controller.js` e `template.service.js`. Funcionalidades: GET /api/templates — lê do banco local (nunca da API diretamente). POST /api/templates — cria o template na API da Meta e salva localmente. POST /api/templates/sync/:wabaId — chama a API da Meta, atualiza todos os templates daquela WABA no banco e atualiza last_sync_at. Criar também um job agendado (cron) que roda uma vez por dia sincronizando todos os templates de todas as WABAs ativas."

---

## 📝 Passo 11 — Página de Templates (Frontend)

**Prompt para o vibe code:**
> "Leia o README.md, seção 'Gestão de Templates'. Crie a página `pages/Templates/index.jsx` que lista todos os templates do banco local, com filtro por WABA. Mostrar para cada template: nome, status de aprovação (aprovado/pendente/rejeitado), categoria e idioma. Exibir no topo: 'Última sincronização: há X horas' com botão 'Sincronizar'. Crie o componente `TemplateCard.jsx`. Crie também o formulário de criação de template em `TemplateForm.jsx` com os campos: nome do template (validar formato: letras minúsculas e underline), WABA e número, categoria, idioma, copy da mensagem com variáveis {{1}} {{2}} etc — cada variável detectada deve abrir automaticamente um campo de exemplo, escolha de mídia (imagem/vídeo/nenhuma), e botão (link externo com nome+URL, resposta rápida, ou sem botão). Criar o `useTemplates.js` e `templateService.js`."

---

## 📤 Passo 12 — Upload e Leitura de CSV (Backend)

**Prompt para o vibe code:**
> "Leia o README.md. Crie o sistema de upload de CSV. Arquivos: `upload.middleware.js` (configuração do Multer para aceitar CSV), `csv.service.js` (ler o arquivo, identificar colunas automaticamente, retornar as primeiras 5 linhas como prévia) e a rota POST /api/campanhas/upload-csv no `campanha.routes.js`. O retorno deve incluir: lista de colunas identificadas e prévia das primeiras 5 linhas."

---

## ⚙️ Passo 13 — Lógica de Divisão de Contatos entre Templates

**Prompt para o vibe code:**
> "Leia o README.md, seção 'Etapa 2 — Configuração do Disparo'. Crie a função de divisão de contatos em `campanha.service.js`. A lógica é: total de contatos dividido pelo número de templates selecionados, distribuídos sequencialmente. Se não dividir exato, os contatos restantes vão para o último template. Suportar também divisão por peso personalizado, onde o usuário define manualmente a porcentagem de cada template. Criar testes simples para validar os dois modos."

---

## 🧙 Passo 14 — Wizard de Novo Disparo (Frontend)

**Prompt para o vibe code:**
> "Leia o README.md, seção 'Disparos em Massa' com as 4 etapas. Crie o wizard em `pages/Disparos/Novo/index.jsx` controlado pelo hook `useCampanha.js`. Etapa 1 — Upload CSV: componente `UploadCSV.jsx` com drag-and-drop, prévia das primeiras linhas e lista de colunas identificadas. Etapa 2 — Configuração: campos de nome da campanha, escolha de WABA e número, velocidade de disparo (msgs/seg), tipo imediato ou agendado (com campos de data e hora se agendado), seleção de um ou mais templates, e configuração da divisão (igual ou por peso). Etapa 3 — Personalização: para cada template selecionado, exibir upload de mídia (se o template tiver mídia), campos de variáveis fixas e mapeamento de variáveis dinâmicas do CSV com sintaxe {{nome_da_coluna}}, e exibir o botão do template como informação somente leitura. Etapa 4 — Revisão: resumo completo, campo de número para teste, botão 'Enviar Teste' (usa o primeiro template da lista), e botão 'Confirmar e Disparar'. Criar os componentes: `MapearColunas.jsx`, `SelecionarTemplates.jsx`, `PreviewMensagem.jsx`."

---

## ⚡ Passo 15 — Fila de Disparos (BullMQ + Redis)

**Prompt para o vibe code:**
> "Leia o README.md, seção 'Fila de Disparos'. Instale e configure BullMQ + Redis no backend. Crie o `disparo.worker.js` que processa cada job da fila chamando a API da Meta para enviar a mensagem. Implementar: rate limiting de acordo com a velocidade configurada pelo usuário na campanha, reprocessamento automático em caso de falha temporária (até 3 tentativas com backoff exponencial), e atualização do status de cada contato em campaign_contacts após o envio. Criar a rota POST /api/campanhas que recebe os dados finais da campanha, salva no banco, e enfileira todos os contatos como jobs no BullMQ. Criar GET /api/campanhas/:id/status que retorna o progresso em tempo real."

---

## 📊 Passo 16 — Histórico de Campanhas

**Prompt para o vibe code:**
> "Leia o README.md, seção 'Histórico de Campanhas'. Crie a página `pages/Disparos/Historico/index.jsx` com a lista de campanhas enviadas. Para cada campanha exibir: nome, data, WABA e número usado, total de contatos, enviados, entregues, falhas e status geral (em andamento / concluído / com erros). Ao clicar em uma campanha abrir o relatório detalhado com a lista de contatos e o status individual de cada um. Adicionar botão de exportar o relatório em CSV. Criar o componente `ProgressoDisparo.jsx` que atualiza o progresso em tempo real via polling enquanto a campanha estiver em andamento."

---

## 🔥 Passo 17 — Módulo de Aquecimento

**Prompt para o vibe code:**
> "Leia o README.md, seção 'Aquecimento de Números'. Crie o backend do módulo de aquecimento: `aquecimento.routes.js`, `aquecimento.controller.js`, `aquecimento.service.js` e `aquecimento.worker.js`. O worker roda diariamente e executa os disparos de aquecimento de cada número conforme a régua definida, registrando o volume em warming_logs. Crie a página `pages/Aquecimento/index.jsx` com: lista de números com seu status de aquecimento atual (frio/morno/quente), formulário `PlanoForm.jsx` para definir a régua de volume por dia, e gráfico `GraficoVolume.jsx` mostrando a evolução diária do volume de cada número."

---

## 🔔 Passo 18 — Monitoramento de Qualidade dos Números

**Prompt para o vibe code:**
> "Leia o README.md, seção 'Aquecimento de Números'. Crie um job cron que roda a cada hora verificando via API da Meta o rating de qualidade de todos os números ativos. Se um número cair para rating vermelho: pausar automaticamente as campanhas em andamento desse número, registrar o alerta no banco, e exibir um alerta visual em destaque no painel de WABAs. Registrar histórico de mudanças de rating na tabela phone_numbers."

---

## ⚙️ Passo 19 — Página de Configurações

**Prompt para o vibe code:**
> "Leia o README.md, seção 'Configurações'. Crie a página `pages/Configuracoes/index.jsx` com três seções: 1) Dados da conta — formulário para editar nome e email. 2) Troca de senha — formulário com senha atual, nova senha e confirmação. 3) WABAs conectadas — lista das WABAs com opção de revogar acesso de cada uma individualmente."

---

## 🌐 Passo 20 — Deploy no VPS

**Prompt para o vibe code:**
> "Crie um script `deploy.sh` para VPS Ubuntu. O script deve: fazer o build do frontend com Vite, copiar os arquivos para a pasta correta, configurar o PM2 para rodar o backend em modo produção, e criar o arquivo de configuração do Nginx como proxy reverso (frontend na porta 80/443 e backend na porta 3001). Criar também o arquivo `ecosystem.config.js` do PM2 com as variáveis de ambiente."

**Passos manuais no VPS:**
1. Apontar o domínio para o IP do VPS
2. Instalar Node.js, Redis, Nginx e PM2 no VPS
3. Clonar o repositório
4. Configurar o `.env` com as variáveis reais
5. Rodar o `deploy.sh`
6. Instalar SSL com Certbot: `certbot --nginx -d seudominio.com`

---

## 🧪 Passo 21 — Testes e Validação Final

**Checklist para validar antes de considerar o sistema pronto:**

- [ ] Cadastro e login funcionando
- [ ] Embedded Signup conectando uma WABA real
- [ ] Painel de WABAs exibindo todos os dados da API agrupados por BM
- [ ] Templates sincronizando do banco local, botão de sincronizar funcionando
- [ ] Criação de template enviando para a Meta e salvando local
- [ ] Upload de CSV identificando colunas corretamente
- [ ] Wizard de disparo completo — todas as 4 etapas
- [ ] Disparo de teste usando o primeiro template
- [ ] Divisão de contatos entre templates funcionando
- [ ] Fila processando os disparos respeitando a velocidade configurada
- [ ] Histórico atualizando em tempo real
- [ ] Exportação de relatório CSV funcionando
- [ ] Aquecimento respeitando a régua diária
- [ ] Alerta automático quando número cai para rating vermelho
- [ ] Sistema rodando no VPS com HTTPS

---

## 📦 Ordem de Prioridade — MVP Primeiro

Se quiser lançar rápido, execute nessa ordem:

```
✅ Passos 1 a 6   → Base do projeto funcionando localmente
✅ Passo 7        → Configuração manual na Meta (obrigatório antes de qualquer integração)
✅ Passos 8 e 9   → Conectar WABA e ver painel completo de WABAs e números
✅ Passos 10 e 11 → Templates com cache local e sincronização
✅ Passos 12 a 15 → Upload CSV + wizard completo + fila de disparos
✅ Passo 16       → Histórico básico
✅ Passo 20       → Deploy no VPS
```

Depois do MVP no ar, volte e implemente na ordem:
- Passo 17 — Aquecimento
- Passo 18 — Monitoramento de qualidade
- Passo 19 — Configurações

---

## 💡 Dicas para o Vibe Coding

1. **Sempre mostre o README.md antes de começar qualquer passo** — jogue o arquivo no contexto do AI
2. **Um passo por vez** — nunca tente fazer dois passos no mesmo prompt
3. **Teste antes de avançar** — rode o sistema depois de cada passo antes de ir para o próximo
4. **Se o AI travar**, diga: *"explica o que esse arquivo faz antes de continuar"*
5. **Guarde os prompts que funcionaram** — vai reutilizar em projetos futuros
6. **Nomenclatura consistente** — o README define os nomes dos arquivos, siga exatamente os nomes documentados
