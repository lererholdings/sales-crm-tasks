import { NavLink } from 'react-router-dom'
import { UserButton } from '@clerk/clerk-react'
import { useTheme } from '../../hooks/useTheme.js'

// Admin is unconditionally visible for now — role-based show/hide is
// Milestone 8's job, once GET /api/users gives us the real role from
// Supabase (role is never stored in Clerk, see design.md section 3).
const links = [
  { to: '/tasks', label: 'Tasks', icon: 'ti-layout-list' },
  { to: '/accounts', label: 'Accounts', icon: 'ti-building' },
  { to: '/admin', label: 'Admin', icon: 'ti-settings' },
]

export default function Navbar() {
  const { theme, toggleTheme } = useTheme()

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
      <UserButton afterSignOutUrl="/" />
    </nav>
  )
}
