import { NavLink } from 'react-router-dom'
import { UserButton } from '@clerk/clerk-react'
import { useCurrentUser } from '../../hooks/useCurrentUser.js'
import { useTheme } from '../../hooks/useTheme.js'

const BASE_LINKS = [
  { to: '/tasks', label: 'Tasks', icon: 'ti-layout-list' },
  { to: '/accounts', label: 'Accounts', icon: 'ti-building' },
]
const ADMIN_LINK = { to: '/admin', label: 'Admin', icon: 'ti-settings' }

export default function Navbar() {
  const { theme, toggleTheme } = useTheme()
  const { user: currentUser } = useCurrentUser()
  const links = currentUser?.role === 'admin' ? [...BASE_LINKS, ADMIN_LINK] : BASE_LINKS

  return (
    <nav className="flex h-13 items-center gap-4 bg-navbar px-5 border-b border-navbar-border">
      <span className="text-[15px] font-medium text-white">Sales CRM — Tasks</span>
      <div className="flex flex-1 gap-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] no-underline ${
                isActive
                  ? 'bg-white/[0.13] text-white'
                  : 'text-accent-soft hover:bg-white/[0.08] hover:text-white'
              }`
            }
          >
            <i className={`ti ${link.icon}`} />
            {link.label}
          </NavLink>
        ))}
      </div>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[0.12] text-accent-soft hover:bg-white/[0.22]"
      >
        <i className={`ti ${theme === 'dark' ? 'ti-sun' : 'ti-moon'}`} />
      </button>
      {/* UserButton's own afterSignOutUrl wins over ClerkProvider's (main.jsx)
          for the sign-out it triggers — must stay base-path-aware too, or
          signing out lands at the domain root instead of e.g. /sales-tasks/
          (see docs/design.md's Multi Zones decision log entry). */}
      <UserButton afterSignOutUrl={import.meta.env.BASE_URL} />
    </nav>
  )
}
