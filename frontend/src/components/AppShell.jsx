import { useState } from 'react'
import { BarChart3, CalendarDays, ChevronDown, LayoutDashboard, LogOut, Menu, ShieldCheck, Users } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/staff', label: 'Staff', icon: Users },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
]

export function AppShell() {
  const { user, logout } = useAuth()
  const profile = user?.staff_profile
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const accountName = profile?.full_name || user?.first_name || user?.username || 'User'
  const visibleNavItems = user?.is_superuser
    ? [...navItems, { to: '/superadmin', label: 'Superadmin', icon: ShieldCheck }]
    : navItems

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
            <div className="topbar-title">Welcome, {accountName}</div>
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
    </div>
  )
}
