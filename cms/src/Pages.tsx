import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, EyeOff, RotateCcw, ShieldAlert, UserRoundX, X } from 'lucide-react'
import { api } from './api'
import { useAuth } from './auth'
import { Badge, ConfirmDialog, Filters, formatDate, PageHeader, Pagination, State } from './components'
import type { AuditLog, Job, MatchActivity, Review, User, Verification } from './types'

function tone(status: string | boolean) {
  if (status === 'approved' || status === 'active' || status === false) return 'success'
  if (status === 'rejected' || status === 'suspended' || status === true) return 'danger'
  return 'warning'
}

export function LoginPage() {
  const { admin, login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  if (admin) return <Navigate to="/" replace />

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setPending(true)
    setError('')
    try {
      await login(String(data.get('email')), String(data.get('password')))
      navigate('/')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand large"><span>K</span><div>Kerjo<small>Trust & safety console</small></div></div>
        <div>
          <p className="eyebrow">STAFF ACCESS</p>
          <h1>Welcome back</h1>
          <p>Sign in with your Kerjo administrator account.</p>
        </div>
        <form onSubmit={submit}>
          {error && <div className="form-error"><AlertTriangle size={18} />{error}</div>}
          <label>Email<input name="email" type="email" autoComplete="username" required /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required minLength={12} /></label>
          <button className="button" disabled={pending}>{pending ? 'Signing in…' : 'Sign in securely'}</button>
        </form>
        <small>Access is monitored and recorded in the audit log.</small>
      </section>
      <section className="login-art"><ShieldAlert size={72} /><h2>Protecting the Kerjo community.</h2><p>Review identity, moderate content, and keep the marketplace safe.</p></section>
    </main>
  )
}

export function DashboardPage() {
  const { admin } = useAuth()
  const query = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard })
  const cards = query.data ? [
    ['Pending verification', query.data.pendingVerifications, '/verifications'],
    ['Active users', query.data.activeUsers, '/users'],
    ['Open jobs', query.data.openJobs, '/jobs'],
    ['Matches today', query.data.matchesToday, '/matches'],
    ['Reported content', query.data.reportedContent, '/reviews'],
  ] : []
  return (
    <>
      <PageHeader title={`Good day, ${admin?.email.split('@')[0]}`} description="Here is the current platform health overview." />
      <State loading={query.isLoading} error={query.error}>
        <div className="stat-grid">
          {cards.map(([label, value, href]) => <Link className="stat-card" to={String(href)} key={String(label)}><span>{label}</span><strong>{value}</strong><small>View details →</small></Link>)}
        </div>
        <section className="card quick-actions"><h2>Priority work</h2><p>Start with pending identity checks and reported marketplace content.</p><div><Link className="button" to="/verifications">Review verifications</Link><Link className="button secondary" to="/reviews">Moderate reviews</Link></div></section>
      </State>
    </>
  )
}

function useListState() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  return { search, setSearch: (value: string) => { setSearch(value); setPage(1) }, status, setStatus: (value: string) => { setStatus(value); setPage(1) }, page, setPage }
}

