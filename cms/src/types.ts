export type Role = 'superadmin' | 'moderator' | 'reviewer'

export interface Admin {
  id: number
  email: string
  role: Role
}

export interface PageMeta {
  page: number
  pageSize: number
  total: number
}

export interface Paginated<T> {
  items: T[]
  meta: PageMeta
}

export interface Verification {
  id: string
  userId: string
  userName: string
  status: 'pending' | 'approved' | 'rejected'
  submittedAt: string
  ktpImageUrl: string
  faceImageUrl: string
  ktpNumberMasked?: string
}

export interface User {
  id: string
  name: string
  email: string
  phone?: string
  status: 'active' | 'suspended'
  verificationStatus: string
  createdAt: string
  lastActiveAt?: string
}

export interface UserHistory {
  userId: string
  sessionCount: number
  swipeCount: number
  matchCount: number
  reviewCount: number
  historyCleanedAt?: string
}

export interface Job {
  id: string
  title: string
  employerName: string
  status: string
  hidden: boolean
  createdAt: string
  reportsCount?: number
  description?: string
}

export interface MatchActivity {
  id: string
  jobId: string
  jobTitle?: string
  employerId: string
  employerName?: string
  workerId: string
  workerName?: string
  status: string
  messageCount: number
  lastMessageAt?: string
  createdAt: string
}

export interface Review {
  id: string
  authorName: string
  subjectName: string
  rating: number
  hidden: boolean
  createdAt: string
  reportsCount?: number
}

export interface AuditLog {
  id: string
  actorName: string
  actorRole: Role
  action: string
  resourceType: string
  resourceId: string
  reason?: string
  createdAt: string
  ipAddress?: string
}

export interface DashboardStats {
  pendingVerifications: number
  activeUsers: number
  openJobs: number
  matchesToday: number
  reportedContent: number
}

export interface CleanupPreview {
  scope: 'user' | 'global'
  userId?: string
  swipes: number
  matches: number
  messages: number
  schedules: number
  reviews: number
  sessions: number
  confirmation: string
}
