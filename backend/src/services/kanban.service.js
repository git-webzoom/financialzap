const { getDb } = require('../db/database')

// ─── Columns ──────────────────────────────────────────────────────────────────

async function listColumns(userId) {
  const db = getDb()
  const { rows } = await db.execute({
    sql: 'SELECT * FROM kanban_columns WHERE user_id = ? ORDER BY position ASC',
    args: [userId],
  })
  return rows
}

async function createColumn(userId, { title, color }) {
  const db = getDb()
  const { rows: maxRows } = await db.execute({
    sql: 'SELECT COALESCE(MAX(position), -1) AS maxpos FROM kanban_columns WHERE user_id = ?',
    args: [userId],
  })
  const position = Number(maxRows[0].maxpos) + 1
  const { lastInsertRowid } = await db.execute({
    sql: 'INSERT INTO kanban_columns (user_id, title, color, position) VALUES (?, ?, ?, ?)',
    args: [userId, title, color ?? null, position],
  })
  const { rows } = await db.execute({
    sql: 'SELECT * FROM kanban_columns WHERE id = ?',
    args: [lastInsertRowid],
  })
  return rows[0]
}

async function updateColumn(userId, columnId, { title, color, position }) {
  const db = getDb()
  const { rows } = await db.execute({
    sql: 'SELECT * FROM kanban_columns WHERE id = ? AND user_id = ?',
    args: [columnId, userId],
  })
  if (!rows.length) {
    const err = new Error('Coluna não encontrada')
    err.status = 404
    throw err
  }

  const current = rows[0]

  if (position !== undefined && position !== current.position) {
    const oldPos = current.position
    const newPos = position
    if (newPos > oldPos) {
      await db.execute({
        sql: `UPDATE kanban_columns SET position = position - 1
              WHERE user_id = ? AND position > ? AND position <= ? AND id != ?`,
        args: [userId, oldPos, newPos, columnId],
      })
    } else {
      await db.execute({
        sql: `UPDATE kanban_columns SET position = position + 1
              WHERE user_id = ? AND position >= ? AND position < ? AND id != ?`,
        args: [userId, newPos, oldPos, columnId],
      })
    }
  }

  const newTitle    = title    !== undefined ? title    : current.title
  const newColor    = color    !== undefined ? color    : current.color
  const newPosition = position !== undefined ? position : current.position

  await db.execute({
    sql: 'UPDATE kanban_columns SET title = ?, color = ?, position = ? WHERE id = ? AND user_id = ?',
    args: [newTitle, newColor, newPosition, columnId, userId],
  })

  const { rows: updated } = await db.execute({
    sql: 'SELECT * FROM kanban_columns WHERE id = ?',
    args: [columnId],
  })
  return updated[0]
}

async function deleteColumn(userId, columnId) {
  const db = getDb()
  const { rows } = await db.execute({
    sql: 'SELECT id FROM kanban_columns WHERE id = ? AND user_id = ?',
    args: [columnId, userId],
  })
  if (!rows.length) {
    const err = new Error('Coluna não encontrada')
    err.status = 404
    throw err
  }
  const { rows: cardRows } = await db.execute({
    sql: 'SELECT COUNT(*) AS cnt FROM bm_cards WHERE column_id = ? AND user_id = ?',
    args: [columnId, userId],
  })
  if (Number(cardRows[0].cnt) > 0) {
    const err = new Error('Mova ou remova os cards antes de deletar esta coluna.')
    err.status = 400
    throw err
  }
  await db.execute({
    sql: 'DELETE FROM kanban_columns WHERE id = ? AND user_id = ?',
    args: [columnId, userId],
  })
}

// ─── Cards ────────────────────────────────────────────────────────────────────

async function _attachWabas(db, cards) {
  if (!cards.length) return cards
  const cardIds = cards.map(c => c.id)
  const placeholders = cardIds.map(() => '?').join(',')

  const { rows: wabaRows } = await db.execute({
    sql: `SELECT * FROM bm_card_wabas WHERE card_id IN (${placeholders}) ORDER BY id ASC`,
    args: cardIds,
  })

  if (!wabaRows.length) return cards.map(c => ({ ...c, wabas: [] }))

  const wabaIds = wabaRows.map(w => w.id)
  const wPlaceholders = wabaIds.map(() => '?').join(',')
  const { rows: phoneRows } = await db.execute({
    sql: `SELECT * FROM bm_card_phones WHERE card_waba_id IN (${wPlaceholders}) ORDER BY id ASC`,
    args: wabaIds,
  })

  const phonesByWaba = {}
  for (const p of phoneRows) {
    if (!phonesByWaba[p.card_waba_id]) phonesByWaba[p.card_waba_id] = []
    phonesByWaba[p.card_waba_id].push({ id: p.id, phone_number: p.phone_number })
  }

  const wabasByCard = {}
  for (const w of wabaRows) {
    if (!wabasByCard[w.card_id]) wabasByCard[w.card_id] = []
    wabasByCard[w.card_id].push({
      id: w.id,
      waba_id: w.waba_id,
      waba_name: w.waba_name,
      phones: phonesByWaba[w.id] ?? [],
    })
  }

  return cards.map(c => ({ ...c, wabas: wabasByCard[c.id] ?? [] }))
}

