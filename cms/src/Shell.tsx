import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Activity,
  BriefcaseBusiness,
  ClipboardCheck,
  FileClock,
  Gauge,
  LogOut,
  Menu,
  MessageSquareMore,
  ShieldCheck,
  Star,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { useAuth } from './auth'

const links = [
  { to: '/', label: 'Dashboard', icon: Gauge, roles: [] },
  { to: '/verifications', label: 'Verifications', icon: ShieldCheck, roles: [] },
  { to: '/users', label: 'Users', icon: Users, roles: ['superadmin', 'moderator'] },
  { to: '/jobs', label: 'Jobs', icon: BriefcaseBusiness, roles: ['superadmin', 'moderator'] },
  { to: '/matches', label: 'Matches', icon: Activity, roles: ['superadmin', 'moderator'] },
  { to: '/messages', label: 'Messages', icon: MessageSquareMore, roles: ['superadmin', 'moderator'] },
  { to: '/reviews', label: 'Reviews', icon: Star, roles: ['superadmin', 'moderator'] },
  { to: '/audit-logs', label: 'Audit logs', icon: FileClock, roles: ['superadmin', 'moderator'] },
  { to: '/maintenance', label: 'Maintenance', icon: Wrench, roles: ['superadmin'] },
] as const

export function AppShell() {
  const { admin, logout, can } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const visible = links.filter((link) => !link.roles.length || can(...link.roles))

  const signOut = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu /></button>
      {open && <button className="nav-scrim" onClick={() => setOpen(false)} aria-label="Close navigation" />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand"><span>K</span><div>Kerjo<small>Admin console</small></div></div>
        <button className="nav-close" onClick={() => setOpen(false)}><X /></button>
        <nav>
          {visible.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}>
              <Icon size={19} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-card">
          <div className="avatar">{admin?.email.slice(0, 1).toUpperCase()}</div>
          <div><strong>{admin?.email}</strong><small>{admin?.role}</small></div>
          <button className="icon-button" onClick={signOut} title="Sign out"><LogOut size={18} /></button>
        </div>
      </aside>
      <main className="main-content"><Outlet /></main>
      <nav className="mobile-nav">
        {visible.slice(0, 4).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}><Icon size={20} /><small>{label}</small></NavLink>
        ))}
        <button onClick={() => setOpen(true)}><Menu size={20} /><small>More</small></button>
      </nav>
    </div>
  )
}

export function AccessDenied() {
  return <div className="state"><ClipboardCheck size={32} /><h2>Access restricted</h2><p>Your role cannot access this area.</p></div>
}
