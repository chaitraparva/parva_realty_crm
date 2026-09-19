/**
 * API service layer — every call to the protected backend goes through here.
 *
 * Auth: the bearer token is always read fresh from the current Supabase
 * session (never a hand-rolled/localStorage token). If the access token is
 * close to expiring, supabase-js's autoRefreshToken will already have
 * refreshed it in the background; getSession() returns the current one.
 *
 * Base URL: set via VITE_API_URL. Two valid setups:
 *  - Two separate deployments (frontend + backend as different Vercel
 *    projects/domains) → VITE_API_URL MUST be set to the backend's URL.
 *  - One unified deployment (root vercel.json serving both from the same
 *    domain, see DEPLOYMENT.md) → VITE_API_URL can be left empty; requests
 *    go to same-origin relative paths ("/api/...") which the platform
 *    routes to the API. Never silently used as a fallback to mock data.
 */
import { supabase } from '../lib/supabase'

const BASE = import.meta.env.VITE_API_URL || ''

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) return {}
  return { Authorization: `Bearer ${data.session.access_token}` }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  Object.assign(headers, await getAuthHeader())

  let res: Response
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    // Network failure — backend unreachable/misconfigured VITE_API_URL/CORS.
    // Never silently fall back to mock data; surface a clear error instead.
    throw new ApiError('Could not reach the backend server. Please try again shortly.', 0)
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new ApiError(data.message || `API error ${res.status}`, res.status)
  }
  return data as T
}

// ── AUTH ──────────────────────────────────────────────────────────
// Login/password-reset/invite themselves go straight through the Supabase
// client (see screens/Login.tsx) since that's the source of truth for
// credentials. These two endpoints are for the authoritative, server-side
// employee/role record once a Supabase session already exists.
export const authApi = {
  // Verifies credentials against Supabase Auth server-side and returns the
  // authoritative employee/role record in one round trip. The frontend then
  // hands the returned access/refresh tokens to supabase-js (setSession) so
  // the session persists and auto-refreshes like any other Supabase session.
  login: (email: string, password: string) =>
    request<{ token: string; refreshToken: string; user: Record<string, unknown> }>(
      'POST',
      '/auth/login',
      { email, password }
    ),

  me: () => request<Record<string, unknown>>('GET', '/auth/me'),

  changePassword: (newPassword: string) =>
    request('PATCH', '/auth/change-password', { newPassword }),
}

// ── USERS / EMPLOYEES ────────────────────────────────────────────
export const usersApi = {
  getAll: () => request<unknown[]>('GET', '/users'),

  getById: (id: string) => request<unknown>('GET', `/users/${id}`),

  create: (data: unknown) => request<unknown>('POST', '/users', data),

  update: (id: string, data: unknown) => request<unknown>('PATCH', `/users/${id}`, data),

  deactivate: (id: string) => request<unknown>('DELETE', `/users/${id}`),
}

// ── LEADS ─────────────────────────────────────────────────────────
export const leadsApi = {
  getAll: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<unknown[]>('GET', `/leads${qs}`)
  },

  getById: (id: string) => request<unknown>('GET', `/leads/${id}`),

  create: (data: unknown) => request<unknown>('POST', '/leads', data),

  update: (id: string, data: unknown) => request<unknown>('PATCH', `/leads/${id}`, data),

  addActivity: (id: string, activity: { type: string; description: string }) =>
    request<unknown>('POST', `/leads/${id}/activity`, activity),

  assign: (id: string, assignedTo: string) =>
    request<unknown>('PATCH', `/leads/${id}/assign`, { assignedTo }),

  delete: (id: string) => request<unknown>('DELETE', `/leads/${id}`),
}

// ── APPROVALS ─────────────────────────────────────────────────────
export const approvalsApi = {
  getAll: () => request<unknown[]>('GET', '/approvals'),

  submit: (leadId: string, comments?: string) =>
    request<unknown>('POST', '/approvals', { leadId, comments }),

  decide: (id: string, action: 'approve' | 'reject' | 'escalate', comments?: string) =>
    request<unknown>('PATCH', `/approvals/${id}/decision`, { action, comments }),
}
