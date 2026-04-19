import { useEffect, useState, useRef, useMemo } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useKanban } from '../../hooks/useKanban'
import * as kanbanService from '../../services/kanbanService'

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

function IconEdit() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M9.5 1.5l2 2-8 8H1.5v-2l8-8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 3.5h9M5 3.5V2h3v1.5M4 3.5l.5 7h4l.5-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

function IconGrip() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="4" cy="3" r="1" fill="currentColor"/>
      <circle cx="8" cy="3" r="1" fill="currentColor"/>
      <circle cx="4" cy="6" r="1" fill="currentColor"/>
      <circle cx="8" cy="6" r="1" fill="currentColor"/>
      <circle cx="4" cy="9" r="1" fill="currentColor"/>
      <circle cx="8" cy="9" r="1" fill="currentColor"/>
    </svg>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysInStage(movedAt) {
  if (!movedAt) return null
  try {
    const ts = movedAt.includes('T') ? movedAt : movedAt + 'T00:00:00Z'
    const diff = Date.now() - new Date(ts).getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  } catch { return null }
}

function DaysIndicator({ days }) {
  if (days === null) return null
  let color = '#4a5568'
  let icon  = ''
  if (days >= 21) { color = '#ef4444'; icon = '⚠ ' }
  else if (days >= 8) { color = '#f59e0b'; icon = '⚠ ' }
  return (
    <span className="kb-days-badge" style={{ color }}>
      {icon}{days}d nesta coluna
    </span>
  )
}

// ─── Card component (sortable) ────────────────────────────────────────────────

function KanbanCard({ card, onEdit, onDelete, isDragging }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: `card-${card.id}` })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  const days = daysInStage(card.moved_at)
  const wabas = card.wabas ?? []
  const totalPhones = wabas.reduce((s, w) => s + (w.phones?.length ?? 0), 0)
  return (
    <div ref={setNodeRef} style={style} className="kb-card" {...attributes} {...listeners}>
      <div className="kb-card-header">
        <div className="kb-card-title-block">
          <span className="kb-card-name">{card.bm_name || card.profile_name || '—'}</span>
          {card.bm_name && card.profile_name && (
            <span className="kb-card-sub">{card.profile_name}</span>
          )}
        </div>
        <div className="kb-card-actions" onClick={e => e.stopPropagation()}>
          <button className="kb-icon-btn" onClick={() => onEdit(card)} title="Editar"><IconEdit /></button>
          <button className="kb-icon-btn kb-icon-btn--danger" onClick={() => onDelete(card.id)} title="Deletar"><IconTrash /></button>
        </div>
      </div>
      {card.supplier && <div className="kb-card-row"><span className="kb-card-label">Fornecedor</span><span>{card.supplier}</span></div>}
      {card.bm_id    && <div className="kb-card-row"><span className="kb-card-label">BM ID</span><span className="kb-card-mono">{card.bm_id}</span></div>}
      {wabas.length > 0 && (
        <div className="kb-card-row">
          <span className="kb-card-label">WABAs</span>
          <span>{wabas.length} WABA{wabas.length !== 1 ? 's' : ''}{totalPhones > 0 ? ` · ${totalPhones} número${totalPhones !== 1 ? 's' : ''}` : ''}</span>
        </div>
      )}
      {card.notes && <div className="kb-card-notes">{card.notes}</div>}
      {days !== null && <div className="kb-card-footer"><DaysIndicator days={days} /></div>}
    </div>
  )
}

// ─── Column component ─────────────────────────────────────────────────────────

