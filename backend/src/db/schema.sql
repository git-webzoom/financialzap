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
