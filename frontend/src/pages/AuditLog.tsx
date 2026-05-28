import { TopBar } from '../components/layout/TopBar'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'

export function AuditLog() {
  const logs = [
    {
      id: 'EV-1042',
      timestamp: '2026-05-26 14:32:11',
      user: 'Admin User',
      action: 'EXPORT_REPORT',
      resource: 'Daily Transaction Summary',
      ip: '192.168.1.45',
    },
    {
      id: 'EV-1041',
      timestamp: '2026-05-26 14:15:00',
      user: 'System',
      action: 'RUN_SCHEDULE',
      resource: 'AML Alert Report',
      ip: 'localhost',
    },
    {
      id: 'EV-1040',
      timestamp: '2026-05-26 13:45:22',
      user: 'Finance Director',
      action: 'VIEW_DASHBOARD',
      resource: 'Financial Statements',
      ip: '10.0.0.12',
    },
    {
      id: 'EV-1039',
      timestamp: '2026-05-26 11:20:05',
      user: 'Admin User',
      action: 'UPDATE_ROLE',
      resource: 'User: U4 -> Master Agent',
      ip: '192.168.1.45',
    },
    {
      id: 'EV-1038',
      timestamp: '2026-05-26 09:00:12',
      user: 'Compliance Officer',
      action: 'LOGIN_SUCCESS',
      resource: 'System',
      ip: '172.16.0.5',
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <TopBar title="System Audit Log" showExport />

      <div className="flex-1 overflow-y-auto p-6">
        <Card noPadding>
          <CardHeader className="mb-0 flex items-center justify-between border-b border-border p-5">
            <CardTitle>Event History</CardTitle>
            <button className="flex items-center gap-2 rounded-sm border border-border bg-bg-secondary px-3 py-1.5 text-sm">
              <i className="ti ti-filter"></i> Filter
            </button>
          </CardHeader>
          <DataTable
            data={logs}
            keyExtractor={(r) => r.id}
            columns={[
              {
                header: 'Timestamp',
                accessor: 'timestamp',
                className: 'font-mono text-xs text-text-secondary',
              },
              {
                header: 'User',
                accessor: 'user',
                className: 'font-medium',
              },
              {
                header: 'Action',
                accessor: (r) => (
                  <span className="rounded-sm border border-border bg-bg-secondary px-2 py-1 font-mono text-xs">
                    {r.action}
                  </span>
                ),
              },
              {
                header: 'Resource',
                accessor: 'resource',
                className: 'text-sm',
              },
              {
                header: 'IP Address',
                accessor: 'ip',
                className: 'font-mono text-xs text-text-secondary',
              },
            ]}
          />
        </Card>
      </div>
    </div>
  )
}
