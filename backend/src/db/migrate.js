const fs = require('fs')
const path = require('path')
const { getDb } = require('./database')

async function migrate() {
  const raw = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  const db  = getDb()

  // Strip single-line comments, then split on semicolons.
  const stripped = raw
    .split('\n')
    .map(line => {
      const idx = line.indexOf('--')
      return idx >= 0 ? line.slice(0, idx) : line
    })
    .join('\n')

  const statements = stripped
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  for (const sql of statements) {
    await db.execute(sql)
  }

  // ── Column migrations (idempotent) ──
  // Add new columns to existing tables without breaking old databases.
  await addColumnIfMissing(db, 'templates',          'quality_score',   'TEXT')
  await addColumnIfMissing(db, 'templates',          'rejected_reason', 'TEXT')
  await addColumnIfMissing(db, 'campaign_contacts',  'wamid',           'TEXT')
  await addColumnIfMissing(db, 'campaign_contacts',  'delivered_at',    'DATETIME')
  await addColumnIfMissing(db, 'campaign_contacts',  'read_at',         'DATETIME')
  await addColumnIfMissing(db, 'campaign_contacts',  'media_url',       'TEXT')
  await addColumnIfMissing(db, 'campaigns',          'read_count',      'INTEGER DEFAULT 0')

  // WABA health/restriction fields (synced from Meta API)
  await addColumnIfMissing(db, 'wabas', 'account_review_status', 'TEXT')
  await addColumnIfMissing(db, 'wabas', 'ban_state',             'TEXT')
  await addColumnIfMissing(db, 'wabas', 'decision',              'TEXT')

  // Phone number health fields
  await addColumnIfMissing(db, 'phone_numbers', 'account_mode',   'TEXT')
  await addColumnIfMissing(db, 'phone_numbers', 'health_status',  'TEXT')

  // Índice para lookup de wamid no webhook (idempotente via IF NOT EXISTS)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_campaign_contacts_wamid ON campaign_contacts(wamid)`)

  // number_automations — tabela de automações por número (N:1 com number_inventory)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS number_automations (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      number_id       INTEGER NOT NULL,
      automation_name TEXT    NOT NULL,
      template_name   TEXT,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (number_id) REFERENCES number_inventory(id) ON DELETE CASCADE
    )
  `)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_number_automations_number_id ON number_automations(number_id)`)

  // number_health_logs — histórico de eventos de saúde por número
  await db.execute(`
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
    )
  `)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_number_health_logs_number_id ON number_health_logs(number_id)`)

  // Melhoria 2 — quality/tier no inventário
  await addColumnIfMissing(db, 'number_inventory', 'quality_rating',       'TEXT')
  await addColumnIfMissing(db, 'number_inventory', 'messaging_limit_tier', 'TEXT')

  // Melhoria 3 — volume diário por automação
  await addColumnIfMissing(db, 'number_automations', 'daily_volume', 'INTEGER DEFAULT 0')
  await addColumnIfMissing(db, 'number_automations', 'tool_name',    'TEXT')

  // automation_templates — múltiplos templates por automação
  await db.execute(`
    CREATE TABLE IF NOT EXISTS automation_templates (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      automation_id INTEGER NOT NULL,
      template_name TEXT    NOT NULL,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (automation_id) REFERENCES number_automations(id) ON DELETE CASCADE
    )
  `)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_automation_templates_auto_id ON automation_templates(automation_id)`)

  // Melhoria 4 — moved_at nos cards do Kanban (NULL = nunca movido; usamos updated_at como fallback no front)
  await addColumnIfMissing(db, 'bm_cards', 'moved_at',   'DATETIME')
  await addColumnIfMissing(db, 'bm_cards', 'bm_status',  'TEXT')

  // bm_card_wabas e bm_card_phones — WABAs/números aninhados por card
  await db.execute(`
    CREATE TABLE IF NOT EXISTS bm_card_wabas (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id   INTEGER NOT NULL,
      waba_id   TEXT,
      waba_name TEXT,
      FOREIGN KEY (card_id) REFERENCES bm_cards(id) ON DELETE CASCADE
    )
  `)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_bm_card_wabas_card_id ON bm_card_wabas(card_id)`)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS bm_card_phones (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      card_waba_id INTEGER NOT NULL,
      phone_number TEXT    NOT NULL,
      FOREIGN KEY (card_waba_id) REFERENCES bm_card_wabas(id) ON DELETE CASCADE
    )
  `)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_bm_card_phones_waba_id ON bm_card_phones(card_waba_id)`)

  // regua_disparos — campos ferramenta e tipo_copy (idempotente)
  await addColumnIfMissing(db, 'regua_disparos', 'ferramenta', 'TEXT')
  await addColumnIfMissing(db, 'regua_disparos', 'tipo_copy',  'TEXT')

  // regua_disparos — nova estrutura (disparos por grupo, recorrentes ou avulsos)
  // Drop a tabela antiga (formato texto livre + data_disparo) e recria com nova estrutura.
  // Dados antigos são descartados intencionalmente — a lógica de negócio mudou.
  await db.execute(`DROP TABLE IF EXISTS regua_disparos`)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS regua_disparos (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      grupo_id      INTEGER NOT NULL,
      nome          TEXT    NOT NULL,
      tipo          TEXT    NOT NULL DEFAULT 'recorrente',
      dia_semana    TEXT,
      data_fixa     DATE,
      horario       TEXT    NOT NULL,
      status        TEXT    NOT NULL DEFAULT 'ativo',
      responsavel   TEXT,
      observacao    TEXT,
      criado_em     DATETIME DEFAULT CURRENT_TIMESTAMP,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (grupo_id) REFERENCES grupos(id)
    )
  `)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_regua_disparos_grupo_id ON regua_disparos(grupo_id)`)

  console.log('[db] Migration complete.')
}

async function addColumnIfMissing(db, table, column, type) {
  const { rows } = await db.execute(`PRAGMA table_info(${table})`)
  const exists = rows.some(r => r.name === column)
  if (!exists) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
    console.log(`[db] Added column ${table}.${column}`)
  }
}

module.exports = { migrate }
