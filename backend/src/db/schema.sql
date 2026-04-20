-- FinancialZap — Schema SQLite
-- Executado automaticamente por migrate.js na inicialização do servidor.
-- PRAGMA foreign_keys é ativado no database.js (conexão), não aqui.

-- ─── users ────────────────────────────────────────────────────────────────────
-- Contas dos clientes no SaaS.
CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT    UNIQUE NOT NULL,
  password_hash TEXT   NOT NULL,
  name         TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─── wabas ────────────────────────────────────────────────────────────────────
-- WABAs conectadas via Embedded Signup OAuth.
-- access_token_enc: token OAuth criptografado com AES-256 (ver auth.service.js).
-- business_id / business_name: buscados da API da Meta após o OAuth e usados
-- apenas para agrupamento visual — não são entidades gerenciadas diretamente.
CREATE TABLE IF NOT EXISTS wabas (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL,
  waba_id          TEXT    UNIQUE NOT NULL,
  name             TEXT,
  access_token_enc TEXT    NOT NULL,
  business_id      TEXT,
  business_name    TEXT,
  currency         TEXT,
  timezone         TEXT,
  status           TEXT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wabas_user_id    ON wabas(user_id);
CREATE INDEX IF NOT EXISTS idx_wabas_business_id ON wabas(business_id);

-- ─── phone_numbers ────────────────────────────────────────────────────────────
-- Números de telefone de cada WABA, sincronizados da API da Meta.
CREATE TABLE IF NOT EXISTS phone_numbers (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  waba_id              TEXT NOT NULL,
  phone_number_id      TEXT UNIQUE NOT NULL,
  display_phone_number TEXT,
  verified_name        TEXT,
  quality_rating       TEXT,   -- GREEN | YELLOW | RED
  messaging_limit_tier TEXT,   -- TIER_1 | TIER_2 | TIER_3 | TIER_4
  status               TEXT,   -- CONNECTED | FLAGGED | RESTRICTED | etc.
  is_verified_business INTEGER DEFAULT 0,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (waba_id) REFERENCES wabas(waba_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_phone_numbers_waba_id ON phone_numbers(waba_id);

-- ─── templates ────────────────────────────────────────────────────────────────
-- Cache local dos templates de cada WABA.
-- structure: JSON completo retornado pela Meta (corpo, variáveis, mídia, botões).
-- last_sync_at: atualizado a cada sincronização — exibido no painel como
--   "Última sincronização: há X horas".
CREATE TABLE IF NOT EXISTS templates (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  waba_id          TEXT NOT NULL,
  template_id      TEXT NOT NULL,
  name             TEXT NOT NULL,
  status           TEXT,           -- APPROVED | PENDING | REJECTED
  category         TEXT,           -- MARKETING | UTILITY | AUTHENTICATION
  language         TEXT,
  structure        TEXT,           -- JSON serializado
  quality_score    TEXT,           -- GREEN | YELLOW | RED | UNKNOWN (quality_score.score da Meta)
  rejected_reason  TEXT,           -- motivo de rejeição (rejected_reason da Meta)
  last_sync_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (waba_id, template_id),
  FOREIGN KEY (waba_id) REFERENCES wabas(waba_id) ON DELETE CASCADE
);


CREATE INDEX IF NOT EXISTS idx_templates_waba_id ON templates(waba_id);
CREATE INDEX IF NOT EXISTS idx_templates_status  ON templates(status);

-- ─── campaigns ────────────────────────────────────────────────────────────────
-- Campanhas de disparo em massa.
CREATE TABLE IF NOT EXISTS campaigns (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL,
  name             TEXT    NOT NULL,
  waba_id          TEXT    NOT NULL,
  phone_number_id  TEXT    NOT NULL,
  status           TEXT    DEFAULT 'pending',   -- pending | running | done | failed
  speed_per_second INTEGER DEFAULT 1,
  scheduled_at     DATETIME,
  total_contacts   INTEGER DEFAULT 0,
  sent             INTEGER DEFAULT 0,
  delivered        INTEGER DEFAULT 0,
  read_count       INTEGER DEFAULT 0,
  failed           INTEGER DEFAULT 0,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)         REFERENCES users(id)          ON DELETE CASCADE,
  FOREIGN KEY (waba_id)         REFERENCES wabas(waba_id)     ON DELETE RESTRICT,
  FOREIGN KEY (phone_number_id) REFERENCES phone_numbers(phone_number_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status  ON campaigns(status);

-- ─── campaign_contacts ────────────────────────────────────────────────────────
-- Contatos individuais de cada campanha e status de envio de cada mensagem.
-- variables: JSON com os valores das variáveis dinâmicas do template.
CREATE TABLE IF NOT EXISTS campaign_contacts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id   INTEGER NOT NULL,
  phone         TEXT    NOT NULL,
  template_id   TEXT    NOT NULL,
  variables     TEXT,           -- JSON serializado: {"1": "João", "2": "123"}
  media_url     TEXT,           -- URL de mídia do header (IMAGE/VIDEO/DOCUMENT), se houver
  status        TEXT    DEFAULT 'pending',  -- pending | sent | delivered | read | failed | cancelled
  error_message TEXT,
  sent_at       DATETIME,
  wamid         TEXT,
  delivered_at  DATETIME,
  read_at       DATETIME,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign_id ON campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status      ON campaign_contacts(status);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_wamid       ON campaign_contacts(wamid);

-- ─── warming_plans ────────────────────────────────────────────────────────────
-- Planos de aquecimento por número.
-- schedule: JSON com a régua de volume diário.
--   Exemplo: [{"day_start":1,"day_end":3,"volume":100}, {"day_start":4,...}]
CREATE TABLE IF NOT EXISTS warming_plans (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number_id TEXT    NOT NULL,
  user_id         INTEGER NOT NULL,
  schedule        TEXT    NOT NULL,  -- JSON serializado
  active          INTEGER DEFAULT 1,
  started_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (phone_number_id) REFERENCES phone_numbers(phone_number_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)         REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_warming_plans_phone_number_id ON warming_plans(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_warming_plans_user_id         ON warming_plans(user_id);

-- ─── warming_logs ─────────────────────────────────────────────────────────────
-- Histórico diário de volume disparado por número (um registro por dia).
-- date: formato ISO 8601 (YYYY-MM-DD).
CREATE TABLE IF NOT EXISTS warming_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number_id TEXT    NOT NULL,
  date            TEXT    NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  volume          INTEGER DEFAULT 0,
  UNIQUE (phone_number_id, date),
  FOREIGN KEY (phone_number_id) REFERENCES phone_numbers(phone_number_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_warming_logs_phone_number_id ON warming_logs(phone_number_id);

-- ─── kanban_columns ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kanban_columns (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  title      TEXT    NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  color      TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kanban_columns_user_id ON kanban_columns(user_id);

-- ─── bm_cards ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bm_cards (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL,
  column_id      INTEGER NOT NULL,
  position       INTEGER NOT NULL DEFAULT 0,
  profile_name   TEXT,
  supplier       TEXT,
  bm_id          TEXT,
  bm_name        TEXT,
  waba_id        TEXT,
  waba_name      TEXT,
  phone_number   TEXT,
  notes          TEXT,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)   REFERENCES users(id)          ON DELETE CASCADE,
  FOREIGN KEY (column_id) REFERENCES kanban_columns(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bm_cards_user_id   ON bm_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_bm_cards_column_id ON bm_cards(column_id);

-- ─── bm_card_wabas ────────────────────────────────────────────────────────────
-- WABAs vinculadas a um card de BM (N:1 com bm_cards).
CREATE TABLE IF NOT EXISTS bm_card_wabas (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id   INTEGER NOT NULL,
  waba_id   TEXT,
  waba_name TEXT,
  FOREIGN KEY (card_id) REFERENCES bm_cards(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bm_card_wabas_card_id ON bm_card_wabas(card_id);

-- ─── bm_card_phones ───────────────────────────────────────────────────────────
-- Números vinculados a cada WABA de um card.
CREATE TABLE IF NOT EXISTS bm_card_phones (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  card_waba_id INTEGER NOT NULL,
  phone_number TEXT    NOT NULL,
  FOREIGN KEY (card_waba_id) REFERENCES bm_card_wabas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bm_card_phones_waba_id ON bm_card_phones(card_waba_id);

-- ─── number_inventory ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS number_inventory (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  phone_number TEXT    NOT NULL,
  origin       TEXT    NOT NULL CHECK (origin IN ('own', 'rented')),
  supplier     TEXT,
  bm_name      TEXT,
  waba_name    TEXT,
  status       TEXT    NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'in_use', 'reserved')),
  notes        TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_number_inventory_user_id ON number_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_number_inventory_status  ON number_inventory(status);
CREATE INDEX IF NOT EXISTS idx_number_inventory_origin  ON number_inventory(origin);

-- ─── number_automations ───────────────────────────────────────────────────────
-- Automações vinculadas a um número do inventário.
-- Um número pode ter N automações, cada uma com seu próprio template.
CREATE TABLE IF NOT EXISTS number_automations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  number_id       INTEGER NOT NULL,
  automation_name TEXT    NOT NULL,
  template_name   TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (number_id) REFERENCES number_inventory(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_number_automations_number_id ON number_automations(number_id);

-- ─── number_health_logs ───────────────────────────────────────────────────────
-- Histórico de eventos de saúde de cada número do inventário.
CREATE TABLE IF NOT EXISTS number_health_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  number_id   INTEGER NOT NULL,
  event_type  TEXT    NOT NULL CHECK (event_type IN (
                'banned', 'flagged', 'tier_up', 'tier_down',
                'recovered', 'deactivated', 'other'
              )),
  description TEXT,
  occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (number_id) REFERENCES number_inventory(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_number_health_logs_number_id ON number_health_logs(number_id);

-- ─── suppliers ────────────────────────────────────────────────────────────────
-- Cadastro de fornecedores de BM e/ou Disparo.
CREATE TABLE IF NOT EXISTS suppliers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  name            TEXT    NOT NULL,
  type            TEXT    NOT NULL CHECK (type IN ('bm', 'disparo', 'both')),
  status          TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'evaluating')),
  trust_score     INTEGER CHECK (trust_score BETWEEN 1 AND 5),
  contacts        TEXT,
  notes           TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_type    ON suppliers(type);
CREATE INDEX IF NOT EXISTS idx_suppliers_status  ON suppliers(status);

-- ─── supplier_logs ────────────────────────────────────────────────────────────
-- Histórico de interações com cada fornecedor.
CREATE TABLE IF NOT EXISTS supplier_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL,
  description TEXT    NOT NULL,
  occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_supplier_logs_supplier_id ON supplier_logs(supplier_id);

-- ─── grupos ───────────────────────────────────────────────────────────────────
-- Grupos monitorados pela régua de disparos (compartilhado entre todos os usuários).
CREATE TABLE IF NOT EXISTS grupos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nome       TEXT    NOT NULL,
  descricao  TEXT,
  criado_em  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─── fluxo_mensagens ──────────────────────────────────────────────────────────
-- Disparos configurados por grupo: recorrentes (todo dia X da semana) ou avulsos (data fixa).
CREATE TABLE IF NOT EXISTS fluxo_mensagens (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  grupo_id      INTEGER NOT NULL,
  nome          TEXT    NOT NULL,
  tipo          TEXT    NOT NULL DEFAULT 'recorrente' CHECK (tipo IN ('recorrente', 'avulso')),
  dia_semana    TEXT    CHECK (dia_semana IN ('domingo','segunda','terca','quarta','quinta','sexta','sabado')),
  data_fixa     DATE,
  horario        TEXT    NOT NULL,
  ferramenta     TEXT,
  campanha_grupo TEXT,
  tipo_copy      TEXT    CHECK (tipo_copy IN ('sem_copy', 'texto', 'video', 'imagem')),
  copy_texto     TEXT,
  status        TEXT    NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'pausado', 'agendado')),
  responsavel   TEXT,
  observacao    TEXT,
  criado_em     DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id)
);

CREATE INDEX IF NOT EXISTS idx_fluxo_mensagens_grupo_id ON fluxo_mensagens(grupo_id);
