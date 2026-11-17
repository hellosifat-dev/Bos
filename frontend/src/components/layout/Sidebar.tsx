import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Settings, ChevronDown, ChevronRight, Building2, Shield, FileText, X, Menu,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuthStore } from '@/stores/authStore'

interface NavItem {
  label: string
  icon: React.ElementType
  href?: string
  children?: NavItem[]
  module?: string
}

// Phase 1 navigation. Items appear only when the user holds `<module>.view`.
const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/app/dashboard' },
  { label: 'Businesses', icon: Building2, href: '/app/businesses' },
  { label: 'Branches', icon: Building2, href: '/app/branches', module: 'branches' },
  { label: 'Users', icon: Users, href: '/app/users', module: 'users' },
  { label: 'Roles', icon: Shield, href: '/app/roles', module: 'roles' },
  { label: 'Audit Log', icon: FileText, href: '/app/audit-logs', module: 'audit_logs' },
  { label: 'Security', icon: Settings, href: '/app/settings/security' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

function NavItemComponent({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const location = useLocation()
  const [open, setOpen] = useState(() =>
    item.children?.some((c) => c.href && location.pathname.startsWith(c.href)) ?? false
  )

  if (item.href) {
    return (
      <NavLink
        to={item.href}
        className={({ isActive }) =>
          clsx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors group',
            isActive
              ? 'bg-primary-50 text-primary-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          )
        }
        title={collapsed ? item.label : undefined}
      >
        <item.icon className="h-4 w-4 flex-shrink-0" />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      </NavLink>
    )
  }

  if (item.children) {
    const isActive = item.children.some((c) => c.href && location.pathname.startsWith(c.href))
    return (
      <div>
        <button
          onClick={() => !collapsed && setOpen((o) => !o)}
          className={clsx(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          )}
          title={collapsed ? item.label : undefined}
        >
          <item.icon className="h-4 w-4 flex-shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 truncate text-left">{item.label}</span>
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </>
          )}
        </button>
        {!collapsed && open && (
          <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-gray-100 pl-3">
            {item.children.map((child) => (
              <NavItemComponent key={child.label} item={child} collapsed={false} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return null
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const permissions = useAuthStore((s) => s.permissions)
  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onMobileClose} />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-gray-200 transition-all duration-300',
          collapsed ? 'w-[68px]' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-3">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">BOS</p>
                <p className="text-xs text-gray-500">Business OS</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="mx-auto h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
          )}
          <div className="flex items-center">
            <button
              onClick={onToggle}
              className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <Menu className="h-4 w-4" />
            </button>
            <button
              onClick={onMobileClose}
              className="flex lg:hidden h-7 w-7 items-center justify-center rounded-md text-gray-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {navItems.filter((item) => !item.module || permissions.includes('*') || permissions.includes(`${item.module}.view`)).map((item) => (
            <NavItemComponent key={item.label} item={item} collapsed={collapsed} />
          ))}
        </nav>
      </aside>
    </>
  )
}
