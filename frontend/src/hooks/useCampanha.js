import { useState, useCallback } from 'react'
import * as campanhaService from '../services/campanhaService'

/**
 * Central state for the "Novo Disparo" wizard.
 *
 * Shape of `draft`:
 * {
 *   // Step 1 — CSV
 *   csvFile:    File | null
 *   columns:    string[]
 *   preview:    object[]
 *   totalRows:  number
 *
 *   // Step 2 — Configuration
 *   name:           string
 *   wabaId:         string
 *   phoneNumberId:  string
 *   speed:          number          // messages per second
 *   scheduleType:   'immediate' | 'scheduled'
 *   scheduledAt:    string          // ISO date-time string
 *   templates:      { templateId, wabaId, name, structure }[]
 *   splitMode:      'equal' | 'weighted'
 *   weights:        number[]        // one per template, sum 100
 *
 *   // Step 3 — Personalisation (keyed by templateId)
 *   personalisation: {
 *     [templateId]: {
 *       mediaUrl:    string
 *       varTemplates: { [varIndex]: string }
 *         // Free-text template per variable. May contain {{column_name}} tokens
 *         // that are resolved per-row at dispatch time.
 *         // Example: { "1": "Olá {{nome}}, sua fatura vence em {{data}}." }
 *     }
 *   }
 * }
 */

const INITIAL_DRAFT = {
  csvFile: null,
  columns: [],
  preview: [],
  totalRows: 0,
  phoneColumn: '',
  name: '',
  wabaId: '',
  phoneNumberId: '',
  speed: 5,
  scheduleType: 'immediate',
  scheduledAt: '',
  templates: [],
  splitMode: 'equal',
  weights: [],
  personalisation: {},
}

export function useCampanha() {
  const [draft,       setDraft]       = useState(INITIAL_DRAFT)
  const [uploading,   setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [campaignId,  setCampaignId]  = useState(null)

  // ── Step helpers ────────────────────────────────────────────────────────────

  const setCSVData = useCallback((data) => {
    setDraft(prev => ({
      ...prev,
      csvFile:     data.file,
      columns:     data.columns,
      preview:     data.preview,
      totalRows:   data.totalRows,
      phoneColumn: data.phoneColumn ?? prev.phoneColumn,
      // reset downstream state when CSV changes
      personalisation: {},
    }))
  }, [])

  const setConfig = useCallback((fields) => {
    setDraft(prev => {
      const next = { ...prev, ...fields }
      // When templates change, rebuild weights array
      if (fields.templates !== undefined) {
        const n = fields.templates.length
        next.weights = Array(n).fill(Math.floor(100 / n))
        // give remainder to last
        const rem = 100 - next.weights.reduce((s, w) => s + w, 0)
        if (n > 0) next.weights[n - 1] += rem
        // reset personalisation for removed templates
        const ids = new Set(fields.templates.map(t => t.templateId))
        next.personalisation = Object.fromEntries(
          Object.entries(prev.personalisation).filter(([id]) => ids.has(id))
        )
      }
      return next
    })
  }, [])

  const setPersonalisation = useCallback((templateId, fields) => {
    setDraft(prev => ({
      ...prev,
      personalisation: {
        ...prev.personalisation,
        [templateId]: {
          ...(prev.personalisation[templateId] || {}),
          ...fields,
        },
      },
    }))
  }, [])

  // ── Upload CSV ───────────────────────────────────────────────────────────────

  const uploadFile = useCallback(async (file) => {
    setUploading(true)
    setUploadError('')
    try {
      const result = await campanhaService.uploadCSV(file)
      setCSVData({ file, columns: result.columns, preview: result.preview, totalRows: result.total_rows })
      return result
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao processar o CSV.'
      setUploadError(msg)
      throw new Error(msg)
    } finally {
      setUploading(false)
    }
  }, [setCSVData])

  // ── Submit campaign ───────────────────────────────────────────────────────────

  const submit = useCallback(async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      // scheduledAt is stored as local datetime string (YYYY-MM-DDTHH:mm).
      // Convert to UTC ISO string before sending to backend.
      const payload = { ...draft }
      if (draft.scheduleType === 'scheduled' && draft.scheduledAt) {
        payload.scheduledAt = new Date(draft.scheduledAt).toISOString()
      }
      const result = await campanhaService.createCampanha(payload)
      setCampaignId(result.campaign_id)
      return result
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao criar a campanha.'
      setSubmitError(msg)
      throw new Error(msg)
    } finally {
      setSubmitting(false)
    }
  }, [draft])

  const reset = useCallback(() => {
    setDraft(INITIAL_DRAFT)
    setUploadError('')
    setSubmitError('')
    setCampaignId(null)
  }, [])

  return {
    draft,
    uploading, uploadError,
    submitting, submitError,
    campaignId,
    setCSVData,
    setConfig,
    setPersonalisation,
    uploadFile,
    submit,
    reset,
  }
}
