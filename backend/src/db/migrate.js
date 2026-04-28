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

  // ── Corrigir CHECK constraints desatualizados ──────────────────────────────
  // SQLite não suporta ALTER COLUMN/DROP CONSTRAINT — é preciso recriar a tabela.
  // Padrão: RENAME → CREATE novo → INSERT SELECT → DROP antigo (idempotente pela coluna sentinela).

  // number_inventory: adicionar 'com_restricao' ao CHECK de status
  {
    const { rows: cols } = await db.execute(`PRAGMA table_info(number_inventory)`)
    const statusCol = cols.find(c => c.name === 'status')
    // Se a constraint ainda é a antiga (sem com_restricao), recriar a tabela
    const { rows: ddl } = await db.execute(`SELECT sql FROM sqlite_master WHERE type='table' AND name='number_inventory'`)
    if (ddl.length && ddl[0].sql && !ddl[0].sql.includes('com_restricao')) {
      await db.execute(`ALTER TABLE number_inventory RENAME TO _number_inventory_old`)
      await db.execute(`
        CREATE TABLE number_inventory (
          id                   INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id              INTEGER NOT NULL,
          phone_number         TEXT    NOT NULL,
          origin               TEXT    NOT NULL CHECK (origin IN ('own', 'rented')),
          supplier             TEXT,
          bm_name              TEXT,
          waba_name            TEXT,
          status               TEXT    NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'in_use', 'reserved', 'com_restricao')),
          notes                TEXT,
          quality_rating       TEXT,
          messaging_limit_tier TEXT,
          created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `)
      await db.execute(`
        INSERT INTO number_inventory
          (id, user_id, phone_number, origin, supplier, bm_name, waba_name, status, notes, quality_rating, messaging_limit_tier, created_at, updated_at)
        SELECT
          id, user_id, phone_number, origin, supplier, bm_name, waba_name, status, notes, quality_rating, messaging_limit_tier, created_at, updated_at
        FROM _number_inventory_old
      `)
      await db.execute(`DROP TABLE _number_inventory_old`)
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_number_inventory_user_id ON number_inventory(user_id)`)
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_number_inventory_status  ON number_inventory(status)`)
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_number_inventory_origin  ON number_inventory(origin)`)
      console.log('[db] Rebuilt number_inventory with updated status CHECK')
    }
  }

  // fluxo_mensagens — renomear de regua_disparos se ainda não foi renomeado
  {
    const { rows: tables } = await db.execute(`SELECT name FROM sqlite_master WHERE type='table'`)
    const names = tables.map(t => t.name)
    if (names.includes('regua_disparos') && !names.includes('fluxo_mensagens')) {
      await db.execute(`ALTER TABLE regua_disparos RENAME TO fluxo_mensagens`)
      console.log('[db] Renamed regua_disparos → fluxo_mensagens')
    }
  }

  // fluxo_mensagens — garantir que a tabela existe (ambientes limpos)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS fluxo_mensagens (
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
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_fluxo_mensagens_grupo_id ON fluxo_mensagens(grupo_id)`)

  // fluxo_mensagens — campos adicionais (idempotente)
  await addColumnIfMissing(db, 'fluxo_mensagens', 'ferramenta',     'TEXT')
  await addColumnIfMissing(db, 'fluxo_mensagens', 'campanha_grupo', 'TEXT')
  await addColumnIfMissing(db, 'fluxo_mensagens', 'tipo_copy',      'TEXT')
  await addColumnIfMissing(db, 'fluxo_mensagens', 'copy_texto',     'TEXT')

  // fluxo_mensagens: corrigir CHECK de tipo_copy para incluir 'sem_copy'
  {
    const { rows: ddl } = await db.execute(`SELECT sql FROM sqlite_master WHERE type='table' AND name='fluxo_mensagens'`)
    if (ddl.length && ddl[0].sql && ddl[0].sql.includes("tipo_copy") && !ddl[0].sql.includes('sem_copy')) {
      await db.execute(`ALTER TABLE fluxo_mensagens RENAME TO _fluxo_mensagens_old`)
      await db.execute(`
        CREATE TABLE fluxo_mensagens (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          grupo_id      INTEGER NOT NULL,
          nome          TEXT    NOT NULL,
          tipo          TEXT    NOT NULL DEFAULT 'recorrente' CHECK (tipo IN ('recorrente', 'avulso')),
          dia_semana    TEXT    CHECK (dia_semana IN ('domingo','segunda','terca','quarta','quinta','sexta','sabado')),
          data_fixa     DATE,
          horario       TEXT    NOT NULL,
          ferramenta    TEXT,
          campanha_grupo TEXT,
          tipo_copy     TEXT    CHECK (tipo_copy IN ('sem_copy', 'texto', 'video', 'imagem')),
          copy_texto    TEXT,
          status        TEXT    NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'pausado', 'agendado')),
          responsavel   TEXT,
          observacao    TEXT,
          criado_em     DATETIME DEFAULT CURRENT_TIMESTAMP,
          atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (grupo_id) REFERENCES grupos(id)
        )
      `)
      await db.execute(`
        INSERT INTO fluxo_mensagens
          (id, grupo_id, nome, tipo, dia_semana, data_fixa, horario, ferramenta, campanha_grupo, tipo_copy, copy_texto, status, responsavel, observacao, criado_em, atualizado_em)
        SELECT
          id, grupo_id, nome, tipo, dia_semana, data_fixa, horario, ferramenta, campanha_grupo, tipo_copy, copy_texto, status, responsavel, observacao, criado_em, atualizado_em
        FROM _fluxo_mensagens_old
      `)
      await db.execute(`DROP TABLE _fluxo_mensagens_old`)
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_fluxo_mensagens_grupo_id ON fluxo_mensagens(grupo_id)`)
      console.log('[db] Rebuilt fluxo_mensagens with updated tipo_copy CHECK')
    }
  }

  // media_uploads — mídias enviadas para a Meta API (handles para templates)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS media_uploads (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL,
      waba_id         TEXT    NOT NULL,
      phone_number_id TEXT    NOT NULL,
      handle_id       TEXT    NOT NULL UNIQUE,
      original_name   TEXT    NOT NULL,
      mime_type       TEXT    NOT NULL,
      file_size       INTEGER NOT NULL,
      media_type      TEXT    NOT NULL CHECK (media_type IN ('IMAGE','VIDEO','DOCUMENT')),
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (waba_id) REFERENCES wabas(waba_id) ON DELETE CASCADE
    )
  `)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_media_uploads_user_id    ON media_uploads(user_id)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_media_uploads_waba_id    ON media_uploads(waba_id)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_media_uploads_media_type ON media_uploads(media_type)`)

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