function ListPage<T>({
  title,
  description,
  queryKey,
  queryFn,
  statuses,
  columns,
  row,
}: {
  title: string
  description: string
  queryKey: string
  queryFn: (query: Record<string, string | number>) => Promise<{ items: T[]; meta: { page: number; pageSize: number; total: number } }>
  statuses?: { value: string; label: string }[]
  columns: string[]
  row: (item: T) => ReactNode
}) {
  const list = useListState()
  const query = useQuery({ queryKey: [queryKey, list.search, list.status, list.page], queryFn: () => queryFn({ search: list.search, status: list.status, page: list.page, pageSize: 20 }) })
  return (
    <>
      <PageHeader title={title} description={description} />
      <section className="card table-card">
        <Filters search={list.search} onSearch={list.setSearch}>
          {statuses && <select aria-label="Filter status" value={list.status} onChange={(e) => list.setStatus(e.target.value)}><option value="">All statuses</option>{statuses.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select>}
        </Filters>
        <State loading={query.isLoading} error={query.error} empty={query.data?.items.length === 0}>
          <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{query.data?.items.map(row)}</tbody></table></div>
          {query.data && <Pagination {...query.data.meta} onPage={list.setPage} />}
        </State>
      </section>
    </>
  )
}

export function VerificationsPage() {
  return <ListPage<Verification> title="Verification queue" description="Review submitted identity documents and face photos." queryKey="verifications" queryFn={api.verifications.list} statuses={[{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]} columns={['Applicant', 'Masked KTP', 'Submitted', 'Status', '']} row={(item) => <tr key={item.id}><td><strong>{item.userName}</strong><small>{item.userId}</small></td><td>{item.ktpNumberMasked ?? '—'}</td><td>{formatDate(item.submittedAt)}</td><td><Badge tone={tone(item.status)}>{item.status}</Badge></td><td className="actions"><Link className="text-link" to={`/verifications/${item.id}`}>Review</Link></td></tr>} />
}

export function VerificationDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['verification', id], queryFn: () => api.verifications.get(id) })
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const mutation = useMutation({
    mutationFn: ({ kind, reason }: { kind: 'approve' | 'reject'; reason: string }) => api.verifications[kind](id, reason),
    onSuccess: () => { client.invalidateQueries({ queryKey: ['verifications'] }); query.refetch(); setAction(null) },
  })
  return (
    <>
      <button className="back-link" onClick={() => navigate(-1)}><ArrowLeft size={17} />Back to queue</button>
      <PageHeader title="Identity review" description={query.data ? `${query.data.userName} · submitted ${formatDate(query.data.submittedAt)}` : 'Reviewing applicant submission'} />
      <State loading={query.isLoading} error={query.error}>
        {query.data && <div className="detail-grid"><section className="card"><h2>Submitted images</h2><div className="image-review"><figure><img src={query.data.ktpImageUrl} alt="Submitted KTP identity document" /><figcaption>KTP document</figcaption></figure><figure><img src={query.data.faceImageUrl} alt="Submitted applicant face" /><figcaption>Face photo</figcaption></figure></div></section><aside className="card details"><h2>Review details</h2><dl><dt>Applicant</dt><dd>{query.data.userName}</dd><dt>User ID</dt><dd>{query.data.userId}</dd><dt>KTP number</dt><dd>{query.data.ktpNumberMasked ?? 'Masked'}</dd><dt>Status</dt><dd><Badge tone={tone(query.data.status)}>{query.data.status}</Badge></dd></dl>{query.data.status === 'pending' && <div className="stack-actions"><button className="button" onClick={() => setAction('approve')}><Check size={17} />Approve</button><button className="button danger" onClick={() => setAction('reject')}><X size={17} />Reject</button></div>}</aside></div>}
      </State>
      <ConfirmDialog open={Boolean(action)} title={`${action === 'approve' ? 'Approve' : 'Reject'} verification`} description="A reason is required and will be stored in the audit log." confirmLabel={action === 'approve' ? 'Approve identity' : 'Reject identity'} danger={action === 'reject'} pending={mutation.isPending} onClose={() => setAction(null)} onConfirm={(reason) => action && mutation.mutate({ kind: action, reason })} />
    </>
  )
}

export function UsersPage() {
  return <ListPage<User> title="Users" description="Search accounts and manage platform access." queryKey="users" queryFn={api.users.list} statuses={[{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }]} columns={['User', 'Status', 'Verification', 'Joined', 'Last active', '']} row={(item) => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.email}</small></td><td><Badge tone={tone(item.status)}>{item.status}</Badge></td><td>{item.verificationStatus}</td><td>{formatDate(item.createdAt)}</td><td>{formatDate(item.lastActiveAt)}</td><td className="actions"><Link className="text-link" to={`/users/${item.id}`}>Open</Link></td></tr>} />
}

