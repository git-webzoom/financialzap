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

  // If position is changing, shift other columns to keep consistency
  if (position !== undefined && position !== current.position) {
    const oldPos = current.position
    const newPos = position
    if (newPos > oldPos) {
      // Moving forward: shift down columns between old+1 and new
      await db.execute({
        sql: `UPDATE kanban_columns SET position = position - 1
              WHERE user_id = ? AND position > ? AND position <= ? AND id != ?`,
        args: [userId, oldPos, newPos, columnId],
      })
    } else {
      // Moving backward: shift up columns between new and old-1
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

async function listCards(userId) {
  const db = getDb()
  const { rows } = await db.execute({
    sql: 'SELECT * FROM bm_cards WHERE user_id = ? ORDER BY column_id ASC, position ASC',
    args: [userId],
  })
  return rows
}

async function createCard(userId, { column_id, profile_name, supplier, bm_id, bm_name, waba_id, waba_name, phone_number, notes }) {
  const db = getDb()
  // Verify column belongs to user
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
            (user_id, column_id, position, profile_name, supplier, bm_id, bm_name, waba_id, waba_name, phone_number, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [userId, column_id, position, profile_name ?? null, supplier ?? null, bm_id ?? null, bm_name ?? null, waba_id ?? null, waba_name ?? null, phone_number ?? null, notes ?? null, now, now],
  })
  const { rows } = await db.execute({
    sql: 'SELECT * FROM bm_cards WHERE id = ?',
    args: [lastInsertRowid],
  })
  return rows[0]
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
  const newWabaId      = fields.waba_id      !== undefined ? fields.waba_id      : current.waba_id
  const newWabaName    = fields.waba_name    !== undefined ? fields.waba_name    : current.waba_name
  const newPhone       = fields.phone_number !== undefined ? fields.phone_number : current.phone_number
  const newNotes       = fields.notes        !== undefined ? fields.notes        : current.notes

  const movingColumn = newColumnId !== current.column_id
  const now = new Date().toISOString()

  if (movingColumn || fields.position !== undefined) {
    // Verify destination column belongs to user (if changing)
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
      // Close gap in origin column
      await db.execute({
        sql: `UPDATE bm_cards SET position = position - 1
              WHERE user_id = ? AND column_id = ? AND position > ? AND id != ?`,
        args: [userId, current.column_id, current.position, cardId],
      })
      // Make room in destination column
      await db.execute({
        sql: `UPDATE bm_cards SET position = position + 1
              WHERE user_id = ? AND column_id = ? AND position >= ?`,
        args: [userId, newColumnId, newPosition],
      })
    } else {
      // Same column reorder
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
            bm_id = ?, bm_name = ?, waba_id = ?, waba_name = ?,
            phone_number = ?, notes = ?, updated_at = ?
          WHERE id = ? AND user_id = ?`,
    args: [newColumnId, newPosition, newProfileName, newSupplier, newBmId, newBmName, newWabaId, newWabaName, newPhone, newNotes, now, cardId, userId],
  })

  const { rows: updated } = await db.execute({
    sql: 'SELECT * FROM bm_cards WHERE id = ?',
    args: [cardId],
  })
  return updated[0]
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
  // Close gap in column
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

module.exports = { listColumns, createColumn, updateColumn, deleteColumn, listCards, createCard, updateCard, deleteCard }
