import { TopBar } from '../components/layout/TopBar'
import { Badge, BadgeVariant } from '../components/ui/Badge'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import { KpiCard } from '../components/ui/KpiCard'
import { formatGMD } from '../lib/format'

export function AmlAlerts() {
  const alerts = [
    {
      id: 'ALT-001',
      customer: 'Modou Jallow',
      type: 'Velocity Limit Exceeded',
      severity: 'High',
      amount: 450000,
      date: '2026-05-26 14:30',
      status: 'Open',
    },
    {
      id: 'ALT-002',
      customer: 'Unknown Sender',
      type: 'Sanctions List Match',
      severity: 'Critical',
      amount: 15000,
      date: '2026-05-26 12:15',
      status: 'Investigating',
    },
    {
      id: 'ALT-003',
      customer: 'Fatoumatta Ceesay',
      type: 'Structuring (Smurfing)',
      severity: 'Medium',
      amount: 280000,
      date: '2026-05-25 09:45',
      status: 'Open',
    },
    {
      id: 'ALT-004',
      customer: 'Alieu Bah',
      type: 'Unusual Location',
      severity: 'Low',
      amount: 5000,
      date: '2026-05-25 08:20',
      status: 'Closed',
    },
    {
      id: 'ALT-005',
      customer: 'Brikama Superstore',
      type: 'High Volume Cash-In',
      severity: 'Medium',
      amount: 850000,
      date: '2026-05-24 16:10',
      status: 'Open',
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <TopBar title="AML & Fraud Alerts" />

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <KpiCard
            label="Open Alerts"
            value={24}
            trend={12.5}
            icon="ti-alert-triangle"
          />
          <KpiCard
            label="Critical / High Risk"
            value={5}
            trend={-20.0}
            icon="ti-shield-x"
          />
          <KpiCard
            label="Avg Resolution Time"
            value={4.2}
            trend={-15.5}
            icon="ti-clock"
          />
          <KpiCard
            label="Blocked Volume (MTD)"
            value={1250000}
            trend={5.2}
            isCurrency
            icon="ti-lock"
          />
        </div>

        <Card noPadding>
          <CardHeader className="mb-0 flex items-center justify-between border-b border-border p-5">
            <CardTitle>Recent Alerts</CardTitle>
            <select className="rounded-sm border border-border bg-bg-primary px-2 py-1 text-sm outline-none">
              <option>All Severities</option>
              <option>Critical</option>
              <option>High</option>
              <option>Medium</option>
            </select>
          </CardHeader>
          <DataTable
            data={alerts}
            keyExtractor={(r) => r.id}
            columns={[
              {
                header: 'Alert ID',
                accessor: 'id',
                className: 'font-mono text-xs text-text-secondary',
              },
              {
                header: 'Customer / Entity',
                accessor: 'customer',
                className: 'font-medium',
              },
              {
                header: 'Rule Triggered',
                accessor: 'type',
              },
              {
                header: 'Severity',
                accessor: (r) => {
                  const variants: Record<string, BadgeVariant> = {
                    Critical: 'red',
                    High: 'amber',
                    Medium: 'gold',
                    Low: 'gray',
                  }
                  return (
                    <Badge variant={variants[r.severity]}>{r.severity}</Badge>
                  )
                },
              },
              {
                header: 'Amount Involved',
                accessor: (r) => formatGMD(r.amount),
                isNumeric: true,
              },
              {
                header: 'Date',
                accessor: 'date',
                className: 'text-xs text-text-secondary',
              },
              {
                header: 'Status',
                accessor: (r) => (
                  <Badge
                    variant={
                      r.status === 'Closed'
                        ? 'gray'
                        : r.status === 'Investigating'
                          ? 'purple'
                          : 'red'
                    }
                  >
                    {r.status}
                  </Badge>
                ),
              },
              {
                header: 'Action',
                accessor: () => (
                  <button className="text-sm font-medium text-brand-blue hover:underline">
                    Review
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
