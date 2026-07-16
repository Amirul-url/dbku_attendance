import { useState } from 'react'
import { BarChart3, CalendarDays, ChevronDown, ClipboardList, Clock3, LayoutDashboard, LogOut, Menu, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

const baseNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
]

export function AppShell() {
  const { user, logout, showSessionWarning, extendSession, extendingSession } = useAuth()
  const profile = user?.staff_profile
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const accountName = profile?.full_name || user?.first_name || user?.username || 'User'
  const today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
  const isSuperadmin = user?.is_superuser || profile?.role === 'superadmin'
  const canViewStaff = isSuperadmin || profile?.role === 'admin'
  const visibleNavItems = [
    baseNavItems[0],
    ...(profile ? [{ to: '/my-task', label: 'My Task', icon: ClipboardList }] : []),
    ...(canViewStaff ? [{ to: '/staff', label: 'Staff', icon: Users }] : []),
    ...baseNavItems.slice(1),
    ...(isSuperadmin ? [{ to: '/superadmin', label: 'Superadmin', icon: ShieldCheck }] : []),
  ]

  return (
    <div className={`app-shell ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div>
          <div className="brand">
            <img src="/logo.png" alt="DBKU Logo" className="brand-logo" />
            <div className="brand-label">
              <div className="brand-title">DBKU Attendance</div>
              <div className="brand-title">Management System</div>
            </div>
          </div>

          <div className="nav-section">Main</div>

          <nav className="nav-list">
            {visibleNavItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink key={item.to} to={item.to} className="nav-link">
                  <Icon size={16} />
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              )
            })}
          </nav>
        </div>

        <button type="button" className="logout-button" onClick={logout}>
          <LogOut size={15} />
          <span className="logout-label">Logout</span>
        </button>
      </aside>

      <main className="main-panel">
        <div className="ocean-bar" />
        <header className="topbar">
          <div className="topbar-start">
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Menu size={22} />
            </button>
            <div>
              <div className="topbar-title">DBKU Attendance Management System</div>
              <div className="topbar-date">{today}</div>
            </div>
          </div>
          <div className="account-menu">
            <button type="button" className="user-pill" onClick={() => setIsAccountMenuOpen((open) => !open)}>
              <span className="avatar">{accountName.slice(0, 2).toUpperCase()}</span>
              <span>{accountName}</span>
              <ChevronDown size={14} />
            </button>
            {isAccountMenuOpen && (
              <div className="account-dropdown">
                <button type="button" onClick={logout}>
                  <LogOut size={15} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>
        <section className="content">
          <Outlet />
        </section>
      </main>
      {showSessionWarning && (
        <div className="session-modal-backdrop">
          <div className="session-modal" role="alertdialog" aria-modal="true" aria-labelledby="session-warning-title">
            <div className="session-modal-header">
              <div className="session-icon">
                <Clock3 size={28} />
              </div>
              <div>
                <h2 id="session-warning-title">Session expiring soon</h2>
                <p>Your login session is about to expire. Extend it to continue working without signing in again.</p>
              </div>
            </div>
            <div className="session-modal-note">
              Choose Extend session to keep using AMS, or Logout to end this session now.
            </div>
            <div className="session-modal-actions">
              <button type="button" className="session-secondary-button" onClick={logout}>
                Logout
              </button>
              <button type="button" className="session-primary-button" onClick={extendSession} disabled={extendingSession}>
                <RefreshCw size={22} />
                {extendingSession ? 'Extending...' : 'Extend session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
