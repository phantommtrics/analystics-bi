import { PieChart } from '../components/charts/PieChart'
import { TopBar } from '../components/layout/TopBar'
import { Badge } from '../components/ui/Badge'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import { KpiCard } from '../components/ui/KpiCard'
import { formatGMD } from '../lib/format'

export function Remittance() {
  const corridorData = [
    {
      name: 'Senegal',
      value: 4500000,
    },
    {
      name: 'USA',
      value: 3200000,
    },
    {
      name: 'UK',
      value: 2800000,
    },
    {
      name: 'Spain',
      value: 1500000,
    },
    {
      name: 'Germany',
      value: 950000,
    },
  ]

  const recentTxns = [
    {
      id: 'TX-9921',
      sender: 'John Doe (USA)',
      receiver: 'Fatou Ceesay',
      amount: 35000,
      partner: 'Ria',
      status: 'completed',
      time: '10 mins ago',
    },
    {
      id: 'TX-9922',
      sender: 'Mamadou Ba (SEN)',
      receiver: 'Modou Jallow',
      amount: 15000,
      partner: 'Orange Money',
      status: 'completed',
      time: '15 mins ago',
    },
    {
      id: 'TX-9923',
      sender: 'Sarah Smith (UK)',
      receiver: 'Lamin Touray',
      amount: 75000,
      partner: 'Western Union',
      status: 'pending',
      time: '22 mins ago',
    },
    {
      id: 'TX-9924',
      sender: 'Carlos R. (ESP)',
      receiver: 'Aisha Camara',
      amount: 25000,
      partner: 'MoneyGram',
      status: 'completed',
      time: '1 hour ago',
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <TopBar title="International Remittance" />

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Inflow (MTD)"
            value={12950000}
            trend={15.2}
            isCurrency
            icon="ti-arrow-down-right"
          />
          <KpiCard
            label="Total Outflow (MTD)"
            value={2450000}
            trend={-2.4}
            isCurrency
            icon="ti-arrow-up-right"
          />
          <KpiCard
            label="Active Corridors"
            value={12}
            trend={0}
            icon="ti-world"
          />
          <KpiCard
            label="Partner Commissions"
            value={385000}
            trend={12.1}
            isCurrency
            icon="ti-coin"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Top Inflow Corridors</CardTitle>
            </CardHeader>
            <PieChart data={corridorData} height={300} isCurrency />
          </Card>

          <Card className="lg:col-span-2" noPadding>
            <CardHeader className="mb-0 flex items-center justify-between border-b border-border p-5">
              <CardTitle>Recent Transactions</CardTitle>
              <button className="text-sm text-brand-blue hover:underline">
                View All
              </button>
            </CardHeader>
            <DataTable
              data={recentTxns}
              keyExtractor={(r) => r.id}
              columns={[
                {
                  header: 'Txn ID',
                  accessor: 'id',
                  className: 'font-mono text-xs text-text-secondary',
                },
                {
                  header: 'Sender',
                  accessor: 'sender',
                },
                {
                  header: 'Receiver',
                  accessor: 'receiver',
                },
                {
                  header: 'Partner',
                  accessor: (r) => <Badge variant="gray">{r.partner}</Badge>,
                },
                {
                  header: 'Amount',
                  accessor: (r) => formatGMD(r.amount),
                  isNumeric: true,
                },
                {
                  header: 'Status',
                  accessor: (r) => (
                    <Badge
                      variant={r.status === 'completed' ? 'green' : 'amber'}
                    >
                      {r.status}
                    </Badge>
                  ),
                },
                {
                  header: 'Time',
                  accessor: 'time',
                  className: 'text-xs text-text-secondary',
                },
              ]}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