async function listCards(userId) {
  const db = getDb()
  const { rows } = await db.execute({
    sql: 'SELECT * FROM bm_cards WHERE user_id = ? ORDER BY column_id ASC, position ASC',
    args: [userId],
  })
  return _attachWabas(db, rows)
}

async function createCard(userId, { column_id, profile_name, supplier, bm_id, bm_name, notes, bm_status }) {
  const db = getDb()
  const { rows: colRows } = await db.execute({
    sql: 'SELECT id FROM kanban_columns WHERE id = ? AND user_id = ?',
    args: [column_id, userId],
  })
  if (!colRows.length) {
    const err = new Error('Coluna não encontrada')
    err.status = 404
    throw err
  }
  const { rows: maxRows } = await db.execute({
    sql: 'SELECT COALESCE(MAX(position), -1) AS maxpos FROM bm_cards WHERE column_id = ? AND user_id = ?',
    args: [column_id, userId],
  })
  const position = Number(maxRows[0].maxpos) + 1
  const now = new Date().toISOString()
  const { lastInsertRowid } = await db.execute({
    sql: `INSERT INTO bm_cards
            (user_id, column_id, position, profile_name, supplier, bm_id, bm_name, notes, bm_status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [userId, column_id, position, profile_name ?? null, supplier ?? null, bm_id ?? null, bm_name ?? null, notes ?? null, bm_status ?? null, now, now],
  })
  const { rows } = await db.execute({
    sql: 'SELECT * FROM bm_cards WHERE id = ?',
    args: [lastInsertRowid],
  })
  const [card] = await _attachWabas(db, rows)
  return card
}

async function updateCard(userId, cardId, fields) {
  const db = getDb()
  const { rows } = await db.execute({
    sql: 'SELECT * FROM bm_cards WHERE id = ? AND user_id = ?',
    args: [cardId, userId],
  })
  if (!rows.length) {
    const err = new Error('Card não encontrado')
    err.status = 404
    throw err
  }
  const current = rows[0]

  const newColumnId    = fields.column_id    !== undefined ? fields.column_id    : current.column_id
  const newPosition    = fields.position     !== undefined ? fields.position     : current.position
  const newProfileName = fields.profile_name !== undefined ? fields.profile_name : current.profile_name
  const newSupplier    = fields.supplier     !== undefined ? fields.supplier     : current.supplier
  const newBmId        = fields.bm_id        !== undefined ? fields.bm_id        : current.bm_id
  const newBmName      = fields.bm_name      !== undefined ? fields.bm_name      : current.bm_name
  const newNotes       = fields.notes        !== undefined ? fields.notes        : current.notes
  const newBmStatus    = fields.bm_status    !== undefined ? fields.bm_status    : current.bm_status

  const movingColumn = newColumnId !== current.column_id
  const now = new Date().toISOString()

  if (movingColumn || fields.position !== undefined) {
    if (movingColumn) {
      const { rows: colRows } = await db.execute({
        sql: 'SELECT id FROM kanban_columns WHERE id = ? AND user_id = ?',
        args: [newColumnId, userId],
      })
      if (!colRows.length) {
        const err = new Error('Coluna de destino não encontrada')
        err.status = 404
        throw err
      }
      await db.execute({
        sql: `UPDATE bm_cards SET position = position - 1
              WHERE user_id = ? AND column_id = ? AND position > ? AND id != ?`,
        args: [userId, current.column_id, current.position, cardId],
      })
      await db.execute({
        sql: `UPDATE bm_cards SET position = position + 1
              WHERE user_id = ? AND column_id = ? AND position >= ?`,
        args: [userId, newColumnId, newPosition],
      })
    } else {
      const oldPos = current.position
      const pos    = newPosition
      if (pos > oldPos) {
        await db.execute({
          sql: `UPDATE bm_cards SET position = position - 1
                WHERE user_id = ? AND column_id = ? AND position > ? AND position <= ? AND id != ?`,
          args: [userId, newColumnId, oldPos, pos, cardId],
        })
      } else if (pos < oldPos) {
        await db.execute({
          sql: `UPDATE bm_cards SET position = position + 1
                WHERE user_id = ? AND column_id = ? AND position >= ? AND position < ? AND id != ?`,
          args: [userId, newColumnId, pos, oldPos, cardId],
        })
      }
    }
  }

  await db.execute({
    sql: `UPDATE bm_cards SET
            column_id = ?, position = ?, profile_name = ?, supplier = ?,
            bm_id = ?, bm_name = ?, notes = ?, bm_status = ?, updated_at = ?,
            moved_at = ?
          WHERE id = ? AND user_id = ?`,
    args: [newColumnId, newPosition, newProfileName, newSupplier, newBmId, newBmName, newNotes, newBmStatus, now, movingColumn ? now : (current.moved_at ?? null), cardId, userId],
  })

  const { rows: updated } = await db.execute({
    sql: 'SELECT * FROM bm_cards WHERE id = ?',
    args: [cardId],
  })
  const [card] = await _attachWabas(db, updated)
  return card
}

async function deleteCard(userId, cardId) {
  const db = getDb()
  const { rows } = await db.execute({
    sql: 'SELECT * FROM bm_cards WHERE id = ? AND user_id = ?',
    args: [cardId, userId],
  })
  if (!rows.length) {
    const err = new Error('Card não encontrado')
    err.status = 404
    throw err
  }
  const card = rows[0]
  await db.execute({
    sql: `UPDATE bm_cards SET position = position - 1
          WHERE user_id = ? AND column_id = ? AND position > ?`,
    args: [userId, card.column_id, card.position],
  })
  await db.execute({
    sql: 'DELETE FROM bm_cards WHERE id = ? AND user_id = ?',
    args: [cardId, userId],
  })
}

// ─── Card WABAs ───────────────────────────────────────────────────────────────

async function assertCardOwnership(db, userId, cardId) {
  const { rows } = await db.execute({
    sql: 'SELECT id FROM bm_cards WHERE id = ? AND user_id = ?',
    args: [cardId, userId],
  })
  if (!rows.length) {
    const err = new Error('Card não encontrado')
    err.status = 404
    throw err
  }
}

async function createWaba(userId, cardId, { waba_id, waba_name }) {
  const db = getDb()
  await assertCardOwnership(db, userId, cardId)
  const { lastInsertRowid } = await db.execute({
    sql: 'INSERT INTO bm_card_wabas (card_id, waba_id, waba_name) VALUES (?, ?, ?)',
    args: [cardId, waba_id ?? null, waba_name ?? null],
  })
  const { rows } = await db.execute({
    sql: 'SELECT * FROM bm_card_wabas WHERE id = ?',
    args: [lastInsertRowid],
  })
  return { ...rows[0], phones: [] }
}

async function updateWaba(userId, cardId, wabaId, { waba_id, waba_name }) {
  const db = getDb()
  await assertCardOwnership(db, userId, cardId)
  const { rows } = await db.execute({
    sql: 'SELECT * FROM bm_card_wabas WHERE id = ? AND card_id = ?',
    args: [wabaId, cardId],
  })
  if (!rows.length) {
    const err = new Error('WABA não encontrada')
    err.status = 404
    throw err
  }
  const cur = rows[0]
  await db.execute({
    sql: 'UPDATE bm_card_wabas SET waba_id = ?, waba_name = ? WHERE id = ?',
    args: [waba_id ?? cur.waba_id, waba_name ?? cur.waba_name, wabaId],
  })
  const { rows: updated } = await db.execute({ sql: 'SELECT * FROM bm_card_wabas WHERE id = ?', args: [wabaId] })
  const { rows: phones } = await db.execute({ sql: 'SELECT * FROM bm_card_phones WHERE card_waba_id = ?', args: [wabaId] })
  return { ...updated[0], phones: phones.map(p => ({ id: p.id, phone_number: p.phone_number })) }
}

async function deleteWaba(userId, cardId, wabaId) {
  const db = getDb()
  await assertCardOwnership(db, userId, cardId)
  const { rows } = await db.execute({
    sql: 'SELECT id FROM bm_card_wabas WHERE id = ? AND card_id = ?',
    args: [wabaId, cardId],
  })
  if (!rows.length) {
    const err = new Error('WABA não encontrada')
    err.status = 404
    throw err
  }
  await db.execute({ sql: 'DELETE FROM bm_card_wabas WHERE id = ?', args: [wabaId] })
}

// ─── Card Phones ──────────────────────────────────────────────────────────────

async function createPhone(userId, cardId, wabaId, { phone_number }) {
  const db = getDb()
  await assertCardOwnership(db, userId, cardId)
  if (!phone_number) {
    const err = new Error('phone_number é obrigatório')
    err.status = 400
    throw err
  }
  const { rows: wabaRows } = await db.execute({
    sql: 'SELECT id FROM bm_card_wabas WHERE id = ? AND card_id = ?',
    args: [wabaId, cardId],
  })
  if (!wabaRows.length) {
    const err = new Error('WABA não encontrada')
    err.status = 404
    throw err
  }
  const { lastInsertRowid } = await db.execute({
    sql: 'INSERT INTO bm_card_phones (card_waba_id, phone_number) VALUES (?, ?)',
    args: [wabaId, phone_number],
  })
  const { rows } = await db.execute({ sql: 'SELECT * FROM bm_card_phones WHERE id = ?', args: [lastInsertRowid] })
  return { id: rows[0].id, phone_number: rows[0].phone_number }
}

async function deletePhone(userId, cardId, wabaId, phoneId) {
  const db = getDb()
  await assertCardOwnership(db, userId, cardId)
  await db.execute({ sql: 'DELETE FROM bm_card_phones WHERE id = ? AND card_waba_id = ?', args: [phoneId, wabaId] })
}

module.exports = {
  listColumns, createColumn, updateColumn, deleteColumn,
  listCards, createCard, updateCard, deleteCard,
  createWaba, updateWaba, deleteWaba,
  createPhone, deletePhone,
}
