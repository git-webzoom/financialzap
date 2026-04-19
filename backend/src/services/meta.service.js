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
  const log = (tag, msg) => console.log(`[getWabasFromToken] ${tag}: ${msg}`)

  // ── Resolve /me first — needed by multiple strategies ───────────────────────
  let meId = null
  try {
    const { data: me } = await metaApi.get('/me', {
      params: { fields: 'id,name', access_token: accessToken },
    })
    meId = me.id
    log('me', `id=${me.id} name=${me.name}`)
  } catch (err) {
    log('me', `failed: ${err.response?.data?.error?.message || err.message}`)
  }

  // ── Strategy 1: System User assigned WABAs ───────────────────────────────────
  // Most common for permanent System User tokens used in WhatsApp integrations.
  if (meId) {
    try {
      const { data } = await metaApi.get(`/${meId}/assigned_whatsapp_business_accounts`, {
        params: { fields: 'id,name', access_token: accessToken, limit: 100 },
      })
      for (const w of data.data || []) {
        wabaMap[w.id] = w.name || w.id
      }
      log('strategy1 assigned_wabas', `found ${Object.keys(wabaMap).length}`)
    } catch (err) {
      log('strategy1 assigned_wabas', `failed: ${err.response?.data?.error?.message || err.message}`)
    }
  }

  // ── Strategy 2: Business portfolio → owned WABAs ────────────────────────────
  // Works for User tokens and admin System User tokens with business_management.
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
    log('strategy2 businesses', `found ${Object.keys(wabaMap).length} total`)
  } catch (err) {
    log('strategy2 businesses', `failed: ${err.response?.data?.error?.message || err.message}`)
  }

  // ── Strategy 3: direct /me/whatsapp_business_accounts ───────────────────────
  // Works for tokens with whatsapp_business_management permission granted directly.
  try {
    const { data: wabaData } = await metaApi.get('/me/whatsapp_business_accounts', {
      params: { fields: 'id,name', access_token: accessToken, limit: 100 },
    })
    for (const w of wabaData.data || []) {
      wabaMap[w.id] = w.name || w.id
    }
    log('strategy3 me/wabas', `found ${Object.keys(wabaMap).length} total`)
  } catch (err) {
    log('strategy3 me/wabas', `failed: ${err.response?.data?.error?.message || err.message}`)
  }

  // ── Strategy 4: Business Manager WABAs via /{bm_id}/whatsapp_business_accounts
  // Needed when the token belongs to an admin of a BM that owns WABAs.
  if (!Object.keys(wabaMap).length && meId) {
    try {
      const { data: bmList } = await metaApi.get(`/${meId}/businesses`, {
        params: { fields: 'id', access_token: accessToken, limit: 100 },
      })
      for (const bm of bmList.data || []) {
        try {
          const { data: wabaList } = await metaApi.get(`/${bm.id}/whatsapp_business_accounts`, {
            params: { fields: 'id,name', access_token: accessToken, limit: 100 },
          })
          for (const w of wabaList.data || []) {
            wabaMap[w.id] = w.name || w.id
          }
        } catch (err2) {
          log('strategy4 bm_wabas', `bm=${bm.id} failed: ${err2.response?.data?.error?.message || err2.message}`)
        }
      }
      log('strategy4 bm_wabas', `found ${Object.keys(wabaMap).length} total`)
    } catch (err) {
      log('strategy4 bm_wabas', `failed: ${err.response?.data?.error?.message || err.message}`)
    }
  }

  // ── Strategy 5: /me itself is a WABA node ───────────────────────────────────
  // Handles tokens permanently scoped to a single WABA.
  if (!Object.keys(wabaMap).length && meId) {
    try {
      const info = await getWabaInfo(meId, accessToken)
      if (info.currency || info.timezone_id || info.name) {
        wabaMap[meId] = info.name || meId
        log('strategy5 me_as_waba', `found waba ${meId}`)
      }
    } catch (err) {
      log('strategy5 me_as_waba', `failed: ${err.response?.data?.error?.message || err.message}`)
    }
  }

  log('result', `total WABAs found: ${Object.keys(wabaMap).length}`)

  if (!Object.keys(wabaMap).length) {
    throw Object.assign(
      new Error('Nenhuma WABA encontrada para este token. Verifique as permissões e tente novamente.'),
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
      fields: 'id,name,currency,timezone_id,owner_business_info,account_review_status,message_template_namespace',
      access_token: accessToken,
    },
  })
  return data
}

