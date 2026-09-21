const { AccessToken } = require('livekit-server-sdk')

/**
 * Validates that all required LiveKit environment variables are configured.
 * Throws a sanitized error if any are missing.
 */
function getLiveKitConfig() {
  const url = process.env.LIVEKIT_URL
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET

  if (!url || !apiKey || !apiSecret) {
    const missing = []
    if (!url) missing.push('LIVEKIT_URL')
    if (!apiKey) missing.push('LIVEKIT_API_KEY')
    if (!apiSecret) missing.push('LIVEKIT_API_SECRET')
    throw new Error(`LiveKit server configuration incomplete. Missing: ${missing.join(', ')}`)
  }

  return { url, apiKey, apiSecret }
}

/**
 * Checks whether LiveKit environment variables are set.
 * Safe for health checks (does not leak values).
 */
function isConfigured() {
  return Boolean(
    process.env.LIVEKIT_URL &&
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET
  )
}

/**
 * Generates an AccessToken for a participant to join a LiveKit room.
 *
 * @param {Object} params
 * @param {string} params.roomName - The room identifier
 * @param {string} params.identity - Participant UUID (authenticated employee ID)
 * @param {string} [params.name] - Participant display name
 * @returns {Promise<{ token: string, serverUrl: string }>}
 */
async function createToken({ roomName, identity, name }) {
  const { url, apiKey, apiSecret } = getLiveKitConfig()

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: name || undefined,
    ttl: '2h', // Token validity: 2 hours
  })

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  })

  const token = await at.toJwt()

  return {
    token,
    serverUrl: url,
  }
}

module.exports = {
  createToken,
  isConfigured,
}
