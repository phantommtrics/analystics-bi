import { NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

const navGroups = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Dashboard',
        icon: 'ti-layout-dashboard',
        path: '/',
        moduleKey: 'dashboard',
      },
      {
        label: 'Reports',
        icon: 'ti-report-analytics',
        path: '/reports',
        moduleKey: 'reports',
      },
      {
        label: 'Statements',
        icon: 'ti-receipt',
        path: '/statements',
        moduleKey: 'statements',
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        label: 'Agents',
        icon: 'ti-users',
        path: '/agents',
        moduleKey: 'agents',
      },
      {
        label: 'Customers',
        icon: 'ti-user',
        path: '/customers',
        moduleKey: 'customers',
      },
      {
        label: 'Banks',
        icon: 'ti-building-bank',
        path: '/banks',
        moduleKey: 'banks',
      },
      {
        label: 'Remittance',
        icon: 'ti-world',
        path: '/remittance',
        moduleKey: 'remittance',
      },
    ],
  },
  {
    label: 'Compliance',
    items: [
      {
        label: 'AML Alerts',
        icon: 'ti-alert-circle',
        path: '/aml',
        moduleKey: 'aml',
      },
      {
        label: 'Reconciliation',
        icon: 'ti-shield-check',
        path: '/balance',
        moduleKey: 'balance',
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      {
        label: 'Report Builder',
        icon: 'ti-settings',
        path: '/reports/builder',
        moduleKey: 'reports',
      },
      {
        label: 'Dashboard Builder',
        icon: 'ti-layout-dashboard',
        path: '/dashboard-builder',
        moduleKey: 'dashboard-builder',
      },
      {
        label: 'Schedules',
        icon: 'ti-calendar',
        path: '/schedules',
        moduleKey: 'schedules',
      },
      {
        label: 'Access',
        icon: 'ti-lock',
        path: '/access',
        moduleKey: 'access',
      },
      {
        label: 'Audit Log',
        icon: 'ti-eye',
        path: '/audit',
        moduleKey: 'audit',
      },
    ],
  },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, hasPermission, logout } = useAuth()

  return (
    <>
      <button
        className={`fixed inset-0 z-20 bg-black/40 md:hidden ${isOpen ? 'block' : 'hidden'}`}
        aria-label="Close navigation"
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[220px] flex-col bg-sidebar text-[#e8eaf0] transition-transform duration-300 md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-16 items-center border-b border-white/10 px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-brand-gold text-lg font-bold text-sidebar">
              A
            </div>
            <span className="text-lg font-medium tracking-tight">
              APS Wallet BI
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          {navGroups.map((group, i) => {
            const allowedItems = group.items.filter((item) =>
              hasPermission(item.moduleKey, 'view'),
            )
            if (allowedItems.length === 0) {
              return null
            }

            return (
              <div key={i} className="mb-6">
              <div className="mb-2 px-3 text-micro font-medium uppercase tracking-wider text-[#9499aa]">
                {group.label}
              </div>
              <div className="space-y-1">
                {allowedItems.map((item, j) => (
                  <NavLink
                    key={j}
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) => `
                      flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors
                      ${isActive ? 'bg-white/10 font-medium text-white' : 'text-[#e8eaf0] hover:bg-white/5'}
                    `}
                  >
                    <i className={`ti ${item.icon} text-xl`}></i>
                    {item.label}
                  </NavLink>
                ))}
              </div>
              </div>
            )
          })}
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 px-2 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold/20 text-brand-gold">
              <i className="ti ti-user-circle"></i>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {user?.username ?? 'User'}
              </div>
              <div className="truncate text-xs text-[#9499aa]">
                {user?.userType === 'OWNER' ? 'Owner' : 'System User'}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-sm border border-white/15 px-3 py-2 text-xs font-medium text-[#e8eaf0] transition hover:bg-white/10"
          >
            <i className="ti ti-logout"></i>
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
