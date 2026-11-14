import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingBag, Package, Warehouse, Truck, Users, ClipboardList,
  UserCheck, DollarSign, BarChart2, Globe, Megaphone, Settings, ChevronDown,
  ChevronRight, Building2, Shield, FileText, CreditCard, Tags, Layers, X, Menu,
} from 'lucide-react'
import { clsx } from 'clsx'

interface NavItem {
  label: string
  icon: React.ElementType
  href?: string
  children?: NavItem[]
  module?: string
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/app/dashboard' },
  {
    label: 'Sales', icon: ShoppingBag, children: [
      { label: 'Orders', icon: ClipboardList, href: '/app/orders', module: 'orders' },
      { label: 'Invoices', icon: FileText, href: '/app/invoices', module: 'sales' },
      { label: 'Quotations', icon: FileText, href: '/app/quotations', module: 'sales' },
      { label: 'POS', icon: CreditCard, href: '/app/pos', module: 'pos' },
      { label: 'Returns', icon: Package, href: '/app/returns', module: 'returns' },
    ],
  },
  {
    label: 'Products', icon: Tags, children: [
      { label: 'Product List', icon: Package, href: '/app/products', module: 'products' },
      { label: 'Categories', icon: Layers, href: '/app/categories', module: 'categories' },
      { label: 'Brands', icon: ShoppingBag, href: '/app/brands', module: 'brands' },
    ],
  },
  {
    label: 'Inventory', icon: Warehouse, children: [
      { label: 'Stock', icon: Package, href: '/app/inventory', module: 'inventory' },
      { label: 'Warehouses', icon: Warehouse, href: '/app/warehouses', module: 'warehouses' },
      { label: 'Transfers', icon: Truck, href: '/app/stock-transfers', module: 'inventory' },
    ],
  },
  {
    label: 'Purchasing', icon: ClipboardList, children: [
      { label: 'Suppliers', icon: Users, href: '/app/suppliers', module: 'suppliers' },
      { label: 'Purchase Orders', icon: ClipboardList, href: '/app/purchase-orders', module: 'purchasing' },
    ],
  },
  { label: 'Customers', icon: UserCheck, href: '/app/customers', module: 'customers' },
  { label: 'Delivery', icon: Truck, href: '/app/delivery', module: 'delivery' },
  {
    label: 'HR', icon: Users, children: [
      { label: 'Employees', icon: Users, href: '/app/employees', module: 'employees' },
      { label: 'Attendance', icon: UserCheck, href: '/app/attendance', module: 'attendance' },
      { label: 'Leave', icon: ClipboardList, href: '/app/leave', module: 'leave' },
      { label: 'Payroll', icon: DollarSign, href: '/app/payroll', module: 'payroll' },
    ],
  },
  {
    label: 'Finance', icon: DollarSign, children: [
      { label: 'Expenses', icon: CreditCard, href: '/app/expenses', module: 'expenses' },
      { label: 'Accounting', icon: FileText, href: '/app/accounting', module: 'accounting' },
      { label: 'Reports', icon: BarChart2, href: '/app/reports', module: 'reports' },
    ],
  },
  { label: 'Marketing', icon: Megaphone, href: '/app/marketing', module: 'marketing' },
  { label: 'Website', icon: Globe, href: '/app/website', module: 'website' },
  { label: 'Analytics', icon: BarChart2, href: '/app/analytics', module: 'analytics' },
  {
    label: 'Settings', icon: Settings, children: [
      { label: 'Business', icon: Building2, href: '/app/settings/business' },
      { label: 'Branches', icon: Building2, href: '/app/branches', module: 'branches' },
      { label: 'Users', icon: Users, href: '/app/users', module: 'users' },
      { label: 'Roles', icon: Shield, href: '/app/roles', module: 'roles' },
      { label: 'Integrations', icon: Layers, href: '/app/integrations', module: 'integrations' },
      { label: 'Audit Log', icon: FileText, href: '/app/audit-logs', module: 'audit_logs' },
    ],
  },
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
          {navItems.map((item) => (
            <NavItemComponent key={item.label} item={item} collapsed={collapsed} />
          ))}
        </nav>
      </aside>
    </>
  )
}