/**
 * Fetch health/restriction status directly from Meta for a WABA and its phone numbers.
 * Returns: { waba_review_status, waba_ban_state, waba_decision, phone_numbers: [...] }
 */
async function getWabaHealth(wabaId, accessToken) {
  // WABA-level restriction fields
  const { data: wabaData } = await metaApi.get(`/${wabaId}`, {
    params: {
      fields: 'id,name,account_review_status,ban_state,decision,on_behalf_of_business_info',
      access_token: accessToken,
    },
  })

  // Phone-number-level status (includes health_status, account_mode)
  const { data: phoneData } = await metaApi.get(`/${wabaId}/phone_numbers`, {
    params: {
      fields: 'id,display_phone_number,verified_name,quality_rating,messaging_limit_tier,status,account_mode,health_status',
      access_token: accessToken,
    },
  })

  // BM-level restriction info — on_behalf_of_business_info contains the BM id for WABAs owned on behalf
  const bmId = wabaData.on_behalf_of_business_info?.id
  let bm_restriction_info = null
  if (bmId) {
    try {
      const { data: bmData } = await metaApi.get(`/${bmId}`, {
        params: {
          fields: 'id,name,restriction_info',
          access_token: accessToken,
        },
      })
      bm_restriction_info = {
        bm_id:            bmData.id,
        bm_name:          bmData.name,
        restrictions:     bmData.restriction_info ?? [],
      }
    } catch {
      // BM query may fail if token lacks business_management permission — non-fatal
    }
  }

  return {
    waba_id:               wabaId,
    waba_name:             wabaData.name,
    account_review_status: wabaData.account_review_status ?? null,
    ban_state:             wabaData.ban_state    ?? null,
    decision:              wabaData.decision     ?? null,
    bm_restriction_info,
    // Raw WABA data for full inspection
    raw_waba:              wabaData,
    phone_numbers: (phoneData.data || []).map(p => {
      const hs = p.health_status ?? null
      // Collect all errors from health_status entities
      const healthErrors = []
      for (const entity of hs?.entities || []) {
        for (const err of entity.errors || []) {
          healthErrors.push({
            entity_type:       entity.entity_type,
            can_send_message:  entity.can_send_message,
            error_code:        err.error_code,
            error_description: err.error_description,
            possible_solution: err.possible_solution,
          })
        }
      }
      return {
        id:                   p.id,
        display_phone_number: p.display_phone_number,
        verified_name:        p.verified_name,
        quality_rating:       p.quality_rating,         // GREEN | YELLOW | RED | UNKNOWN
        messaging_limit_tier: p.messaging_limit_tier,   // TIER_1..TIER_4 | TIER_UNLIMITED
        status:               p.status,                 // CONNECTED | FLAGGED | RESTRICTED | RATE_LIMITED | WARNED | OFFLINE | UNKNOWN
        account_mode:         p.account_mode ?? null,   // SANDBOX | LIVE
        can_send_message:     hs?.can_send_message ?? null,
        health_errors:        healthErrors,
        raw_health:           hs,
      }
    }),
  }
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
 * Delete a message template by name + hsm_id (required since Graph API v14+).
 */
async function deleteTemplate(wabaId, accessToken, templateName, templateId) {
  const params = { access_token: accessToken, name: templateName }
  if (templateId) params.hsm_id = templateId
  const { data } = await metaApi.delete(`/${wabaId}/message_templates`, { params })
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

// ─── Webhook subscription ─────────────────────────────────────────────────────

/**
 * Subscribe the app to webhook events for a WABA.
 * This is required for the Meta platform to send webhook notifications
 * (delivered, read, failed status updates) to our webhook URL.
 *
 * Calls POST /{waba-id}/subscribed_apps
 * The access token must have whatsapp_business_messaging permission.
 */
async function subscribeWebhook(wabaId, accessToken) {
  const { data } = await metaApi.post(`/${wabaId}/subscribed_apps`, null, {
    params: { access_token: accessToken },
  })
  return data
}

/**
 * Get current webhook subscriptions for a WABA.
 * Calls GET /{waba-id}/subscribed_apps
 */
async function getWebhookSubscriptions(wabaId, accessToken) {
  const { data } = await metaApi.get(`/${wabaId}/subscribed_apps`, {
    params: { access_token: accessToken },
  })
  return data
}

module.exports = {
  getWabasFromToken,
  getWabaInfo,
  getWabaHealth,
  getPhoneNumbers,
  getPhoneNumberInfo,
  getTemplates,
  createTemplate,
  deleteTemplate,
  sendMessage,
  subscribeWebhook,
  getWebhookSubscriptions,
}
