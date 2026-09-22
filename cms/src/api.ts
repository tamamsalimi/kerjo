import type {
  Admin,
  AuditLog,
  CleanupPreview,
  DashboardStats,
  Job,
  MatchActivity,
  Paginated,
  Review,
  User,
  UserHistory,
  Verification,
} from './types'

type Query = Record<string, string | number | boolean | undefined>

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(
    message: string,
    status: number,
    details?: unknown,
  ) {
    super(message)
    this.status = status
    this.details = details
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  const body = response.status === 204 ? undefined : await response.json().catch(() => undefined)
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'message' in body
        ? String(body.message)
        : body && typeof body === 'object' && 'error' in body
          ? String(body.error)
        : `Request failed (${response.status})`
    throw new ApiError(message, response.status, body)
  }
  return body as T
}

function withQuery(path: string, query: Query = {}) {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  const suffix = params.toString()
  return suffix ? `${path}?${suffix}` : path
}

const reasonBody = (reason: string) => JSON.stringify({ reason })
type Row = Record<string, unknown>
type RawPage = { items: Row[]; page: { limit: number; offset: number; total: number } }

const text = (row: Row, key: string) => String(row[key] ?? '')
const optionalText = (row: Row, key: string) => row[key] == null ? undefined : String(row[key])
const number = (row: Row, key: string) => Number(row[key] ?? 0)
const hidden = (row: Row) => row.hidden_at != null

function listQuery(query: Query = {}) {
  const page = Math.max(1, Number(query.page ?? 1))
  const pageSize = Math.max(1, Math.min(100, Number(query.pageSize ?? 20)))
  return {
    q: query.search,
    status: query.status,
    category: query.category,
    kind: query.kind,
    direction: query.direction,
    targetType: query.targetType,
    action: query.action,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  }
}

async function list<T>(path: string, query: Query | undefined, map: (row: Row) => T): Promise<Paginated<T>> {
  const raw = await request<RawPage>(withQuery(path, listQuery(query)))
  const limit = raw.page.limit || 20
  return {
    items: raw.items.map(map),
    meta: {
      page: Math.floor(raw.page.offset / limit) + 1,
      pageSize: limit,
      total: raw.page.total,
    },
  }
}

const mapVerification = (row: Row): Verification => {
  const userId = text(row, 'user_id')
  const nik = optionalText(row, 'nik')
  return {
    id: userId,
    userId,
    userName: text(row, 'name') || text(row, 'email'),
    status: text(row, 'status') as Verification['status'],
    submittedAt: text(row, 'submitted_at'),
    ktpImageUrl: `/api/verifications/${encodeURIComponent(userId)}/documents/ktp`,
    faceImageUrl: `/api/verifications/${encodeURIComponent(userId)}/documents/face`,
    ktpNumberMasked: nik ? `•••• •••• •••• ${nik.slice(-4)}` : undefined,
  }
}

const mapUser = (row: Row): User => ({
  id: text(row, 'user_id'),
  name: text(row, 'name') || text(row, 'email'),
  email: text(row, 'email'),
  phone: optionalText(row, 'phone'),
  status: row.suspended_at == null ? 'active' : 'suspended',
  verificationStatus: text(row, 'verification_status') || 'unverified',
  createdAt: text(row, 'created_at'),
  lastActiveAt: optionalText(row, 'last_seen'),
})

const mapJob = (row: Row): Job => ({
  id: text(row, 'id'),
  title: text(row, 'title'),
  employerName: text(row, 'business') || text(row, 'owner_user_id'),
  status: row.deleted_at == null ? 'active' : 'deleted',
  hidden: hidden(row),
  createdAt: text(row, 'created_at'),
  description: optionalText(row, 'description'),
})

const mapMatch = (row: Row): MatchActivity => ({
  id: text(row, 'id'),
  jobId: text(row, 'job_id'),
  jobTitle: optionalText(row, 'job_title'),
  employerId: text(row, 'employer_user_id'),
  employerName: optionalText(row, 'employer_name'),
  workerId: text(row, 'worker_user_id'),
  workerName: optionalText(row, 'worker_name'),
  status: row.job_done ? 'closed' : 'active',
  messageCount: number(row, 'message_count'),
  lastMessageAt: optionalText(row, 'last_message_at'),
  createdAt: text(row, 'created_at'),
})

