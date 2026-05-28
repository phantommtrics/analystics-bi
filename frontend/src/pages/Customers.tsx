import { LineChart } from '../components/charts/LineChart'
import { TopBar } from '../components/layout/TopBar'
import { Badge } from '../components/ui/Badge'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import { KpiCard } from '../components/ui/KpiCard'
import { formatGMD } from '../lib/format'

export function Customers() {
  const customerGrowthData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    series: [
      {
        name: 'Total Customers',
        data: [120000, 125000, 132000, 145000, 158000, 165000],
      },
      {
        name: 'Active (30d)',
        data: [85000, 88000, 95000, 105000, 112000, 118000],
      },
    ],
  }

  const topCustomers = [
    {
      id: 'C001',
      name: 'Lamin Touray',
      phone: '+220 7XX XXXX',
      kyc: 'Tier 3',
      balance: 125000,
      status: 'active',
    },
    {
      id: 'C002',
      name: 'Isatou Njie',
      phone: '+220 3XX XXXX',
      kyc: 'Tier 2',
      balance: 45000,
      status: 'active',
    },
    {
      id: 'C003',
      name: 'Ousman Sanyang',
      phone: '+220 9XX XXXX',
      kyc: 'Tier 3',
      balance: 210000,
      status: 'active',
    },
    {
      id: 'C004',
      name: 'Aisha Camara',
      phone: '+220 2XX XXXX',
      kyc: 'Tier 1',
      balance: 5000,
      status: 'warning',
    },
    {
      id: 'C005',
      name: 'Ebrima Drammeh',
      phone: '+220 7XX XXXX',
      kyc: 'Tier 3',
      balance: 85000,
      status: 'active',
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Customer Analytics" />

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Registered"
            value={165420}
            trend={4.2}
            icon="ti-users"
          />
          <KpiCard
            label="Active (30 Days)"
            value={118240}
            trend={5.8}
            icon="ti-user-check"
          />
          <KpiCard
            label="Avg Wallet Balance"
            value={1850}
            trend={-1.2}
            isCurrency
            icon="ti-wallet"
          />
          <KpiCard
            label="KYC Tier 3"
            value={45200}
            trend={12.5}
            icon="ti-shield-check"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Customer Growth</CardTitle>
            </CardHeader>
            <LineChart data={customerGrowthData} height={300} smooth />
          </Card>

          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>KYC Distribution</CardTitle>
            </CardHeader>
            <div className="flex flex-1 flex-col justify-center space-y-4">
              {[
                ['Tier 1 (Basic)', 45, 'bg-semantic-gray'],
                ['Tier 2 (Standard)', 28, 'bg-brand-blue'],
                ['Tier 3 (Enhanced)', 27, 'bg-semantic-green'],
              ].map(([label, value, color]) => (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-text-secondary">{label}</span>
                    <span className="font-medium">{value}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-bg-secondary">
                    <div
                      className={`h-full rounded-full ${color}`}
                      style={{ width: `${value}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card noPadding>
          <CardHeader className="mb-0 border-b border-border p-5">
            <CardTitle>High Net Worth Customers</CardTitle>
          </CardHeader>
          <DataTable
            data={topCustomers}
            keyExtractor={(r) => r.id}
            columns={[
              {
                header: 'Name',
                accessor: 'name',
              },
              {
                header: 'Phone',
                accessor: 'phone',
                className: 'font-mono text-text-secondary',
              },
              {
                header: 'KYC Level',
                accessor: (r) => (
                  <Badge variant={r.kyc === 'Tier 3' ? 'green' : 'blue'}>
                    {r.kyc}
                  </Badge>
                ),
              },
              {
                header: 'Balance',
                accessor: (r) => formatGMD(r.balance),
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
      </div>
    </div>
  )
}
