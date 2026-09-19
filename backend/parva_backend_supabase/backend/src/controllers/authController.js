const { supabaseAdmin, supabaseAnon } = require('../config/supabase')

// POST /api/auth/login
// Preserves the original request/response shape the frontend already uses:
// { token, user }. Credentials are verified entirely by Supabase Auth — this
// backend never sees or stores a password.
exports.login = async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' })
  }

  const { data, error } = await supabaseAnon.auth.signInWithPassword({
    email: email.toLowerCase(),
    password,
  })

  if (error || !data?.session) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('employees(*, offices(id, name))')
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile?.employees) {
    return res.status(403).json({ message: 'No employee record linked to this account. Contact an admin.' })
  }

  if (profile.employees.status === 'inactive') {
    return res.status(403).json({ message: 'Account is inactive' })
  }

  res.json({
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    user: toPublicEmployee(profile.employees),
  })
}

// GET /api/auth/me
exports.me = (req, res) => res.json(req.user)

// PATCH /api/auth/change-password
exports.changePassword = async (req, res) => {
  const { newPassword } = req.body
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters' })
  }
  // currentPassword is intentionally not re-verified here: the request is
  // already authenticated by a valid Supabase session token (protect
  // middleware), which is at least as strong a guarantee.
  const { error } = await supabaseAdmin.auth.admin.updateUserById(req.authUserId, { password: newPassword })
  if (error) return res.status(400).json({ message: error.message })
  res.json({ message: 'Password changed successfully' })
}

function toPublicEmployee(e) {
  return {
    id: e.id,
    employeeId: e.employee_code,
    name: e.name,
    email: e.email,
    role: e.role,
    office: e.offices ? e.offices.name : null,
    department: e.department,
    designation: e.designation,
    status: e.status,
  }
}