export function UserDetailPage() {
  const { id = '' } = useParams()
  const client = useQueryClient()
  const user = useQuery({ queryKey: ['user', id], queryFn: () => api.users.get(id) })
  const history = useQuery({ queryKey: ['user-history', id], queryFn: () => api.users.history(id) })
  const [action, setAction] = useState<'suspend' | 'reactivate' | 'revokeSessions' | null>(null)
  const mutation = useMutation<User | void, Error, { kind: NonNullable<typeof action>; reason: string }>({
    mutationFn: ({ kind, reason }: { kind: NonNullable<typeof action>; reason: string }) => api.users[kind](id, reason),
    onSuccess: () => { client.invalidateQueries({ queryKey: ['user', id] }); client.invalidateQueries({ queryKey: ['user-history', id] }); setAction(null) },
  })
  return (
    <>
      <PageHeader title={user.data?.name ?? 'User profile'} description={user.data?.email} />
      <State loading={user.isLoading} error={user.error}>{user.data && <div className="detail-grid"><section className="card details"><h2>Account</h2><dl><dt>User ID</dt><dd>{user.data.id}</dd><dt>Phone</dt><dd>{user.data.phone ?? '—'}</dd><dt>Status</dt><dd><Badge tone={tone(user.data.status)}>{user.data.status}</Badge></dd><dt>Verification</dt><dd>{user.data.verificationStatus}</dd><dt>Joined</dt><dd>{formatDate(user.data.createdAt)}</dd></dl><div className="stack-actions">{user.data.status === 'active' ? <button className="button danger" onClick={() => setAction('suspend')}><UserRoundX size={17} />Suspend account</button> : <button className="button" onClick={() => setAction('reactivate')}><RotateCcw size={17} />Reactivate</button>}<button className="button secondary" onClick={() => setAction('revokeSessions')}>Revoke sessions</button></div></section><section className="card details"><h2>Activity summary</h2><State loading={history.isLoading} error={history.error}>{history.data && <dl><dt>Sessions</dt><dd>{history.data.sessionCount}</dd><dt>Swipes</dt><dd>{history.data.swipeCount}</dd><dt>Matches</dt><dd>{history.data.matchCount}</dd><dt>Reviews</dt><dd>{history.data.reviewCount}</dd><dt>History cleaned</dt><dd>{formatDate(history.data.historyCleanedAt)}</dd></dl>}</State></section></div>}</State>
      <ConfirmDialog open={Boolean(action)} title={action === 'revokeSessions' ? 'Revoke all sessions' : `${action === 'suspend' ? 'Suspend' : 'Reactivate'} account`} description="This security-sensitive action requires an audit reason." danger={action !== 'reactivate'} pending={mutation.isPending} onClose={() => setAction(null)} onConfirm={(reason) => action && mutation.mutate({ kind: action, reason })} />
    </>
  )
}

export function JobsPage() {
  return <ListPage<Job> title="Jobs" description="Moderate marketplace job listings." queryKey="jobs" queryFn={api.jobs.list} statuses={[{ value: 'visible', label: 'Visible' }, { value: 'hidden', label: 'Hidden' }]} columns={['Job', 'Employer', 'Status', 'Reports', 'Created', '']} row={(item) => <tr key={item.id}><td><strong>{item.title}</strong><small>{item.id}</small></td><td>{item.employerName}</td><td><Badge tone={tone(item.hidden)}>{item.hidden ? 'hidden' : item.status}</Badge></td><td>{item.reportsCount ?? 0}</td><td>{formatDate(item.createdAt)}</td><td className="actions"><Link className="text-link" to={`/jobs/${item.id}`}>Open</Link></td></tr>} />
}

