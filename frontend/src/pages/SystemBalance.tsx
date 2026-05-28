import { LineChart } from '../components/charts/LineChart'
import { TopBar } from '../components/layout/TopBar'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import { LiveDot } from '../components/ui/LiveDot'
import { formatGMD } from '../lib/format'
import { balanceTrendChart, systemBalanceData } from '../lib/mockData'

export function SystemBalance() {
  const reconciliationData = [
    {
      account: 'Customer Wallets (Liability)',
      balance: 28500000,
      type: 'Internal',
    },
    {
      account: 'Agent Wallets (Liability)',
      balance: 12400000,
      type: 'Internal',
    },
    {
      account: 'Trust Account - Ecobank (Asset)',
      balance: 25000000,
      type: 'External',
    },
    {
      account: 'Trust Account - GTBank (Asset)',
      balance: 15900000,
      type: 'External',
    },
  ]

  const totalLiabilities = 28500000 + 12400000
  const totalAssets = 25000000 + 15900000
  const variance = totalAssets - totalLiabilities

  return (
    <div className="flex h-full flex-col">
      <TopBar title="System Cumulative Balance" />

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="flex items-center justify-between rounded-lg bg-brand-navy p-6 text-white shadow-sm">
          <div>
            <div className="mb-1 flex items-center gap-3">
              <h2 className="text-lg font-medium text-white/80">
                Total System Float
              </h2>
              <LiveDot className="rounded-full bg-white/10 px-2 py-1" />
            </div>
            <div className="text-4xl font-bold tracking-tight">
              {formatGMD(45250000)}
            </div>
          </div>
          <div className="hidden gap-8 md:flex">
            {systemBalanceData.map((item) => (
              <div key={item.label}>
                <div className="mb-1 text-sm text-white/70">{item.label}</div>
                <div className="text-xl font-medium">
                  {formatGMD(item.value)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Intraday Float Trend</CardTitle>
            </CardHeader>
            <LineChart data={balanceTrendChart} height={300} area smooth />
          </Card>

          <Card noPadding className="flex flex-col">
            <CardHeader className="mb-0 border-b border-border p-5">
              <CardTitle>Real-time Reconciliation</CardTitle>
            </CardHeader>
            <div className="flex-1 overflow-auto">
              <DataTable
                data={reconciliationData}
                keyExtractor={(r) => r.account}
                columns={[
                  {
                    header: 'Account',
                    accessor: 'account',
                  },
                  {
                    header: 'Type',
                    accessor: (r) => (
                      <span
                        className={`rounded-sm px-2 py-1 text-xs ${r.type === 'Internal' ? 'bg-bg-secondary' : 'bg-brand-blue/10 text-brand-blue'}`}
                      >
                        {r.type}
                      </span>
                    ),
                  },
                  {
                    header: 'Balance',
                    accessor: (r) => formatGMD(r.balance),
                    isNumeric: true,
                  },
                ]}
              />
              <div className="mt-auto border-t border-border bg-bg-secondary p-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-text-secondary">
                    Total Liabilities (Wallets)
                  </span>
                  <span className="font-mono font-medium">
                    {formatGMD(totalLiabilities)}
                  </span>
                </div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm text-text-secondary">
                    Total Assets (Banks)
                  </span>
                  <span className="font-mono font-medium">
                    {formatGMD(totalAssets)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-sm font-medium">Variance</span>
                  <span
                    className={`font-mono font-bold ${variance === 0 ? 'text-semantic-green' : 'text-semantic-red'}`}
                  >
                    {formatGMD(variance)}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
