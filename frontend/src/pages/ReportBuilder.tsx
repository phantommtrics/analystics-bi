import { useState } from 'react'
import { BarChart } from '../components/charts/BarChart'
import { TopBar } from '../components/layout/TopBar'
import { DataTable } from '../components/ui/DataTable'
import { SqlEditor } from '../components/report/SqlEditor'
import { ExpandableCard } from '../components/ui/ExpandableCard'
import { LoadingButton } from '../components/ui/LoadingButton'

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

  const queryToolbar = (
    <div className="flex flex-wrap items-center gap-2">
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
  )

  const testQueryAction = (
    <LoadingButton
      variant="secondary"
      loading={isValidating}
      className="px-3 py-1.5 text-xs"
      onClick={handleTest}
    >
      {!isValidating && <i className="ti ti-player-play"></i>}
      Test Query
    </LoadingButton>
  )

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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex min-h-0 w-full flex-col lg:w-1/2">
          <ExpandableCard
            title="Query editor"
            noPadding
            className="min-h-0 flex-1 rounded-none border-0 border-r border-border shadow-none"
            headerClassName="mb-0 gap-3 border-b border-border bg-bg-secondary p-4"
            bodyClassName="flex min-h-0 flex-1 flex-col"
            expandedBodyClassName="flex flex-col"
            action={
              <div className="flex flex-wrap items-center gap-2">
                {testQueryAction}
              </div>
            }
          >
            <div className="border-b border-border bg-bg-secondary px-4 py-3">
              {queryToolbar}
            </div>
            <div className="flex min-h-[240px] flex-1 flex-col bg-[#1e1e1e] p-4 text-[#d4d4d4] lg:min-h-0">
              <SqlEditor value={sql} onChange={setSql} minHeight="200px" />
            </div>
            {isValid !== null && (
              <div
                className={`flex shrink-0 items-center gap-2 px-4 py-2 text-xs font-medium ${isValid ? 'bg-semantic-green/10 text-semantic-green' : 'bg-semantic-red/10 text-semantic-red'}`}
              >
                <i className={`ti ${isValid ? 'ti-check' : 'ti-alert-circle'}`}></i>
                {isValid
                  ? 'Query valid · 7 rows returned · 42ms'
                  : 'Syntax error near line 4'}
              </div>
            )}
          </ExpandableCard>
        </div>

        <div className="flex min-h-0 w-full flex-col gap-6 overflow-y-auto bg-bg-tertiary p-6 lg:w-1/2">
          <p className="text-sm font-medium uppercase tracking-wider text-text-secondary">
            Live preview
          </p>

          <ExpandableCard
            title="Chart preview"
            expandedBodyClassName="flex flex-col"
          >
            <BarChart data={mockPreviewData} height={250} />
          </ExpandableCard>

          <ExpandableCard
            title="Data result (first 5 rows)"
            noPadding
            headerClassName="mb-0 border-b border-border px-4 py-4 sm:px-5"
            bodyClassName="min-h-0"
          >
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
          </ExpandableCard>
        </div>
      </div>
    </div>
  )
}
