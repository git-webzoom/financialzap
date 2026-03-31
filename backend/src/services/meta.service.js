const axios = require('axios')

const BASE_URL = process.env.META_API_BASE_URL || 'https://graph.facebook.com'
const API_VERSION = process.env.META_API_VERSION || 'v20.0'

const metaApi = axios.create({ baseURL: `${BASE_URL}/${API_VERSION}` })

// ─── WABAs from token ─────────────────────────────────────────────────────────

/**
 * List all WABAs accessible by an access token.
 * Uses /me?fields=granular_scopes to find WABA IDs, then fetches each WABA's name.
 * Returns: [{ waba_id, name }]
 */
async function getWabasFromToken(accessToken) {
  // Step 1: get the user ID this token belongs to
  const { data: meData } = await metaApi.get('/me', {
    params: {
      fields: 'id,name,granular_scopes',
      access_token: accessToken,
    },
  })

  // granular_scopes includes whatsapp_business_management with target_ids = waba_ids
  const wabaIds = []
  if (Array.isArray(meData.granular_scopes)) {
    for (const scope of meData.granular_scopes) {
      if (scope.scope === 'whatsapp_business_management' && Array.isArray(scope.target_ids)) {
        wabaIds.push(...scope.target_ids)
      }
    }
  }

  // If granular_scopes didn't yield results, try fetching WABAs from business accounts
  if (!wabaIds.length) {
    // Try fetching WABAs via the token owner's business accounts
    try {
      const { data: bmData } = await metaApi.get('/me/businesses', {
        params: {
          fields: 'id,name,owned_whatsapp_business_accounts{id,name}',
          access_token: accessToken,
        },
      })
      for (const bm of bmData.data || []) {
        for (const waba of bm.owned_whatsapp_business_accounts?.data || []) {
          wabaIds.push(waba.id)
        }
      }
    } catch {
      // ignore — will return empty list
    }
  }

  // Deduplicate
  const uniqueIds = [...new Set(wabaIds)]

  // Step 2: fetch name for each WABA
  const results = await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const info = await getWabaInfo(id, accessToken)
        return { waba_id: id, name: info.name || id }
      } catch {
        // If we can't fetch info, still return the id so user can connect it
        return { waba_id: id, name: id }
      }
    })
  )

  return results
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
