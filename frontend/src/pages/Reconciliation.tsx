import { TopBar } from '../components/layout/TopBar'
import { ExpandableCard } from '../components/ui/ExpandableCard'
import { DataTable } from '../components/ui/DataTable'
import { LiveDot } from '../components/ui/LiveDot'
import { formatGMD } from '../lib/format'

export function Reconciliation() {
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
      <TopBar title="Reconciliation" />

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-primary p-5">
          <h2 className="text-lg font-medium">Real-time reconciliation</h2>
          <LiveDot className="rounded-full bg-bg-secondary px-2 py-1" />
        </div>

        <ExpandableCard
          title="Account balances"
          noPadding
          className="flex flex-col"
          headerClassName="mb-0 border-b border-border p-5"
          bodyClassName="p-0"
        >
          <div className="flex-1 overflow-auto">
            <DataTable
              data={reconciliationData}
              keyExtractor={(r) => r.account}
              columns={[
                { header: 'Account', accessor: 'account' },
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
        </ExpandableCard>
      </div>
    </div>
  )
}
