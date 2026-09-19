const { supabaseAdmin } = require('../config/supabase')

/**
 * protect — verifies the bearer token against Supabase Auth (never trusts
 * anything supplied by the client), then loads the authoritative employee
 * record (role, office, etc.) from our own database. req.user is always
 * built server-side; a role sent in the request body is never honoured.
 */
const protect = async (req, res, next) => {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' })
  }
  const token = auth.split(' ')[1]

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !authData?.user) {
      return res.status(401).json({ message: 'Invalid or expired token' })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, employee_id, employees(*, offices(id, name))')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !profile || !profile.employees) {
      return res.status(401).json({ message: 'No employee record linked to this account' })
    }

    if (profile.employees.status === 'inactive') {
      return res.status(403).json({ message: 'Account is inactive' })
    }

    req.authUserId = authData.user.id
    req.user = {
      id: profile.employees.id,
      employeeCode: profile.employees.employee_code,
      name: profile.employees.name,
      email: profile.employees.email,
      role: profile.employees.role,
      office: profile.employees.offices ? profile.employees.offices.name : null,
      officeId: profile.employees.office_id,
      status: profile.employees.status,
    }
    next()
  } catch (err) {
    console.error('Auth middleware error:', err.message)
    res.status(401).json({ message: 'Invalid or expired token' })
  }
}

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Insufficient permissions' })
  }
  next()
}

module.exports = { protect, requireRole }