export function JobDetailPage() {
  const { id = '' } = useParams()
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['job', id], queryFn: () => api.jobs.get(id) })
  const [action, setAction] = useState<'hide' | 'restore' | null>(null)
  const mutation = useMutation({ mutationFn: ({ kind, reason }: { kind: 'hide' | 'restore'; reason: string }) => api.jobs[kind](id, reason), onSuccess: () => { client.invalidateQueries({ queryKey: ['job', id] }); setAction(null) } })
  return <>
    <PageHeader title={query.data?.title ?? 'Job detail'} description="Listing moderation and report context." />
    <State loading={query.isLoading} error={query.error}>{query.data && <section className="card details wide"><dl><dt>Employer</dt><dd>{query.data.employerName}</dd><dt>Status</dt><dd><Badge tone={tone(query.data.hidden)}>{query.data.hidden ? 'hidden' : query.data.status}</Badge></dd><dt>Reports</dt><dd>{query.data.reportsCount ?? 0}</dd><dt>Created</dt><dd>{formatDate(query.data.createdAt)}</dd><dt>Description</dt><dd className="preserve">{query.data.description ?? 'No description available.'}</dd></dl><button className={`button ${query.data.hidden ? '' : 'danger'}`} onClick={() => setAction(query.data!.hidden ? 'restore' : 'hide')}>{query.data.hidden ? <RotateCcw size={17} /> : <EyeOff size={17} />}{query.data.hidden ? 'Restore listing' : 'Hide listing'}</button></section>}</State>
    <ConfirmDialog open={Boolean(action)} title={`${action === 'hide' ? 'Hide' : 'Restore'} job`} description="Provide the moderation reason. This will appear in the audit log." danger={action === 'hide'} pending={mutation.isPending} onClose={() => setAction(null)} onConfirm={(reason) => action && mutation.mutate({ kind: action, reason })} />
  </>
}

export function MatchesPage({ messages = false }: { messages?: boolean }) {
  return <ListPage<MatchActivity> title={messages ? 'Message activity' : 'Matches'} description={messages ? 'Privacy-safe messaging metadata. Message text is never exposed.' : 'Inspect match lifecycle and activity metadata.'} queryKey="matches" queryFn={api.matches.list} statuses={[{ value: 'active', label: 'Active' }, { value: 'closed', label: 'Closed' }]} columns={['Match', 'Job', 'Participants', 'Status', 'Messages', 'Last message']} row={(item) => <tr key={item.id}><td><strong>{item.id}</strong><small>{formatDate(item.createdAt)}</small></td><td><strong>{item.jobTitle || item.jobId || '—'}</strong><small>{item.jobId}</small></td><td><small>Employer: {item.employerName || item.employerId}</small><small>Worker: {item.workerName || item.workerId}</small></td><td><Badge tone={tone(item.status)}>{item.status}</Badge></td><td>{item.messageCount}</td><td>{formatDate(item.lastMessageAt)}</td></tr>} />
}

export function ReviewsPage() {
  const state = useListState()
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['reviews', state.search, state.status, state.page], queryFn: () => api.reviews.list({ search: state.search, status: state.status, page: state.page, pageSize: 20 }) })
  const [selected, setSelected] = useState<Review | null>(null)
  const mutation = useMutation({ mutationFn: ({ item, reason }: { item: Review; reason: string }) => item.hidden ? api.reviews.restore(item.id, reason) : api.reviews.hide(item.id, reason), onSuccess: () => { client.invalidateQueries({ queryKey: ['reviews'] }); setSelected(null) } })
  return <>
    <PageHeader title="Reviews" description="Moderate ratings and reviews while preserving user safety." />
    <section className="card table-card"><Filters search={state.search} onSearch={state.setSearch}><select value={state.status} onChange={(e) => state.setStatus(e.target.value)}><option value="">All visibility</option><option value="visible">Visible</option><option value="hidden">Hidden</option></select></Filters><State loading={query.isLoading} error={query.error} empty={query.data?.items.length === 0}><div className="table-scroll"><table><thead><tr><th>Parties</th><th>Rating</th><th>Reports</th><th>Created</th><th>Status</th><th /></tr></thead><tbody>{query.data?.items.map((item) => <tr key={item.id}><td><strong>{item.authorName}</strong><small>about {item.subjectName}</small></td><td>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</td><td>{item.reportsCount ?? 0}</td><td>{formatDate(item.createdAt)}</td><td><Badge tone={tone(item.hidden)}>{item.hidden ? 'hidden' : 'visible'}</Badge></td><td><button className="text-button" onClick={() => setSelected(item)}>{item.hidden ? 'Restore' : 'Hide'}</button></td></tr>)}</tbody></table></div>{query.data && <Pagination {...query.data.meta} onPage={state.setPage} />}</State></section>
    <ConfirmDialog open={Boolean(selected)} title={`${selected?.hidden ? 'Restore' : 'Hide'} review`} description="Review text is intentionally not displayed. Moderate using metadata, rating, and report count." danger={!selected?.hidden} pending={mutation.isPending} onClose={() => setSelected(null)} onConfirm={(reason) => selected && mutation.mutate({ item: selected, reason })} />
  </>
}

