import { TopBar } from '../components/layout/TopBar'
import { Badge, BadgeVariant } from '../components/ui/Badge'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'

export function AccessControl() {
  const users = [
    {
      id: 'U1',
      name: 'Admin User',
      email: 'admin@apswallet.gm',
      role: 'Super Admin',
      lastLogin: '2 mins ago',
      status: 'Active',
    },
    {
      id: 'U2',
      name: 'Finance Director',
      email: 'finance@apswallet.gm',
      role: 'Finance Admin',
      lastLogin: '1 hour ago',
      status: 'Active',
    },
    {
      id: 'U3',
      name: 'Compliance Officer',
      email: 'compliance@apswallet.gm',
      role: 'Compliance',
      lastLogin: '3 hours ago',
      status: 'Active',
    },
    {
      id: 'U4',
      name: 'Regional Manager',
      email: 'manager.brikama@apswallet.gm',
      role: 'Master Agent',
      lastLogin: 'Yesterday',
      status: 'Active',
    },
    {
      id: 'U5',
      name: 'Guest Auditor',
      email: 'auditor@external.com',
      role: 'Viewer',
      lastLogin: '1 week ago',
      status: 'Inactive',
    },
  ]

  const roleBadgeMap: Record<string, BadgeVariant> = {
    'Super Admin': 'super-admin',
    'Finance Admin': 'finance',
    Compliance: 'compliance',
    'Master Agent': 'agent',
    Viewer: 'viewer',
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Access Control"
        primaryAction={{
          label: 'Invite User',
          onClick: () => {},
          icon: 'ti-user-plus',
        }}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <Card noPadding>
          <CardHeader className="mb-0 flex items-center justify-between border-b border-border p-5">
            <CardTitle>System Users</CardTitle>
            <div className="relative hidden sm:block">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"></i>
              <input
                type="text"
                placeholder="Search users..."
                className="w-64 rounded-sm border border-border bg-bg-primary py-1.5 pl-9 pr-3 text-sm outline-none"
              />
            </div>
          </CardHeader>
          <DataTable
            data={users}
            keyExtractor={(r) => r.id}
            columns={[
              {
                header: 'User',
                accessor: (r) => (
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue/10 font-medium text-brand-blue">
                      {r.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-text-secondary">
                        {r.email}
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                header: 'Role',
                accessor: (r) => (
                  <Badge variant={roleBadgeMap[r.role]}>{r.role}</Badge>
                ),
              },
              {
                header: 'Last Login',
                accessor: 'lastLogin',
                className: 'text-sm text-text-secondary',
              },
              {
                header: 'Status',
                accessor: (r) => (
                  <Badge variant={r.status === 'Active' ? 'green' : 'gray'}>
                    {r.status}
                  </Badge>
                ),
              },
              {
                header: 'Actions',
                accessor: () => (
                  <button className="text-text-secondary hover:text-brand-blue">
                    <i className="ti ti-dots-vertical"></i>
                  </button>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  )
}
