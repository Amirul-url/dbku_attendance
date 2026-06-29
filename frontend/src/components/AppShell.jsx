import { BarChart3, CalendarDays, ChevronDown, LayoutDashboard, LogOut, ShieldCheck, Users, UsersRound } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/staff', label: 'Staff', icon: Users },
  { to: '/visitors', label: 'Visitor', icon: UsersRound },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
]

export function AppShell() {
  const { user, logout } = useAuth()
  const profile = user?.staff_profile
  const visibleNavItems = user?.is_superuser
    ? [...navItems, { to: '/superadmin', label: 'Superadmin', icon: ShieldCheck }]
    : navItems

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">
            <img src="/logo.png" alt="DBKU Logo" className="brand-logo" />
            <div>
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
                  {item.label}
                </NavLink>
              )
            })}
          </nav>
        </div>

        <button type="button" className="logout-button" onClick={logout}>
          <LogOut size={15} />
          Logout
        </button>
      </aside>

      <main className="main-panel">
        <div className="ocean-bar" />
        <header className="topbar">
          <div>
            <div className="topbar-title">DBKU Attendance Management System</div>
          </div>
          <div className="user-pill">
            <span className="avatar">{(profile?.full_name || user?.username || 'U').slice(0, 2).toUpperCase()}</span>
            <span>{profile?.full_name || user?.username}</span>
            <ChevronDown size={14} />
          </div>
        </header>
        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  )
}
