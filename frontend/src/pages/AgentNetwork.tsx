import { TopBar } from '../components/layout/TopBar'
import { Badge } from '../components/ui/Badge'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import { formatGMD, formatNumber } from '../lib/format'

export function AgentNetwork() {
  const hierarchyData = [
    {
      id: 'M1',
      name: 'Brikama Master Agent',
      type: 'Master Agent',
      agents: 45,
      volume: 12500000,
      comm: 125000,
      status: 'active',
    },
    {
      id: 'M2',
      name: 'Serekunda Central',
      type: 'Master Agent',
      agents: 82,
      volume: 24800000,
      comm: 248000,
      status: 'active',
    },
    {
      id: 'M3',
      name: 'Banjul Distributors',
      type: 'Master Agent',
      agents: 28,
      volume: 8500000,
      comm: 85000,
      status: 'warning',
    },
    {
      id: 'M4',
      name: 'Farafenni Regional',
      type: 'Master Agent',
      agents: 15,
      volume: 3200000,
      comm: 32000,
      status: 'active',
    },
    {
      id: 'M5',
      name: 'Basse Super Agent',
      type: 'Master Agent',
      agents: 34,
      volume: 9100000,
      comm: 91000,
      status: 'active',
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Agency Network Report" />

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-none bg-brand-navy text-white">
            <div className="mb-2 flex items-center gap-3">
              <i className="ti ti-users text-2xl text-brand-gold"></i>
              <h3 className="text-sm font-medium text-white/80">
                Total Active Agents
              </h3>
            </div>
            <div className="text-3xl font-medium">1,240</div>
            <div className="mt-2 text-xs text-semantic-green">
              ▲ 12 new this week
            </div>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-3">
              <i className="ti ti-activity text-2xl text-brand-blue"></i>
              <h3 className="text-sm font-medium text-text-secondary">
                Network Volume (MTD)
              </h3>
            </div>
            <div className="text-3xl font-medium text-text-primary">
              {formatGMD(145000000)}
            </div>
            <div className="mt-2 text-xs text-semantic-green">
              ▲ 4.2% vs last month
            </div>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-3">
              <i className="ti ti-coin text-2xl text-brand-gold"></i>
              <h3 className="text-sm font-medium text-text-secondary">
                Total Commissions Paid
              </h3>
            </div>
            <div className="text-3xl font-medium text-text-primary">
              {formatGMD(1450000)}
            </div>
            <div className="mt-2 text-xs text-text-secondary">
              Avg {formatGMD(1169)} per agent
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" noPadding>
            <CardHeader className="mb-0 border-b border-border p-5">
              <CardTitle>Master Agent Hierarchy</CardTitle>
            </CardHeader>
            <DataTable
              data={hierarchyData}
              keyExtractor={(r) => r.id}
              columns={[
                {
                  header: 'Entity Name',
                  accessor: (r) => (
                    <div className="flex items-center gap-2">
                      <i className="ti ti-chevron-right text-xs text-text-secondary"></i>
                      <span className="font-medium">{r.name}</span>
                    </div>
                  ),
                },
                {
                  header: 'Type',
                  accessor: (r) => <Badge variant="agent">{r.type}</Badge>,
                },
                {
                  header: 'Sub-Agents',
                  accessor: (r) => formatNumber(r.agents),
                  isNumeric: true,
                },
                {
                  header: 'Volume',
                  accessor: (r) => formatGMD(r.volume),
                  isNumeric: true,
                },
                {
                  header: 'Commission',
                  accessor: (r) => formatGMD(r.comm),
                  isNumeric: true,
                },
                {
                  header: 'Status',
                  accessor: (r) => (
                    <Badge variant={r.status === 'active' ? 'green' : 'amber'}>
                      {r.status}
                    </Badge>
                  ),
                },
              ]}
            />
          </Card>

          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Geographic Distribution</CardTitle>
            </CardHeader>
            <div className="flex min-h-[300px] flex-1 items-center justify-center rounded-md border border-border bg-bg-secondary">
              <div className="text-center text-text-secondary">
                <i className="ti ti-map-2 mb-2 text-4xl"></i>
                <p className="text-sm">Interactive Map View</p>
                <p className="mt-1 text-xs">The Gambia Region</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
