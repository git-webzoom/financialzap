const axios = require('axios')

const BASE_URL = process.env.META_API_BASE_URL || 'https://graph.facebook.com'
const API_VERSION = process.env.META_API_VERSION || 'v20.0'

const metaApi = axios.create({ baseURL: `${BASE_URL}/${API_VERSION}` })

// ─── WABAs from token ─────────────────────────────────────────────────────────

/**
 * List all WABAs accessible by an access token.
 *
 * Tries multiple strategies in order (different token types expose different endpoints):
 *
 * Strategy 1 — Business portfolio: /me/businesses → owned_whatsapp_business_accounts
 *   Works for User tokens and System User tokens with business_management permission.
 *
 * Strategy 2 — Direct WABA list: /me/whatsapp_business_accounts
 *   Works for tokens with whatsapp_business_management permission granted directly.
 *
 * Strategy 3 — Token is a WABA itself: treat /me as a WABA node.
 *   Works when the token was issued directly from a WABA (e.g. permanent system user token
 *   scoped to a specific WABA — /me returns the WABA object).
 *
 * Returns: [{ waba_id, name }]
 */
async function getWabasFromToken(accessToken) {
  const wabaMap = {} // waba_id → name, deduplicates across strategies

  // ── Strategy 1: businesses → owned WABAs ────────────────────────────────────
  try {
    const { data: bmData } = await metaApi.get('/me/businesses', {
      params: {
        fields: 'id,name,owned_whatsapp_business_accounts{id,name}',
        access_token: accessToken,
        limit: 100,
      },
    })
    for (const bm of bmData.data || []) {
      for (const w of bm.owned_whatsapp_business_accounts?.data || []) {
        wabaMap[w.id] = w.name || w.id
      }
    }
  } catch {
    // token type doesn't support /me/businesses — continue
  }

  // ── Strategy 2: direct WABA list ────────────────────────────────────────────
  try {
    const { data: wabaData } = await metaApi.get('/me/whatsapp_business_accounts', {
      params: {
        fields: 'id,name',
        access_token: accessToken,
        limit: 100,
      },
    })
    for (const w of wabaData.data || []) {
      wabaMap[w.id] = w.name || w.id
    }
  } catch {
    // token type doesn't support this endpoint — continue
  }

  // ── Strategy 3: token is scoped to a WABA directly ──────────────────────────
  if (!Object.keys(wabaMap).length) {
    try {
      const { data: me } = await metaApi.get('/me', {
        params: { fields: 'id,name', access_token: accessToken },
      })
      // If /me returns an object that looks like a WABA (has an id), try it as a WABA
      if (me.id) {
        try {
          const info = await getWabaInfo(me.id, accessToken)
          // getWabaInfo succeeds only if id is a valid WABA — has currency or timezone fields
          if (info.currency || info.timezone_id || info.name) {
            wabaMap[me.id] = info.name || me.id
          }
        } catch {
          // not a WABA node
        }
      }
    } catch {
      // ignore
    }
  }

  if (!Object.keys(wabaMap).length) {
    throw Object.assign(
      new Error('Nenhuma WABA encontrada para este token. Verifique se o token possui as permissões whatsapp_business_management ou business_management.'),
      { status: 422 }
    )
  }

  return Object.entries(wabaMap).map(([waba_id, name]) => ({ waba_id, name }))
}

// ─── WABA info ────────────────────────────────────────────────────────────────

/**
 * Fetch WABA metadata including the owning Business Manager.
 * Returns: { id, name, currency, timezone_id, owner_business_info: { id, name } }
 */
async function getWabaInfo(wabaId, accessToken) {
  const { data } = await metaApi.get(`/${wabaId}`, {
    params: {
      fields: 'id,name,currency,timezone_id,owner_business_info',
      access_token: accessToken,
    },
  })
  return data
}

// ─── Phone numbers ────────────────────────────────────────────────────────────

/**
 * List all phone numbers registered under a WABA.
 */
async function getPhoneNumbers(wabaId, accessToken) {
  const { data } = await metaApi.get(`/${wabaId}/phone_numbers`, {
    params: {
      fields: 'id,display_phone_number,verified_name,quality_rating,messaging_limit_tier,status,is_verified_business',
      access_token: accessToken,
    },
  })
  return data.data || []
}

/**
 * Get detailed info for a single phone number.
 */
async function getPhoneNumberInfo(phoneNumberId, accessToken) {
  const { data } = await metaApi.get(`/${phoneNumberId}`, {
    params: {
      fields: 'id,display_phone_number,verified_name,quality_rating,messaging_limit_tier,status,is_verified_business',
      access_token: accessToken,
    },
  })
  return data
}

// ─── Templates ────────────────────────────────────────────────────────────────

/**
 * Fetch all message templates for a WABA (follows pagination automatically).
 */
async function getTemplates(wabaId, accessToken) {
  const templates = []
  let params = {
    fields: 'id,name,status,category,language,components,quality_score,rejected_reason',
    limit: 100,
    access_token: accessToken,
  }
  let url = `/${wabaId}/message_templates`

  while (url) {
    const { data } = await metaApi.get(url, { params })
    templates.push(...(data.data || []))

    const after = data.paging?.cursors?.after
    if (after && data.paging?.next) {
      params = { ...params, after }
    } else {
      url = null
    }
  }

  return templates
}

/**
 * Create a new message template.
 */
async function createTemplate(wabaId, accessToken, payload) {
  const { data } = await metaApi.post(`/${wabaId}/message_templates`, payload, {
    params: { access_token: accessToken },
  })
  return data
}

/**
 * Delete a message template by name (Meta requires name, not ID).
 */
async function deleteTemplate(wabaId, accessToken, templateName) {
  const { data } = await metaApi.delete(`/${wabaId}/message_templates`, {
    params: { access_token: accessToken, name: templateName },
  })
  return data
}

// ─── Send message ─────────────────────────────────────────────────────────────

/**
 * Send a WhatsApp message via Cloud API.
 */
async function sendMessage(phoneNumberId, accessToken, payload) {
  const { data } = await metaApi.post(`/${phoneNumberId}/messages`, payload, {
    params: { access_token: accessToken },
  })
  return data
}

module.exports = {
  getWabasFromToken,
  getWabaInfo,
  getPhoneNumbers,
  getPhoneNumberInfo,
  getTemplates,
  createTemplate,
  deleteTemplate,
  sendMessage,
}
