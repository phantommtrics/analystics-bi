import { TopBar } from '../components/layout/TopBar'
import { Badge } from '../components/ui/Badge'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import { KpiCard } from '../components/ui/KpiCard'
import { formatGMD } from '../lib/format'

export function Banks() {
  const bankPartners = [
    {
      id: 'B1',
      name: 'Ecobank Gambia',
      type: 'Trust Account',
      balance: 25000000,
      lastRecon: '10 mins ago',
      status: 'healthy',
    },
    {
      id: 'B2',
      name: 'Guaranty Trust Bank',
      type: 'Trust Account',
      balance: 15900000,
      lastRecon: '15 mins ago',
      status: 'healthy',
    },
    {
      id: 'B3',
      name: 'Standard Chartered',
      type: 'Settlement',
      balance: 4500000,
      lastRecon: '1 hour ago',
      status: 'warning',
    },
    {
      id: 'B4',
      name: 'MegaBank',
      type: 'Settlement',
      balance: 2100000,
      lastRecon: '2 hours ago',
      status: 'healthy',
    },
    {
      id: 'B5',
      name: 'Access Bank',
      type: 'Disbursement',
      balance: 850000,
      lastRecon: '5 mins ago',
      status: 'healthy',
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Bank Integrations & Trust" />

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiCard
            label="Total Bank Balance"
            value={48350000}
            trend={1.2}
            isCurrency
            icon="ti-building-bank"
          />
          <KpiCard
            label="Pending Settlements"
            value={2140800}
            trend={-5.1}
            isCurrency
            icon="ti-clock"
          />
          <KpiCard
            label="Bank2Wallet Volume (Today)"
            value={3450000}
            trend={8.4}
            isCurrency
            icon="ti-arrows-right-left"
          />
        </div>

        <Card noPadding>
          <CardHeader className="mb-0 border-b border-border p-5">
            <CardTitle>Partner Banks Overview</CardTitle>
          </CardHeader>
          <DataTable
            data={bankPartners}
            keyExtractor={(r) => r.id}
            columns={[
              {
                header: 'Bank Name',
                accessor: (r) => (
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-bg-secondary text-brand-blue">
                      <i className="ti ti-building-bank"></i>
                    </div>
                    <span className="font-medium">{r.name}</span>
                  </div>
                ),
              },
              {
                header: 'Account Type',
                accessor: (r) => (
                  <Badge
                    variant={r.type === 'Trust Account' ? 'purple' : 'blue'}
                  >
                    {r.type}
                  </Badge>
                ),
              },
              {
                header: 'Current Balance',
                accessor: (r) => formatGMD(r.balance),
                isNumeric: true,
              },
              {
                header: 'Last Reconciled',
                accessor: 'lastRecon',
                className: 'text-text-secondary text-xs',
              },
              {
                header: 'API Status',
                accessor: (r) => (
                  <Badge variant={r.status === 'healthy' ? 'green' : 'amber'}>
                    {r.status}
                  </Badge>
                ),
              },
              {
                header: 'Actions',
                accessor: () => (
                  <button className="text-sm text-brand-blue hover:underline">
                    View Details
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
