import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { dashboardsApi, type DashboardSummary } from '../../api/dashboards'
import { useAuth } from '../../auth/AuthContext'
import { canViewCustomDashboard } from '../../lib/dashboardFilters'
import {
  isSidebarReportCategory,
  type SidebarReportCategory,
} from '../../lib/reportConstants'

type NavItem = {
  label: string
  icon: string
  path: string
  moduleKey: string
  reportCategory?: SidebarReportCategory
}

const navGroups: {
  key?: string
  label: string
  items: NavItem[]
}[] = [
  {
    key: 'overview',
    label: 'Overview',
    items: [
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
        reportCategory: 'AGENTS',
      },
      {
        label: 'Balance',
        icon: 'ti-scale',
        path: '/balance',
        moduleKey: 'balance',
        reportCategory: 'BALANCE',
      },
      {
        label: 'Customers',
        icon: 'ti-user',
        path: '/customers',
        moduleKey: 'customers',
        reportCategory: 'CUSTOMERS',
      },
      {
        label: 'Banks',
        icon: 'ti-building-bank',
        path: '/banks',
        moduleKey: 'banks',
        reportCategory: 'BANKS',
      },
      {
        label: 'Remittance',
        icon: 'ti-world',
        path: '/remittance',
        moduleKey: 'remittance',
        reportCategory: 'REMITTANCE',
      },
    ],
  },
  {
    label: 'Compliance',
    items: [
      {
        label: 'AML',
        icon: 'ti-alert-circle',
        path: '/aml',
        moduleKey: 'aml',
        reportCategory: 'AML',
      },
      {
        label: 'Reconciliation',
        icon: 'ti-shield-check',
        path: '/reconciliation',
        moduleKey: 'reconciliation',
        reportCategory: 'RECONCILIATION',
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
        moduleKey: 'report-builder',
      },
      {
        label: 'Dashboard Builder',
        icon: 'ti-layout-dashboard',
        path: '/dashboard-builder',
        moduleKey: 'dashboard-builder',
      },
      {
        label: 'Statement Builder',
        icon: 'ti-receipt-2',
        path: '/statement-builder',
        moduleKey: 'statement-builder',
      },
      {
        label: 'Schedules',
        icon: 'ti-calendar',
        path: '/schedules',
        moduleKey: 'schedules',
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

const systemConfigItems = [
  {
    label: 'Roles',
    path: '/admin/system/roles',
    moduleKey: 'system-config-roles',
  },
  {
    label: 'User Groups',
    path: '/admin/system/groups',
    moduleKey: 'system-config-groups',
  },
  {
    label: 'Operators',
    path: '/admin/system/operators',
    moduleKey: 'system-config-operators',
  },
  {
    label: 'Data Sources',
    path: '/admin/system/datasources',
    moduleKey: 'system-config-datasources',
  },
  {
    label: 'Organizations',
    path: '/admin/system/organizations',
    moduleKey: 'owner-only',
  },
] as const

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

function dashboardViewPath(dashboardId: string) {
  return `/dashboards/${encodeURIComponent(dashboardId)}`
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, accessToken, hasPermission, logout } = useAuth()
  const location = useLocation()
  const [customDashboards, setCustomDashboards] = useState<DashboardSummary[]>([])
  const [sidebarDashboards, setSidebarDashboards] = useState<DashboardSummary[]>([])
  const canViewMainDashboard = hasPermission('dashboard', 'view')
  const dashboardActive =
    location.pathname === '/' || location.pathname.startsWith('/dashboards/')
  const [dashboardOpen, setDashboardOpen] = useState<boolean>(dashboardActive)
  const permissions = user?.permissions ?? []
  const visibleCustomDashboards = customDashboards.filter((dashboard) =>
    canViewCustomDashboard(permissions, dashboard.id, user?.userType),
  )
  const showDashboardNav = canViewMainDashboard

  const activeViewDashboardId = useMemo(() => {
    const match = location.pathname.match(/^\/dashboards\/([^/]+)$/)
    return match?.[1] ?? null
  }, [location.pathname])

  const visibleSidebarDashboards = useMemo(
    () =>
      sidebarDashboards.filter((dashboard) =>
        canViewCustomDashboard(permissions, dashboard.id, user?.userType),
      ),
    [sidebarDashboards, permissions, user?.userType],
  )

  const dashboardsByCategory = useMemo(() => {
    const grouped = new Map<SidebarReportCategory, DashboardSummary[]>()
    for (const dashboard of visibleSidebarDashboards) {
      if (
        !dashboard.sidebarCategory ||
        !isSidebarReportCategory(dashboard.sidebarCategory)
      ) {
        continue
      }
      const list = grouped.get(dashboard.sidebarCategory) ?? []
      list.push(dashboard)
      grouped.set(dashboard.sidebarCategory, list)
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name))
    }
    return grouped
  }, [visibleSidebarDashboards])

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!accessToken) {
      setCustomDashboards([])
      return
    }
    dashboardsApi
      .list(accessToken, undefined, { accessibleOnly: true })
      .then(setCustomDashboards)
      .catch(() => setCustomDashboards([]))
  }, [accessToken])

  useEffect(() => {
    if (!accessToken) {
      setSidebarDashboards([])
      return
    }
    dashboardsApi
      .list(accessToken, undefined, { accessibleOnly: true, sidebarMenuOnly: true })
      .then(setSidebarDashboards)
      .catch(() => setSidebarDashboards([]))
  }, [accessToken])

  useEffect(() => {
    if (dashboardActive) {
      setDashboardOpen(true)
    }
  }, [dashboardActive])

  useEffect(() => {
    if (!activeViewDashboardId) return
    const dashboard = visibleSidebarDashboards.find((d) => d.id === activeViewDashboardId)
    if (
      dashboard?.sidebarCategory &&
      isSidebarReportCategory(dashboard.sidebarCategory)
    ) {
      setOpenSections((prev) => ({ ...prev, [dashboard.sidebarCategory!]: true }))
    }
  }, [activeViewDashboardId, visibleSidebarDashboards])

  const visibleSystemConfigItems = systemConfigItems.filter((item) =>
    item.moduleKey === 'owner-only'
      ? user?.userType === 'OWNER'
      : hasPermission(item.moduleKey, 'view'),
  )
  const canAccessSystemConfig = visibleSystemConfigItems.length > 0
  const systemConfigActive = location.pathname.startsWith('/admin/system')
  const [systemConfigOpen, setSystemConfigOpen] = useState<boolean>(
    systemConfigActive || true,
  )

  function toggleSection(sectionKey: string) {
    setOpenSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }))
  }

  function renderNavItem(item: NavItem) {
    const sectionDashboards = item.reportCategory
      ? (dashboardsByCategory.get(item.reportCategory) ?? [])
      : []
    const hasSubmenu = sectionDashboards.length > 0
    const sectionKey = item.reportCategory ?? item.path
    const pathActive =
      location.pathname === item.path ||
      location.pathname.startsWith(`${item.path}/`)
    const submenuActive =
      pathActive ||
      sectionDashboards.some((dashboard) => dashboard.id === activeViewDashboardId)
    const isOpen = openSections[sectionKey] ?? submenuActive

    if (!hasSubmenu) {
      return (
        <NavLink
          key={item.path}
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
      )
    }

    return (
      <div key={item.path}>
        <button
          type="button"
          onClick={() => toggleSection(sectionKey)}
          className={`flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors ${
            submenuActive
              ? 'bg-white/10 font-medium text-white'
              : 'text-[#e8eaf0] hover:bg-white/5'
          }`}
        >
          <i className={`ti ${item.icon} text-xl`}></i>
          <span className="flex-1 text-left">{item.label}</span>
          <i
            className={`ti ti-chevron-down text-sm transition-transform ${isOpen ? 'rotate-180' : ''}`}
          ></i>
        </button>
        {isOpen && (
          <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-2">
            <NavLink
              to={item.path}
              onClick={onClose}
              end
              className={({ isActive }) => `
                block rounded-sm px-3 py-1.5 text-sm transition-colors
                ${isActive && !activeViewDashboardId ? 'bg-white/10 font-medium text-white' : 'text-[#c5c9d4] hover:bg-white/5'}
              `}
            >
              Overview
            </NavLink>
            {sectionDashboards.map((dashboard) => (
              <NavLink
                key={dashboard.id}
                to={dashboardViewPath(dashboard.id)}
                onClick={onClose}
                className={({ isActive }) => `
                  block truncate rounded-sm px-3 py-1.5 text-sm transition-colors
                  ${isActive || activeViewDashboardId === dashboard.id ? 'bg-white/10 font-medium text-white' : 'text-[#c5c9d4] hover:bg-white/5'}
                `}
                title={dashboard.name}
              >
                {dashboard.name}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    )
  }

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
            <div className="flex h-8 min-w-8 items-center justify-center rounded bg-brand-gold px-1.5 text-sm font-bold text-sidebar">
              Px
            </div>
            <span className="text-lg font-medium tracking-tight">
              PrixBI
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          {navGroups.map((group, i) => {
            const allowedItems = group.items.filter((item) =>
              hasPermission(item.moduleKey, 'view'),
            )
            const showGroup =
              allowedItems.length > 0 ||
              (group.key === 'overview' && showDashboardNav) ||
              (group.label === 'Admin' && canAccessSystemConfig)
            if (!showGroup) {
              return null
            }

            return (
              <div key={i} className="mb-6">
                <div className="mb-2 px-3 text-micro font-medium uppercase tracking-wider text-[#9499aa]">
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.key === 'overview' && showDashboardNav && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setDashboardOpen((o) => !o)}
                        className={`flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors ${
                          dashboardActive
                            ? 'bg-white/10 font-medium text-white'
                            : 'text-[#e8eaf0] hover:bg-white/5'
                        }`}
                      >
                        <i className="ti ti-layout-dashboard text-xl"></i>
                        <span className="flex-1 text-left">Dashboard</span>
                        <i
                          className={`ti ti-chevron-down text-sm transition-transform ${dashboardOpen ? 'rotate-180' : ''}`}
                        ></i>
                      </button>
                      {dashboardOpen && (
                        <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-2">
                          {canViewMainDashboard && (
                            <NavLink
                              to="/"
                              end
                              onClick={onClose}
                              className={({ isActive }) => `
                                block rounded-sm px-3 py-1.5 text-sm transition-colors
                                ${isActive ? 'bg-white/10 font-medium text-white' : 'text-[#c5c9d4] hover:bg-white/5'}
                              `}
                            >
                              Main Dashboard
                            </NavLink>
                          )}
                          {visibleCustomDashboards.map((dashboard) => (
                            <NavLink
                              key={dashboard.id}
                              to={`/dashboards/${dashboard.id}`}
                              onClick={onClose}
                              className={({ isActive }) => `
                                block truncate rounded-sm px-3 py-1.5 text-sm transition-colors
                                ${isActive ? 'bg-white/10 font-medium text-white' : 'text-[#c5c9d4] hover:bg-white/5'}
                              `}
                              title={dashboard.name}
                            >
                              {dashboard.name}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {allowedItems.map((item) => renderNavItem(item))}

                  {group.label === 'Admin' && canAccessSystemConfig && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setSystemConfigOpen((o) => !o)}
                        className={`flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors ${
                          systemConfigActive
                            ? 'bg-white/10 font-medium text-white'
                            : 'text-[#e8eaf0] hover:bg-white/5'
                        }`}
                      >
                        <i className="ti ti-settings text-xl"></i>
                        <span className="flex-1 text-left">System Config</span>
                        <i
                          className={`ti ti-chevron-down text-sm transition-transform ${systemConfigOpen ? 'rotate-180' : ''}`}
                        ></i>
                      </button>
                      {systemConfigOpen && (
                        <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-2">
                          {visibleSystemConfigItems.map((item) => (
                            <NavLink
                              key={item.path}
                              to={item.path}
                              onClick={onClose}
                              className={({ isActive }) => `
                                block rounded-sm px-3 py-1.5 text-sm transition-colors
                                ${isActive ? 'bg-white/10 font-medium text-white' : 'text-[#c5c9d4] hover:bg-white/5'}
                              `}
                            >
                              {item.label}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
