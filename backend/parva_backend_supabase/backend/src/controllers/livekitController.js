const { supabaseAdmin } = require('../config/supabase')
const livekitService = require('../services/livekitService')

// UUID v4 validation — conversation IDs are always UUIDs in this CRM
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * POST /api/livekit/token
 *
 * Security model:
 *  1. Caller must be authenticated (handled by `protect` middleware → req.user).
 *  2. Caller supplies a conversationId (UUID) — never a raw roomName.
 *  3. Backend verifies the conversation exists in public.conversations.
 *  4. Backend verifies the caller is an active member of conversation_members.
 *  5. Room name is derived server-side: "lk_conv_<conversationId>"
 *     — deterministic so all authorized members join the same room
 *     — never influenced by client input.
 *  6. Token is issued only after all checks pass.
 *
 * Request body: { "conversationId": "<uuid>" }
 * Response:     { "token": "...", "serverUrl": "...", "roomName": "..." }
 */
const getToken = async (req, res) => {
  // Auth already enforced by `protect` middleware; belt-and-suspenders check
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: 'User not authenticated' })
  }

  const { conversationId } = req.body || {}

  if (!conversationId || typeof conversationId !== 'string' || !conversationId.trim()) {
    return res.status(400).json({ message: 'conversationId is required' })
  }

  const trimmedId = conversationId.trim()
  if (!UUID_REGEX.test(trimmedId)) {
    return res.status(400).json({ message: 'conversationId must be a valid UUID' })
  }

  try {
    // ── Step 1: Verify conversation exists ──────────────────────────────
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('id, type')
      .eq('id', trimmedId)
      .single()

    if (convError || !conversation) {
      return res.status(404).json({ message: 'Conversation not found' })
    }

    // ── Step 2: Verify caller is a member of the conversation ────────────
    const employeeId = req.user.id // always the server-verified employee UUID

    const { data: membership, error: memberError } = await supabaseAdmin
      .from('conversation_members')
      .select('employee_id')
      .eq('conversation_id', trimmedId)
      .eq('employee_id', employeeId)
      .maybeSingle()

    if (memberError) {
      console.error('[LiveKit] Membership check error:', memberError.message)
      return res.status(500).json({ message: 'Authorization check failed' })
    }

    if (!membership) {
      // Authenticated user exists but is not a member of this conversation
      return res.status(403).json({
        message: 'You are not a member of this conversation',
      })
    }

    // ── Step 3: Generate room name server-side ───────────────────────────
    // Room name is deterministic and derived entirely from the server-verified
    // conversation ID — the client never dictates the room name.
    const roomName = `lk_conv_${trimmedId}`

    // ── Step 4: Issue token ──────────────────────────────────────────────
    const result = await livekitService.createToken({
      roomName,
      identity: employeeId,       // Server-verified employee UUID
      name: req.user.name || '',  // Display name for UI
    })

    return res.json({
      token: result.token,
      serverUrl: result.serverUrl,
      roomName,  // Expose the server-computed room name (not secret)
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
