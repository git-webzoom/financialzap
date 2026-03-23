const axios = require('axios')

const BASE_URL = process.env.META_API_BASE_URL || 'https://graph.facebook.com'
const API_VERSION = process.env.META_API_VERSION || 'v20.0'

const metaApi = axios.create({ baseURL: `${BASE_URL}/${API_VERSION}` })

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
    fields: 'id,name,status,category,language,components',
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
  getWabaInfo,
  getPhoneNumbers,
  getPhoneNumberInfo,
  getTemplates,
  createTemplate,
  sendMessage,
}