export function AuditPage() {
  return <ListPage<AuditLog> title="Audit logs" description="Immutable history of administrator actions." queryKey="audit" queryFn={api.audit} columns={['Actor', 'Action', 'Resource', 'Reason', 'Time', 'IP']} row={(item) => <tr key={item.id}><td><strong>{item.actorName}</strong><small>{item.actorRole}</small></td><td>{item.action}</td><td><strong>{item.resourceType}</strong><small>{item.resourceId}</small></td><td>{item.reason ?? '—'}</td><td>{formatDate(item.createdAt)}</td><td>{item.ipAddress ?? '—'}</td></tr>} />
}

export function MaintenancePage() {
  const [scope, setScope] = useState<'global' | 'user'>('user')
  const [userId, setUserId] = useState('')
  const [execute, setExecute] = useState(false)
  const targetUserId = scope === 'user' ? userId.trim() : ''
  const preview = useMutation({ mutationFn: () => api.maintenance.preview(targetUserId) })
  const run = useMutation({
    mutationFn: ({ reason, confirmation }: { reason: string; confirmation: string }) =>
      api.maintenance.execute(targetUserId, reason, confirmation),
    onSuccess: () => {
      setExecute(false)
      preview.reset()
    },
  })
  const counts = preview.data
    ? [
        ['Swipes', preview.data.swipes],
        ['Matches', preview.data.matches],
        ['Messages', preview.data.messages],
        ['Schedules', preview.data.schedules],
        ['Reviews', preview.data.reviews],
        ['Sessions', preview.data.sessions],
      ]
    : []
  return <>
    <PageHeader title="History cleanup" description="Preview and remove activity history without direct database access." />
    <div className="detail-grid">
      <section className="card">
        <h2>Cleanup scope</h2>
        <label>Scope
          <select value={scope} onChange={(event) => { setScope(event.target.value as 'global' | 'user'); preview.reset() }}>
            <option value="user">One user</option>
            <option value="global">All users</option>
          </select>
        </label>
        {scope === 'user' && <label>User ID<input value={userId} onChange={(event) => { setUserId(event.target.value); preview.reset() }} placeholder="user_..." /></label>}
        <button className="button secondary" onClick={() => preview.mutate()} disabled={preview.isPending || (scope === 'user' && !targetUserId)}>
          {preview.isPending ? 'Previewing…' : 'Generate preview'}
        </button>
      </section>
      <section className="card">
        <h2>Impact preview</h2>
        {!preview.data && !preview.error && <div className="state">Generate a preview before execution.</div>}
        <State error={preview.error}>
          {preview.data && <div className="maintenance-preview">
            <strong>{preview.data.scope === 'global' ? 'All activity history' : `History for ${preview.data.userId}`}</strong>
            {counts.map(([label, value]) => <p key={String(label)}><span>{label}</span>: {value}</p>)}
            <p><AlertTriangle size={16} />This deletion cannot be undone.</p>
            <button className="button danger" onClick={() => setExecute(true)}>Delete history</button>
          </div>}
        </State>
      </section>
    </div>
    <ConfirmDialog open={execute} title="Delete activity history" description="This permanently removes the records in the preview. A reason and exact confirmation are required." requireText={preview.data?.confirmation} confirmLabel="Delete history" danger pending={run.isPending} onClose={() => setExecute(false)} onConfirm={(reason, confirmation) => run.mutate({ reason, confirmation })} />
  </>
}
