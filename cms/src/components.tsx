import { useEffect, useState } from 'react'
import type { FormEvent, PropsWithChildren, ReactNode } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  )
}

export function State({
  loading,
  error,
  empty,
  children,
}: PropsWithChildren<{ loading?: boolean; error?: Error | null; empty?: boolean }>) {
  if (loading) return <div className="state"><span className="spinner" />Loading…</div>
  if (error) return <div className="state error"><AlertTriangle />{error.message}</div>
  if (empty) return <div className="state">No records found.</div>
  return children
}

export function Badge({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: string }>) {
  return <span className={`badge ${tone}`}>{children}</span>
}

export function Filters({
  search,
  onSearch,
  children,
}: PropsWithChildren<{ search: string; onSearch: (value: string) => void }>) {
  return (
    <div className="filters">
      <label className="search">
        <Search size={17} />
        <input
          aria-label="Search"
          placeholder="Search…"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>
      {children}
    </div>
  )
}

export function Pagination({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number
  total: number
  pageSize: number
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="pagination">
      <span>{total} results · Page {page} of {pages}</span>
      <div>
        <button className="icon-button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={18} /><span className="sr-only">Previous</span>
        </button>
        <button className="icon-button" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <ChevronRight size={18} /><span className="sr-only">Next</span>
        </button>
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  danger = false,
  requireText,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  requireText?: string
  pending?: boolean
  onClose: () => void
  onConfirm: (reason: string, confirmation: string) => void
}) {
  const [reason, setReason] = useState('')
  const [confirmation, setConfirmation] = useState('')
  useEffect(() => {
    if (!open) {
      // Reset draft input whenever the parent closes the reusable dialog.
      // oxlint-disable-next-line react/set-state-in-effect
      setReason('')
      setConfirmation('')
    }
  }, [open])
  if (!open) return null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onConfirm(reason.trim(), confirmation)
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="dialog" role="dialog" aria-modal="true" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
        <button type="button" className="dialog-close" onClick={onClose}><X size={20} /></button>
        <h2>{title}</h2>
        <p>{description}</p>
        <label>
          Reason <span className="required">*</span>
          <textarea autoFocus required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        {requireText && (
          <label>
            Type <strong>{requireText}</strong> to continue
            <input required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          </label>
        )}
        <div className="dialog-actions">
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button
            className={`button ${danger ? 'danger' : ''}`}
            disabled={pending || reason.trim().length < 3 || Boolean(requireText && confirmation !== requireText)}
          >
            {pending ? 'Working…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  )
}

// This small formatter lives with the display components that consume it.
// oxlint-disable-next-line react/only-export-components
export const formatDate = (value?: string) =>
  value ? new Intl.DateTimeFormat('en-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
