import { NavLink } from 'react-router-dom'
import { UserButton, useUser } from '@clerk/clerk-react'

const links = [
  { to: '/tasks', label: 'Tasks' },
  { to: '/accounts', label: 'Accounts' },
]

export default function Navbar() {
  const { user } = useUser()
  const isAdmin = user?.publicMetadata?.role === 'admin'

  return (
    <nav className="flex h-13 items-center gap-4 bg-navbar px-5 border-b border-navbar-border">
      <span className="text-[15px] font-medium text-white">Sales CRM</span>
      <div className="flex flex-1 gap-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 text-[13px] no-underline ${
                isActive
                  ? 'bg-white/[0.13] text-white'
                  : 'text-accent-soft hover:bg-white/[0.08] hover:text-white'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 text-[13px] no-underline ${
                isActive
                  ? 'bg-white/[0.13] text-white'
                  : 'text-accent-soft hover:bg-white/[0.08] hover:text-white'
              }`
            }
          >
            Admin
          </NavLink>
        )}
      </div>
      <UserButton afterSignOutUrl="/" />
    </nav>
  )
}
