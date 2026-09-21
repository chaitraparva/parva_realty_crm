const livekitService = require('../services/livekitService')

// Room name validation regex: 1 to 128 characters, alphanumeric and safe delimiters
const ROOM_NAME_REGEX = /^[a-zA-Z0-9_\-\.:]{1,128}$/

/**
 * POST /api/livekit/token
 * Generates a LiveKit access token for the authenticated CRM user.
 */
const getToken = async (req, res) => {
  const { roomName } = req.body || {}

  if (!roomName || typeof roomName !== 'string' || !roomName.trim()) {
    return res.status(400).json({ message: 'roomName is required' })
  }

  const trimmedRoom = roomName.trim()
  if (trimmedRoom.length > 128 || !ROOM_NAME_REGEX.test(trimmedRoom)) {
    return res.status(400).json({
      message: 'Invalid roomName: must be 1-128 characters (letters, numbers, hyphens, underscores, dots, or colons)',
    })
  }

  // Ensure authenticated user information is present
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: 'User not authenticated' })
  }

  try {
    const result = await livekitService.createToken({
      roomName: trimmedRoom,
      identity: req.user.id,     // Employee UUID (never email or PII)
      name: req.user.name || '', // Employee display name
    })

    return res.json({
      token: result.token,
      serverUrl: result.serverUrl,
    })
  } catch (err) {
    console.error('[LiveKit] Token generation error:', err.message)
    return res.status(500).json({
      message: 'Failed to generate LiveKit room token. Please ensure server environment variables are configured.',
    })
  }
}

/**
 * GET /api/livekit/health
 * Public, safe check to verify whether LiveKit is configured without leaking any secrets.
 */
const getHealth = (_req, res) => {
  res.json({
    status: 'ok',
    configured: livekitService.isConfigured(),
  })
}

module.exports = {
  getToken,
  getHealth,
}