function KanbanColumn({ column, cards, onAddCard, onEditCard, onDeleteCard, onDeleteColumn, onRenameColumn, activeCardId, isColDragging }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle]     = useState(column.title)
  const inputRef = useRef(null)

  // Sortable for column reorder
  const {
    attributes: colAttrs,
    listeners: colListeners,
    setNodeRef: setColRef,
    transform: colTransform,
    transition: colTransition,
  } = useSortable({ id: `col-${column.id}` })

  const colStyle = {
    transform: CSS.Transform.toString(colTransform),
    transition: colTransition,
    opacity: isColDragging ? 0.4 : 1,
  }

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `col-${column.id}` })

  // Merge refs
  function mergeRef(el) { setColRef(el); setDropRef(el) }

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function handleRename() {
    if (title.trim() && title.trim() !== column.title) {
      onRenameColumn(column.id, title.trim())
    }
    setEditing(false)
  }

  const daysValues = cards.map(c => daysInStage(c.moved_at)).filter(d => d !== null)
  const avgDays = daysValues.length > 0 ? Math.round(daysValues.reduce((s, d) => s + d, 0) / daysValues.length) : null

  return (
    <div ref={mergeRef} style={colStyle} className="kb-col">
      <div className="kb-col-header">
        {/* Drag handle for column reorder */}
        <span
          className="kb-col-grip"
          {...colAttrs}
          {...colListeners}
          title="Arrastar para reordenar"
        >
          <IconGrip />
        </span>
        <div className="kb-col-title-wrap">
          <span className="kb-col-dot" style={{ background: column.color || '#8a94a6' }} />
          {editing ? (
            <input
              ref={inputRef}
              className="kb-col-title-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={handleRename}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setTitle(column.title); setEditing(false) } }}
            />
          ) : (
            <span className="kb-col-title" onClick={() => setEditing(true)} title="Clique para editar">{column.title}</span>
          )}
          <span className="kb-col-count">{cards.length}</span>
          {avgDays !== null && (
            <span className="kb-col-avg" style={{ color: avgDays >= 21 ? '#ef4444' : avgDays >= 8 ? '#f59e0b' : '#4a5568' }}>
              ~{avgDays}d
            </span>
          )}
        </div>
        <div className="kb-col-meta-actions">
          <button
            className="kb-icon-btn kb-icon-btn--danger"
            onClick={() => onDeleteColumn(column.id, cards.length)}
            disabled={cards.length > 0}
            title={cards.length > 0 ? 'Mova os cards antes de deletar' : 'Deletar coluna'}
          >
            <IconTrash />
          </button>
        </div>
      </div>

      <SortableContext items={cards.map(c => `card-${c.id}`)} strategy={verticalListSortingStrategy}>
        <div
          className="kb-col-cards"
          style={{ background: isOver ? '#22c55e08' : undefined }}
        >
          {cards.map(card => (
            <KanbanCard
              key={card.id}
              card={card}
              onEdit={onEditCard}
              onDelete={onDeleteCard}
              isDragging={activeCardId === card.id}
            />
          ))}
        </div>
      </SortableContext>

      <button className="kb-add-card-btn" onClick={() => onAddCard(column.id)}>
        <IconPlus /> Adicionar card
      </button>
    </div>
  )
}

// ─── Card Modal ───────────────────────────────────────────────────────────────

const EMPTY_CARD = { profile_name: '', supplier: '', bm_id: '', bm_name: '', notes: '' }

