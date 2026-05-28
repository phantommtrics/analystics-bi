import { TopBar } from '../components/layout/TopBar'
import { Badge } from '../components/ui/Badge'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'

export function Schedules() {
  const schedules = [
    {
      id: 'SCH-01',
      report: 'Daily Transaction Summary',
      frequency: 'Daily at 00:00',
      format: 'Excel',
      recipients: 'finance@apswallet.gm',
      status: 'Active',
      nextRun: 'Tomorrow 00:00',
    },
    {
      id: 'SCH-02',
      report: 'AML Alert Report',
      frequency: 'Hourly',
      format: 'PDF',
      recipients: 'compliance@apswallet.gm',
      status: 'Active',
      nextRun: 'Today 14:00',
    },
    {
      id: 'SCH-03',
      report: 'Agent Performance Matrix',
      frequency: 'Weekly (Mon 08:00)',
      format: 'PDF',
      recipients: 'agents-admin@apswallet.gm',
      status: 'Active',
      nextRun: 'May 31 08:00',
    },
    {
      id: 'SCH-04',
      report: 'System Cumulative Balance',
      frequency: 'Daily at 23:59',
      format: 'CSV',
      recipients: 'ceo@apswallet.gm',
      status: 'Paused',
      nextRun: '-',
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Report Schedules"
        primaryAction={{
          label: 'New Schedule',
          onClick: () => {},
          icon: 'ti-plus',
        }}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <Card noPadding>
          <CardHeader className="mb-0 border-b border-border p-5">
            <CardTitle>Active Schedules</CardTitle>
          </CardHeader>
          <DataTable
            data={schedules}
            keyExtractor={(r) => r.id}
            columns={[
              {
                header: 'Report Name',
                accessor: 'report',
                className: 'font-medium',
              },
              {
                header: 'Frequency',
                accessor: 'frequency',
              },
              {
                header: 'Format',
                accessor: (r) => <Badge variant="gray">{r.format}</Badge>,
              },
              {
                header: 'Recipients',
                accessor: 'recipients',
                className: 'text-text-secondary text-sm',
              },
              {
                header: 'Next Run',
                accessor: 'nextRun',
                className: 'text-xs text-text-secondary',
              },
              {
                header: 'Status',
                accessor: (r) => (
                  <Badge variant={r.status === 'Active' ? 'green' : 'amber'}>
                    {r.status}
                  </Badge>
                ),
              },
              {
                header: 'Actions',
                accessor: () => (
                  <div className="flex gap-2 text-text-secondary">
                    <button className="hover:text-brand-blue">
                      <i className="ti ti-pencil"></i>
                    </button>
                    <button className="hover:text-semantic-red">
                      <i className="ti ti-trash"></i>
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  )
}
