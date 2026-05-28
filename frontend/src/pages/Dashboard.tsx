import { BarChart } from '../components/charts/BarChart'
import { PieChart } from '../components/charts/PieChart'
import { TopBar } from '../components/layout/TopBar'
import { Badge } from '../components/ui/Badge'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import { KpiCard } from '../components/ui/KpiCard'
import { LiveDot } from '../components/ui/LiveDot'
import { formatGMD, formatNumber } from '../lib/format'
import {
  dailyTransactionsChart,
  dashboardKpis,
  feeRevenuePie,
  topAgents,
} from '../lib/mockData'

export function Dashboard() {
  return (
    <div className="flex h-full flex-col">
      <TopBar title="Main Dashboard" />

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {dashboardKpis.map((kpi) => (
            <KpiCard key={kpi.id} {...kpi} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Daily Transaction Volume</CardTitle>
              <span className="text-xs text-text-secondary">Last 7 Days</span>
            </CardHeader>
            <BarChart data={dailyTransactionsChart} height={320} />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fee Revenue Breakdown</CardTitle>
              <span className="text-xs text-text-secondary">Today</span>
            </CardHeader>
            <PieChart data={feeRevenuePie} height={320} isCurrency />
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" noPadding>
            <div className="flex items-center justify-between border-b border-border p-4 sm:p-5">
              <CardTitle>Top Performing Agents</CardTitle>
              <button className="text-sm font-medium text-brand-blue hover:underline">
                View All
              </button>
            </div>
            <DataTable
              data={topAgents}
              keyExtractor={(r) => r.id}
              columns={[
                {
                  header: 'Agent Name',
                  accessor: 'name',
                },
                {
                  header: 'Location',
                  accessor: 'location',
                },
                {
                  header: 'Volume',
                  accessor: (r) => formatGMD(r.volume),
                  isNumeric: true,
                },
                {
                  header: 'Transactions',
                  accessor: (r) => formatNumber(r.txCount),
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

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <CardTitle>Live Float Monitor</CardTitle>
                <LiveDot />
              </div>
            </CardHeader>
            <div className="mt-4 space-y-6">
              {[
                {
                  label: 'Customer Float',
                  percentage: 63,
                  value: 28500000,
                  color: 'bg-brand-blue',
                },
                {
                  label: 'Agent Float',
                  percentage: 27,
                  value: 12400000,
                  color: 'bg-brand-gold',
                },
                {
                  label: 'Trust Account',
                  percentage: 10,
                  value: 4350000,
                  color: 'bg-semantic-green',
                },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-text-secondary">{item.label}</span>
                    <span className="font-medium text-text-primary">
                      {item.percentage}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-bg-secondary">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>
                  <div className="mt-1 text-right text-xs text-text-secondary">
                    {formatGMD(item.value)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