function CardModal({ initial, columnId, onSave, onCardUpdated, onClose }) {
  // savedCard: set after the first save (create OR edit) — unlocks WABAs section
  const [savedCard, setSavedCard] = useState(initial ?? null)
  const [form, setForm]   = useState(initial ? { ...EMPTY_CARD, ...initial } : { ...EMPTY_CARD })
  const [saving, setSaving] = useState(false)
  const [basicSaved, setBasicSaved] = useState(!!initial) // true when basic data has been saved at least once

  // WABAs state initialised from the card (edit mode) or empty (create mode)
  const [wabas, setWabas] = useState(initial?.wabas ?? [])
  const [addingWaba, setAddingWaba]   = useState(false)
  const [editingWabaId, setEditingWabaId] = useState(null)

  function field(key) {
    return (e) => setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit() {
    setSaving(true)
    try {
      const saved = await onSave(form)
      if (saved) {
        setSavedCard(saved)
        setWabas(saved.wabas ?? wabas)
        setBasicSaved(true)
        onCardUpdated?.(saved)
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  function notifyUpdate(newWabas) {
    onCardUpdated?.({ ...savedCard, wabas: newWabas })
  }

  // ── WABA handlers ──
  async function handleCreateWaba(wabaForm) {
    const waba = await kanbanService.createWaba(savedCard.id, wabaForm)
    const updated = [...wabas, waba]
    setWabas(updated)
    notifyUpdate(updated)
    setAddingWaba(false)
  }

  async function handleUpdateWaba(wabaId, wabaForm) {
    const waba = await kanbanService.updateWaba(savedCard.id, wabaId, wabaForm)
    const updated = wabas.map(w => w.id === wabaId ? { ...waba, phones: w.phones } : w)
    setWabas(updated)
    notifyUpdate(updated)
    setEditingWabaId(null)
  }

  async function handleDeleteWaba(wabaId) {
    if (!window.confirm('Remover esta WABA e seus números?')) return
    await kanbanService.deleteWaba(savedCard.id, wabaId)
    const updated = wabas.filter(w => w.id !== wabaId)
    setWabas(updated)
    notifyUpdate(updated)
  }

  // ── Phone handlers ──
  async function handleCreatePhone(wabaId, phone) {
    const p = await kanbanService.createPhone(savedCard.id, wabaId, { phone_number: phone })
    const updated = wabas.map(w => w.id === wabaId ? { ...w, phones: [...(w.phones ?? []), p] } : w)
    setWabas(updated)
    notifyUpdate(updated)
  }

  async function handleDeletePhone(wabaId, phoneId) {
    await kanbanService.deletePhone(savedCard.id, wabaId, phoneId)
    const updated = wabas.map(w => w.id === wabaId ? { ...w, phones: w.phones.filter(p => p.id !== phoneId) } : w)
    setWabas(updated)
    notifyUpdate(updated)
  }

  return (
    <div className="kb-modal-backdrop" onClick={onClose}>
      <div className="kb-modal" onClick={e => e.stopPropagation()}>
        <div className="kb-modal-header">
          <span>{initial ? 'Editar card' : 'Novo card'}</span>
          <button className="kb-icon-btn" onClick={onClose}><IconX /></button>
        </div>

        <div className="kb-modal-body">
          {/* ── Dados básicos ── */}
          <div className="kb-form-row">
            <label>Perfil</label>
            <input value={form.profile_name || ''} onChange={field('profile_name')} placeholder="Nome do perfil" />
          </div>
          <div className="kb-form-row">
            <label>Fornecedor</label>
            <input value={form.supplier || ''} onChange={field('supplier')} placeholder="Fornecedor" />
          </div>
          <div className="kb-form-2col">
            <div className="kb-form-row">
              <label>BM ID</label>
              <input value={form.bm_id || ''} onChange={field('bm_id')} placeholder="ID da BM" className="kb-mono" />
            </div>
            <div className="kb-form-row">
              <label>BM Nome</label>
              <input value={form.bm_name || ''} onChange={field('bm_name')} placeholder="Nome da BM" />
            </div>
          </div>
          <div className="kb-form-row">
            <label>Observações</label>
            <textarea value={form.notes || ''} onChange={field('notes')} rows={2} placeholder="Notas livres..." />
          </div>

          <div className="kb-modal-footer" style={{ marginBottom: basicSaved ? 0 : undefined }}>
            <button type="button" className="kb-btn kb-btn--ghost" onClick={onClose}>
              {basicSaved ? 'Fechar' : 'Cancelar'}
            </button>
            <button type="button" className="kb-btn kb-btn--primary" disabled={saving} onClick={handleSubmit}>
              {saving ? 'Salvando…' : basicSaved ? 'Atualizar dados' : 'Salvar e continuar'}
            </button>
          </div>

          {/* ── WABAs — aparece assim que os dados básicos forem salvos ── */}
          {basicSaved && savedCard && (
            <div className="kb-waba-section">
              <div className="kb-waba-section-header">
                <span>WABAs ({wabas.length})</span>
                {!addingWaba && (
                  <button type="button" className="kb-btn kb-btn--ghost kb-btn--sm" onClick={() => setAddingWaba(true)}>
                    <IconPlus /> Adicionar WABA
                  </button>
                )}
              </div>

              {addingWaba && (
                <WabaForm
                  onSave={handleCreateWaba}
                  onCancel={() => setAddingWaba(false)}
                />
              )}

              {wabas.length === 0 && !addingWaba && (
                <div className="kb-empty-wabas">Nenhuma WABA vinculada.</div>
              )}

              {wabas.map(w => (
                <WabaItem
                  key={w.id}
                  waba={w}
                  editing={editingWabaId === w.id}
                  onEdit={() => setEditingWabaId(editingWabaId === w.id ? null : w.id)}
                  onSaveEdit={(f) => handleUpdateWaba(w.id, f)}
                  onCancelEdit={() => setEditingWabaId(null)}
                  onDelete={() => handleDeleteWaba(w.id)}
                  onAddPhone={(phone) => handleCreatePhone(w.id, phone)}
                  onDeletePhone={(pid) => handleDeletePhone(w.id, pid)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── WABA item (expanded inside modal) ────────────────────────────────────────

function WabaItem({ waba, editing, onEdit, onSaveEdit, onCancelEdit, onDelete, onAddPhone, onDeletePhone }) {
  const [newPhone, setNewPhone] = useState('')
  const [addingPhone, setAddingPhone] = useState(false)
  const [savingPhone, setSavingPhone] = useState(false)

  async function handleAddPhone(e) {
    e.preventDefault()
    if (!newPhone.trim()) return
    setSavingPhone(true)
    try {
      await onAddPhone(newPhone.trim())
      setNewPhone('')
      setAddingPhone(false)
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setSavingPhone(false)
    }
  }

  return (
    <div className="kb-waba-item">
      {editing ? (
        <WabaForm initial={waba} onSave={onSaveEdit} onCancel={onCancelEdit} />
      ) : (
        <div className="kb-waba-header">
          <div className="kb-waba-info">
            <span className="kb-waba-name">{waba.waba_name || <span style={{ color: '#4a5568' }}>WABA sem nome</span>}</span>
            {waba.waba_id && <span className="kb-waba-id">{waba.waba_id}</span>}
          </div>
          <div className="kb-waba-actions">
            <button type="button" className="kb-icon-btn" onClick={onEdit} title="Editar WABA"><IconEdit /></button>
            <button type="button" className="kb-icon-btn kb-icon-btn--danger" onClick={onDelete} title="Remover WABA"><IconTrash /></button>
          </div>
        </div>
      )}

      {/* Phones */}
      {!editing && (
        <div className="kb-phones">
          {(waba.phones ?? []).map(p => (
            <div key={p.id} className="kb-phone-row">
              <span className="kb-phone-num">{p.phone_number}</span>
              <button type="button" className="kb-icon-btn kb-icon-btn--danger" style={{ width: 22, height: 22 }} onClick={() => onDeletePhone(p.id)} title="Remover número">
                <IconX />
              </button>
            </div>
          ))}

          {addingPhone ? (
            <form className="kb-phone-add-form" onSubmit={handleAddPhone}>
              <input
                className="kb-phone-input"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                placeholder="+55 11 99999-9999"
                autoFocus
              />
              <button type="submit" className="kb-btn kb-btn--primary kb-btn--sm" disabled={savingPhone || !newPhone.trim()}>
                {savingPhone ? '…' : 'Add'}
              </button>
              <button type="button" className="kb-btn kb-btn--ghost kb-btn--sm" onClick={() => { setAddingPhone(false); setNewPhone('') }}>✕</button>
            </form>
          ) : (
            <button type="button" className="kb-phone-add-btn" onClick={() => setAddingPhone(true)}>
              <IconPlus /> Adicionar número
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── WABA form ────────────────────────────────────────────────────────────────

function WabaForm({ initial, onSave, onCancel }) {
  const [form, setForm]     = useState(initial ? { waba_id: initial.waba_id || '', waba_name: initial.waba_name || '' } : { waba_id: '', waba_name: '' })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(form)
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="kb-waba-form">
      <div className="kb-form-2col">
        <div className="kb-form-row">
          <label>WABA ID</label>
          <input value={form.waba_id} onChange={e => setForm(f => ({ ...f, waba_id: e.target.value }))} placeholder="ID da WABA" className="kb-mono" />
        </div>
        <div className="kb-form-row">
          <label>WABA Nome</label>
          <input value={form.waba_name} onChange={e => setForm(f => ({ ...f, waba_name: e.target.value }))} placeholder="Nome da WABA" />
        </div>
      </div>
      <div className="kb-waba-form-btns">
        <button type="button" className="kb-btn kb-btn--primary kb-btn--sm" disabled={saving} onClick={handleSave}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" className="kb-btn kb-btn--ghost kb-btn--sm" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Kanban() {
  const { columns, cards, loading, error, loadBoard, createColumn, updateColumn, deleteColumn, createCard, updateCard, deleteCard, moveCard, moveColumn } = useKanban()
  const [newColName, setNewColName] = useState('')
  const [addingCol, setAddingCol]   = useState(false)
  const [modal, setModal]           = useState(null)
  const [activeCardId, setActiveCardId] = useState(null)
  const [activeColId,  setActiveColId]  = useState(null)
  const [search,       setSearch]       = useState('')
  const [filterCol,    setFilterCol]    = useState('')
  const newColRef = useRef(null)

  useEffect(() => { loadBoard() }, [loadBoard])
  useEffect(() => { if (addingCol) newColRef.current?.focus() }, [addingCol])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // ── Filtering ──
  const filteredCardIds = useMemo(() => {
    if (!search.trim()) return null  // null = show all
    const q = search.toLowerCase()
    return new Set(
      cards
        .filter(c => {
          if (c.profile_name?.toLowerCase().includes(q)) return true
          if (c.bm_name?.toLowerCase().includes(q)) return true
          const phones = (c.wabas ?? []).flatMap(w => (w.phones ?? []).map(p => p.phone_number))
          if (phones.some(p => p.toLowerCase().includes(q))) return true
          return false
        })
        .map(c => c.id)
    )
  }, [cards, search])

  function cardsForColumn(colId) {
    let list = cards.filter(c => c.column_id === colId).sort((a, b) => a.position - b.position)
    if (filteredCardIds) list = list.filter(c => filteredCardIds.has(c.id))
    return list
  }

  async function handleAddColumn(e) {
    e.preventDefault()
    if (!newColName.trim()) return
    try {
      await createColumn({ title: newColName.trim() })
      setNewColName('')
      setAddingCol(false)
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    }
  }

  async function handleDeleteColumn(id, cardCount) {
    if (cardCount > 0) { alert('Mova ou remova os cards antes de deletar esta coluna.'); return }
    if (!window.confirm('Deletar esta coluna?')) return
    try { await deleteColumn(id) } catch (err) { alert(err.response?.data?.error || err.message) }
  }

  async function handleRenameColumn(id, title) {
    try { await updateColumn(id, { title }) } catch (err) { alert(err.response?.data?.error || err.message) }
  }

  async function handleDeleteCard(id) {
    if (!window.confirm('Deletar este card?')) return
    try { await deleteCard(id) } catch (err) { alert(err.response?.data?.error || err.message) }
  }

  async function handleSaveCard(form) {
    if (modal.mode === 'create') {
      return await createCard({ ...form, column_id: modal.columnId })
    } else {
      return await updateCard(modal.card.id, form)
    }
  }

  function handleCardUpdated() { loadBoard() }

  function handleDragStart({ active }) {
    const id = String(active.id)
    if (id.startsWith('col-')) {
      setActiveColId(Number(id.replace('col-', '')))
    } else {
      setActiveCardId(Number(id.replace('card-', '')))
    }
  }

  function handleDragEnd({ active, over }) {
    setActiveCardId(null)
    setActiveColId(null)
    if (!over) return

    const activeStr = String(active.id)
    const overStr   = String(over.id)

    // ── Column reorder ──
    if (activeStr.startsWith('col-') && overStr.startsWith('col-')) {
      const aId = Number(activeStr.replace('col-', ''))
      const oId = Number(overStr.replace('col-', ''))
      if (aId !== oId) moveColumn(aId, oId)
      return
    }

    // ── Card move ──
    if (activeStr.startsWith('card-')) {
      const cardId = Number(activeStr.replace('card-', ''))
      if (overStr.startsWith('col-')) {
        const colId    = Number(overStr.replace('col-', ''))
        const colCards = cardsForColumn(colId)
        const dragging = cards.find(c => c.id === cardId)
        if (dragging && dragging.column_id === colId && colCards.length <= 1) return
        moveCard(cardId, colId, colCards.length)
      } else if (overStr.startsWith('card-')) {
        const overCardId = Number(overStr.replace('card-', ''))
        if (cardId === overCardId) return
        const overCard = cards.find(c => c.id === overCardId)
        if (!overCard) return
        moveCard(cardId, overCard.column_id, overCard.position)
      }
    }
  }

  const activeCard = activeCardId ? cards.find(c => c.id === activeCardId) : null
  const activeCol  = activeColId  ? columns.find(c => c.id === activeColId)  : null

  const matchCount = filteredCardIds ? filteredCardIds.size : null

  return (
    <>
      <style>{CSS_STR}</style>
      <div className="page-root">
        <div className="kb-topbar">
          <div>
            <h1 className="kb-page-title">Kanban BMs</h1>
            <p className="kb-page-sub">Organize suas Business Managers em colunas</p>
          </div>
          {!addingCol && (
            <button className="kb-btn kb-btn--primary" onClick={() => setAddingCol(true)}>
              <IconPlus /> Nova coluna
            </button>
          )}
        </div>

        {/* ── Filters ── */}
        <div className="kb-filters">
          <input
            className="kb-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome de BM, perfil ou número…"
          />
          {search && (
            <button className="kb-search-clear" onClick={() => setSearch('')} title="Limpar busca">
              <IconX />
            </button>
          )}
          {matchCount !== null && (
            <span className="kb-filter-count">
              {matchCount} card{matchCount !== 1 ? 's' : ''} encontrado{matchCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {error && <div className="kb-error">⚠ {error}</div>}

        {addingCol && (
          <form className="kb-new-col-form" onSubmit={handleAddColumn}>
            <input
              ref={newColRef}
              value={newColName}
              onChange={e => setNewColName(e.target.value)}
              placeholder="Nome da coluna"
              className="kb-new-col-input"
            />
            <button type="submit" className="kb-btn kb-btn--primary" disabled={!newColName.trim()}>Criar</button>
            <button type="button" className="kb-btn kb-btn--ghost" onClick={() => { setAddingCol(false); setNewColName('') }}>Cancelar</button>
          </form>
        )}

        {loading ? (
          <div className="kb-loading">Carregando board…</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* Outer SortableContext for columns */}
            <SortableContext
              items={columns.map(c => `col-${c.id}`)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="kb-board">
                {columns.map(col => (
                  <KanbanColumn
                    key={col.id}
                    column={col}
                    cards={cardsForColumn(col.id)}
                    onAddCard={(colId) => setModal({ mode: 'create', columnId: colId })}
                    onEditCard={(card) => setModal({ mode: 'edit', card })}
                    onDeleteCard={handleDeleteCard}
                    onDeleteColumn={handleDeleteColumn}
                    onRenameColumn={handleRenameColumn}
                    activeCardId={activeCardId}
                    isColDragging={activeColId === col.id}
                  />
                ))}
                {columns.length === 0 && !loading && (
                  <div className="kb-empty">Nenhuma coluna ainda. Clique em "Nova coluna" para começar.</div>
                )}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeCard && (
                <div className="kb-card kb-card--dragging">
                  <span className="kb-card-name">{activeCard.bm_name || activeCard.profile_name || '—'}</span>
                </div>
              )}
              {activeCol && (
                <div className="kb-col kb-col--dragging">
                  <div className="kb-col-header">
                    <span className="kb-col-dot" style={{ background: activeCol.color || '#8a94a6' }} />
                    <span className="kb-col-title">{activeCol.title}</span>
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {modal && (
        <CardModal
          initial={modal.mode === 'edit' ? modal.card : null}
          columnId={modal.columnId}
          onSave={handleSaveCard}
          onCardUpdated={handleCardUpdated}
          onClose={() => { setModal(null); loadBoard() }}
        />
      )}
    </>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS_STR = `
  .kb-topbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .kb-page-title { font-size: 20px; font-weight: 600; color: #e8edf5; }
  .kb-page-sub   { font-size: 13px; color: #8a94a6; margin-top: 2px; }

  /* ── Filters ── */
  .kb-filters {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    position: relative;
  }
  .kb-search {
    flex: 1;
    min-width: 240px;
    background: #141820;
    border: 1px solid #252c38;
    border-radius: 8px;
    color: #e8edf5;
    font-family: inherit;
    font-size: 13px;
    padding: 8px 36px 8px 12px;
    outline: none;
    transition: border-color 0.15s;
  }
  .kb-search:focus { border-color: #22c55e; }
  .kb-search-clear {
    position: absolute;
    right: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: none;
    border: none;
    color: #4a5568;
    cursor: pointer;
    margin-left: -38px;
    transition: color 0.12s;
    flex-shrink: 0;
  }
  .kb-search-clear:hover { color: #8a94a6; }
  .kb-filter-count {
    font-size: 12px;
    color: #22c55e;
    white-space: nowrap;
  }

  .kb-new-col-form {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #141820;
    border: 1px solid #252c38;
    border-radius: 10px;
    padding: 12px 16px;
  }
  .kb-new-col-input {
    flex: 1;
    background: #1a1f28;
    border: 1px solid #252c38;
    border-radius: 7px;
    color: #e8edf5;
    font-family: inherit;
    font-size: 13px;
    padding: 7px 11px;
    outline: none;
    min-width: 0;
  }
  .kb-new-col-input:focus { border-color: #22c55e; }

  .kb-board {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    padding-bottom: 16px;
    align-items: flex-start;
  }
  .kb-board::-webkit-scrollbar { height: 4px; }
  .kb-board::-webkit-scrollbar-track { background: transparent; }
  .kb-board::-webkit-scrollbar-thumb { background: #252c38; border-radius: 2px; }

  .kb-col {
    flex: 0 0 280px;
    background: #0f1215;
    border: 1px solid #252c38;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 200px);
  }
  .kb-col--dragging { opacity: 0.5; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }

  .kb-col-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px 10px;
    border-bottom: 1px solid #1a2030;
    gap: 8px;
  }
  .kb-col-grip {
    display: flex;
    align-items: center;
    color: #252c38;
    cursor: grab;
    flex-shrink: 0;
    padding: 2px;
    border-radius: 4px;
    transition: color 0.12s;
  }
  .kb-col-grip:hover { color: #4a5568; }
  .kb-col-grip:active { cursor: grabbing; }
  .kb-col-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }
  .kb-col-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .kb-col-title {
    font-size: 13px;
    font-weight: 600;
    color: #e8edf5;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kb-col-title:hover { color: #22c55e; }
  .kb-col-title-input {
    flex: 1;
    background: #1a1f28;
    border: 1px solid #22c55e;
    border-radius: 5px;
    color: #e8edf5;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    padding: 2px 6px;
    outline: none;
    min-width: 0;
  }
  .kb-col-count {
    font-size: 11px;
    color: #4a5568;
    background: #1a1f28;
    border: 1px solid #252c38;
    border-radius: 10px;
    padding: 1px 7px;
    flex-shrink: 0;
  }
  .kb-col-avg {
    font-size: 10px;
    font-weight: 500;
    padding: 1px 6px;
    background: #1a1f28;
    border: 1px solid #252c38;
    border-radius: 8px;
    flex-shrink: 0;
  }
  .kb-col-meta-actions { display: flex; gap: 4px; flex-shrink: 0; }

  .kb-col-cards {
    flex: 1;
    overflow-y: auto;
    padding: 10px 10px 4px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .kb-col-cards::-webkit-scrollbar { width: 3px; }
  .kb-col-cards::-webkit-scrollbar-thumb { background: #252c38; }

  .kb-card {
    background: #141820;
    border: 1px solid #252c38;
    border-radius: 9px;
    padding: 11px 12px;
    cursor: grab;
    transition: border-color 0.15s, box-shadow 0.15s;
    user-select: none;
  }
  .kb-card:hover { border-color: #374151; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
  .kb-card--dragging { box-shadow: 0 8px 24px rgba(0,0,0,0.5); border-color: #22c55e; cursor: grabbing; }

  .kb-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .kb-card-title-block {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }
  .kb-card-name {
    font-size: 14px;
    font-weight: 600;
    color: #e8edf5;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kb-card-sub {
    font-size: 11px;
    color: #4a5568;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kb-card-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s;
    flex-shrink: 0;
  }
  .kb-card:hover .kb-card-actions { opacity: 1; }

  .kb-card-row {
    display: flex;
    gap: 6px;
    font-size: 11px;
    color: #8a94a6;
    margin-top: 3px;
    align-items: baseline;
  }
  .kb-card-label {
    color: #4a5568;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .kb-card-mono { font-family: 'JetBrains Mono', monospace; font-size: 10px; }
  .kb-card-notes {
    margin-top: 7px;
    font-size: 11px;
    color: #8a94a6;
    border-top: 1px solid #1a2030;
    padding-top: 6px;
    line-height: 1.5;
    white-space: pre-wrap;
  }
  .kb-card-footer {
    margin-top: 7px;
    border-top: 1px solid #1a2030;
    padding-top: 6px;
  }
  .kb-days-badge {
    font-size: 10px;
    font-weight: 500;
  }

  .kb-add-card-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 9px 14px;
    background: none;
    border: none;
    border-top: 1px solid #1a2030;
    color: #4a5568;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    border-radius: 0 0 12px 12px;
    transition: color 0.15s, background 0.15s;
    text-align: left;
  }
  .kb-add-card-btn:hover { color: #22c55e; background: #22c55e08; }

  .kb-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: none;
    background: none;
    color: #4a5568;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
    padding: 0;
  }
  .kb-icon-btn:hover { color: #8a94a6; background: #1a1f28; }
  .kb-icon-btn--danger:hover { color: #ef4444; background: #ef444415; }
  .kb-icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .kb-icon-btn:disabled:hover { color: #4a5568; background: none; }

  .kb-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    font-size: 13px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.15s, background 0.15s;
    white-space: nowrap;
  }
  .kb-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .kb-btn--primary { background: #22c55e; color: #0a0c0f; }
  .kb-btn--primary:hover:not(:disabled) { background: #16a34a; }
  .kb-btn--ghost { background: #1a1f28; color: #8a94a6; border: 1px solid #252c38; }
  .kb-btn--ghost:hover:not(:disabled) { color: #e8edf5; border-color: #374151; }
  .kb-btn--sm { padding: 5px 10px; font-size: 12px; }

  .kb-empty { color: #4a5568; font-size: 14px; padding: 40px 0; }
  .kb-loading { color: #4a5568; font-size: 14px; padding: 40px 0; }
  .kb-error { background: #ef444415; border: 1px solid #ef444435; color: #ef4444; border-radius: 8px; padding: 10px 14px; font-size: 13px; }

  /* ── Modal ── */
  .kb-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
  }
  .kb-modal {
    background: #0f1215;
    border: 1px solid #252c38;
    border-radius: 14px;
    width: 100%;
    max-width: 540px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 24px 64px rgba(0,0,0,0.6);
  }
  .kb-modal::-webkit-scrollbar { width: 4px; }
  .kb-modal::-webkit-scrollbar-thumb { background: #252c38; }
  .kb-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 14px;
    border-bottom: 1px solid #1a2030;
    font-size: 15px;
    font-weight: 600;
    color: #e8edf5;
  }
  .kb-modal-body { padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; }
  .kb-form-row { display: flex; flex-direction: column; gap: 5px; }
  .kb-form-row label { font-size: 11px; color: #8a94a6; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; }
  .kb-form-row input,
  .kb-form-row textarea {
    background: #1a1f28;
    border: 1px solid #252c38;
    border-radius: 7px;
    color: #e8edf5;
    font-size: 13px;
    font-family: inherit;
    padding: 8px 11px;
    outline: none;
    resize: vertical;
    transition: border-color 0.15s;
  }
  .kb-form-row input:focus,
  .kb-form-row textarea:focus { border-color: #22c55e; }
  .kb-form-row input.kb-mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
  .kb-form-row input:disabled,
  .kb-form-row textarea:disabled { opacity: 0.5; cursor: default; }
  .kb-form-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .kb-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 6px;
    border-top: 1px solid #1a2030;
    margin-top: 4px;
    padding-bottom: 2px;
  }

  /* ── WABAs section ── */
  .kb-waba-section {
    border-top: 1px solid #1a2030;
    padding-top: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .kb-waba-section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    font-weight: 600;
    color: #8a94a6;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .kb-empty-wabas { font-size: 12px; color: #4a5568; padding: 6px 0; }

  .kb-waba-item {
    background: #141820;
    border: 1px solid #252c38;
    border-radius: 8px;
    padding: 10px 12px;
  }
  .kb-waba-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .kb-waba-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .kb-waba-name { font-size: 13px; font-weight: 600; color: #e8edf5; }
  .kb-waba-id { font-size: 10px; color: #4a5568; font-family: 'JetBrains Mono', monospace; }
  .kb-waba-actions { display: flex; gap: 4px; flex-shrink: 0; }

  .kb-waba-form {
    background: #0f1215;
    border: 1px solid #252c38;
    border-radius: 8px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .kb-waba-form-btns { display: flex; gap: 6px; }

  /* ── Phones ── */
  .kb-phones {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #1a2030;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .kb-phone-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .kb-phone-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #c4cdd8;
  }
  .kb-phone-add-form {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .kb-phone-input {
    flex: 1;
    background: #1a1f28;
    border: 1px solid #252c38;
    border-radius: 6px;
    color: #e8edf5;
    font-size: 12px;
    font-family: 'JetBrains Mono', monospace;
    padding: 5px 9px;
    outline: none;
    transition: border-color 0.15s;
  }
  .kb-phone-input:focus { border-color: #22c55e; }
  .kb-phone-add-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: none;
    color: #4a5568;
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
    padding: 3px 0;
    transition: color 0.15s;
  }
  .kb-phone-add-btn:hover { color: #22c55e; }
`
