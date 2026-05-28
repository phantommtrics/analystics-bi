import { useState } from 'react'
import { BarChart } from '../components/charts/BarChart'
import { TopBar } from '../components/layout/TopBar'
import { Card } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'

export function ReportBuilder() {
  const [sql, setSql] = useState(
    `SELECT \n  DATE(created_at) as day,\n  COUNT(*) as total_transactions,\n  SUM(amount) as total_volume\nFROM transactions\nWHERE status = 'success'\nGROUP BY DATE(created_at)\nORDER BY day DESC\nLIMIT 7;`,
  )
  const [isValidating, setIsValidating] = useState(false)
  const [isValid, setIsValid] = useState<boolean | null>(null)

  const handleTest = () => {
    setIsValidating(true)
    window.setTimeout(() => {
      setIsValidating(false)
      setIsValid(true)
    }, 800)
  }

  const mockPreviewData = {
    labels: [
      'May 20',
      'May 21',
      'May 22',
      'May 23',
      'May 24',
      'May 25',
      'May 26',
    ],
    series: [
      {
        name: 'Volume',
        data: [120, 132, 101, 134, 90, 230, 210],
      },
    ],
  }

  const mockTableData = [
    {
      day: '2026-05-26',
      total_transactions: 12450,
      total_volume: 45250000,
    },
    {
      day: '2026-05-25',
      total_transactions: 11200,
      total_volume: 41100000,
    },
    {
      day: '2026-05-24',
      total_transactions: 10800,
      total_volume: 39500000,
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Report Builder"
        showDateFilter={false}
        showExport={false}
        primaryAction={{
          label: 'Save Report',
          onClick: () => {},
          icon: 'ti-device-floppy',
        }}
      />

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex w-full flex-col border-r border-border bg-bg-primary lg:w-1/2">
          <div className="flex items-center justify-between border-b border-border bg-bg-secondary p-4">
            <div className="flex gap-2">
              <select className="rounded-sm border border-border bg-bg-primary px-2 py-1 text-sm outline-none">
                <option>Bar Chart</option>
                <option>Line Chart</option>
                <option>Pie Chart</option>
                <option>Table Only</option>
              </select>
              <select className="rounded-sm border border-border bg-bg-primary px-2 py-1 text-sm outline-none">
                <option>Transactions DB</option>
                <option>Users DB</option>
                <option>Analytics DB</option>
              </select>
            </div>
            <button
              onClick={handleTest}
              disabled={isValidating}
              className="flex items-center gap-2 rounded-sm border border-border bg-bg-primary px-3 py-1 text-sm font-medium transition-colors hover:bg-bg-tertiary disabled:opacity-50"
            >
              <i
                className={`ti ${isValidating ? 'ti-loader animate-spin' : 'ti-player-play'}`}
              ></i>
              Test Query
            </button>
          </div>

          <div className="flex-1 overflow-auto bg-[#1e1e1e] p-4 font-mono text-sm text-[#d4d4d4]">
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              className="h-full w-full resize-none bg-transparent outline-none"
              spellCheck={false}
            />
          </div>

          {isValid !== null && (
            <div
              className={`flex items-center gap-2 p-2 text-xs font-medium ${isValid ? 'bg-semantic-green/10 text-semantic-green' : 'bg-semantic-red/10 text-semantic-red'}`}
            >
              <i
                className={`ti ${isValid ? 'ti-check' : 'ti-alert-circle'}`}
              ></i>
              {isValid
                ? 'Query valid · 7 rows returned · 42ms'
                : 'Syntax error near line 4'}
            </div>
          )}
        </div>

        <div className="flex w-full flex-col space-y-6 overflow-y-auto bg-bg-tertiary p-6 lg:w-1/2">
          <h2 className="text-sm font-medium uppercase tracking-wider text-text-secondary">
            Live Preview
          </h2>

          <Card>
            <BarChart data={mockPreviewData} height={250} />
          </Card>

          <Card noPadding>
            <div className="border-b border-border p-4">
              <h3 className="text-sm font-medium">
                Data Result (First 5 rows)
              </h3>
            </div>
            <DataTable
              data={mockTableData}
              keyExtractor={(r) => r.day}
              columns={[
                {
                  header: 'day',
                  accessor: 'day',
                  className: 'font-mono',
                },
                {
                  header: 'total_transactions',
                  accessor: 'total_transactions',
                  isNumeric: true,
                },
                {
                  header: 'total_volume',
                  accessor: 'total_volume',
                  isNumeric: true,
                },
              ]}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