const mapReview = (row: Row): Review => ({
  id: text(row, 'id'),
  authorName: text(row, 'author') || text(row, 'reviewer_user_id'),
  subjectName: text(row, 'worker_id'),
  rating: number(row, 'rating'),
  hidden: hidden(row),
  createdAt: text(row, 'created_at'),
})

const mapAudit = (row: Row): AuditLog => {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Row : {}
  return {
    id: text(row, 'id'),
    actorName: text(row, 'admin_email') || 'System',
    actorRole: (text(row, 'admin_role') || 'superadmin') as AuditLog['actorRole'],
    action: text(row, 'action'),
    resourceType: text(row, 'target_type'),
    resourceId: text(row, 'target_id'),
    reason: optionalText(metadata, 'reason'),
    createdAt: text(row, 'created_at'),
    ipAddress: optionalText(row, 'ip_address'),
  }
}

export const api = {
  auth: {
    me: () => request<Admin>('/auth/me'),
    login: (email: string, password: string) =>
      request<Admin>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
  },
  dashboard: () => request<DashboardStats>('/dashboard'),
  verifications: {
    list: (query?: Query) => list('/verifications', query, mapVerification),
    get: async (id: string) => mapVerification(await request<Row>(`/verifications/${id}`)),
    approve: (id: string, reason: string) =>
      request<void>(`/verifications/${id}/approve`, {
        method: 'POST',
        body: reasonBody(reason),
      }),
    reject: (id: string, reason: string) =>
      request<void>(`/verifications/${id}/reject`, {
        method: 'POST',
        body: reasonBody(reason),
      }),
  },
  users: {
    list: (query?: Query) => list('/users', query, mapUser),
    get: async (id: string) => mapUser(await request<Row>(`/users/${id}`)),
    history: async (id: string): Promise<UserHistory> => {
      const row = await request<Row>(`/users/${id}/history`)
      return {
        userId: text(row, 'user_id'),
        sessionCount: number(row, 'session_count'),
        swipeCount: number(row, 'swipe_count'),
        matchCount: number(row, 'match_count'),
        reviewCount: number(row, 'review_count'),
        historyCleanedAt: optionalText(row, 'history_cleaned_at'),
      }
    },
    suspend: (id: string, reason: string) =>
      request<void>(`/users/${id}/suspend`, { method: 'POST', body: reasonBody(reason) }),
    reactivate: (id: string, reason: string) =>
      request<void>(`/users/${id}/reactivate`, { method: 'POST', body: reasonBody(reason) }),
    revokeSessions: (id: string, reason: string) =>
      request<void>(`/users/${id}/revoke-sessions`, {
        method: 'POST',
        body: reasonBody(reason),
      }),
  },
  jobs: {
    list: (query?: Query) => list('/jobs', query, mapJob),
    get: async (id: string) => mapJob(await request<Row>(`/jobs/${id}`)),
    hide: (id: string, reason: string) =>
      request<void>(`/jobs/${id}/hide`, { method: 'POST', body: reasonBody(reason) }),
    restore: (id: string, reason: string) =>
      request<void>(`/jobs/${id}/restore`, { method: 'POST', body: reasonBody(reason) }),
  },
  matches: {
    list: (query?: Query) => list('/matches', query, mapMatch),
    get: async (id: string) => mapMatch(await request<Row>(`/matches/${id}`)),
  },
  reviews: {
    list: (query?: Query) => list('/reviews', query, mapReview),
    hide: (id: string, reason: string) =>
      request<void>(`/reviews/${id}/hide`, { method: 'POST', body: reasonBody(reason) }),
    restore: (id: string, reason: string) =>
      request<void>(`/reviews/${id}/restore`, {
        method: 'POST',
        body: reasonBody(reason),
      }),
  },
  audit: (query?: Query) => list('/audit-logs', query, mapAudit),
  maintenance: {
    preview: (userId: string) =>
      request<CleanupPreview>('/maintenance/history/preview', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }),
    execute: (userId: string, reason: string, confirmation: string) =>
      request<void>('/maintenance/history/execute', {
        method: 'POST',
        body: JSON.stringify({ userId, reason, confirmation }),
      }),
  },
}
