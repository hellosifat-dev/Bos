import { Fragment } from 'react'
import { Menu, Transition } from '@headlessui/react'
import { Bell, ChevronDown, Menu as MenuIcon, Building2, LogOut, User, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { useAuthStore } from '@/stores/authStore'
import { useAuth } from '@/hooks/useAuth'

interface HeaderProps {
  onMobileMenuOpen: () => void
  sidebarCollapsed: boolean
}

export function Header({ onMobileMenuOpen, sidebarCollapsed }: HeaderProps) {
  const { logout } = useAuth()
  const { user, currentBusiness } = useAuthStore()
  const navigate = useNavigate()

  return (
    <header
      className={clsx(
        'fixed right-0 top-0 z-30 flex h-16 items-center border-b border-gray-200 bg-white px-4 transition-all duration-300',
        sidebarCollapsed ? 'left-[68px]' : 'left-64',
        'left-0 lg:left-auto' // mobile: full width
      )}
    >
      {/* Mobile menu button */}
      <button
        onClick={onMobileMenuOpen}
        className="mr-3 flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 lg:hidden"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      {/* Business selector */}
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
           onClick={() => navigate('/app/businesses')}>
        <Building2 className="h-4 w-4 text-primary-600" />
        <span className="font-medium max-w-[180px] truncate">
          {currentBusiness?.name ?? 'Select Business'}
        </span>
        <ChevronDown className="h-3 w-3 text-gray-400" />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Notifications */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {/* User menu */}
        <Menu as="div" className="relative">
          <Menu.Button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-100">
            <div className="h-7 w-7 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-xs font-semibold text-primary-700">
                {user?.name?.[0]?.toUpperCase() ?? 'U'}
              </span>
            </div>
            <span className="hidden sm:block max-w-[120px] truncate font-medium text-gray-700">{user?.name}</span>
            <ChevronDown className="h-3 w-3 text-gray-400" />
          </Menu.Button>

          <Transition as={Fragment}
            enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute right-0 mt-1 w-52 rounded-xl bg-white shadow-lg ring-1 ring-black/5 focus:outline-none py-1">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>

              <Menu.Item>
                {({ active }) => (
                  <button onClick={() => navigate('/app/profile')}
                    className={clsx('flex w-full items-center gap-2 px-3 py-2 text-sm', active ? 'bg-gray-50 text-gray-900' : 'text-gray-700')}>
                    <User className="h-4 w-4" /> My Profile
                  </button>
                )}
              </Menu.Item>

              <Menu.Item>
                {({ active }) => (
                  <button onClick={() => navigate('/app/settings')}
                    className={clsx('flex w-full items-center gap-2 px-3 py-2 text-sm', active ? 'bg-gray-50 text-gray-900' : 'text-gray-700')}>
                    <Settings className="h-4 w-4" /> Settings
                  </button>
                )}
              </Menu.Item>

              <div className="my-1 border-t border-gray-100" />

              <Menu.Item>
                {({ active }) => (
                  <button onClick={() => logout()}
                    className={clsx('flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600', active ? 'bg-red-50' : '')}>
                    <LogOut className="h-4 w-4" /> Sign Out
                  </button>
                )}
              </Menu.Item>
            </Menu.Items>
          </Transition>
        </Menu>
      </div>
    </header>
  )
}
