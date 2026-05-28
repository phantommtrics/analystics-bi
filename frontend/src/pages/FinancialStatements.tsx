import { useState } from 'react'
import { TopBar } from '../components/layout/TopBar'
import { Card } from '../components/ui/Card'
import { formatGMD } from '../lib/format'
import { plStatement } from '../lib/mockData'

export function FinancialStatements() {
  const [period, setPeriod] = useState('monthly')

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Financial Statements" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex rounded-md border border-border bg-bg-secondary p-1">
            {['monthly', 'quarterly', 'annual'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-sm px-4 py-1.5 text-sm font-medium capitalize transition-colors ${period === p ? 'bg-bg-primary text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
              >
                {p}
              </button>
            ))}
          </div>

          <select className="rounded-sm border border-border bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none focus:border-brand-blue">
            <option>APS Wallet Core</option>
            <option>APS IMF</option>
            <option>Consolidated</option>
          </select>
        </div>

        <Card noPadding className="overflow-hidden">
          <div className="border-b border-border bg-bg-secondary p-5">
            <h2 className="text-lg font-medium text-text-primary">
              Profit & Loss Statement
            </h2>
            <p className="text-sm text-text-secondary">
              For the period ending May 26, 2026
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-1/2 px-5 py-3 text-xs font-medium uppercase text-text-secondary">
                    Line Item
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase text-text-secondary">
                    Current Period
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase text-text-secondary">
                    Previous Period
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase text-text-secondary">
                    Variance
                  </th>
                </tr>
              </thead>
              <tbody>
                {plStatement.map((row) => {
                  if (row.isHeader) {
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-border bg-bg-tertiary"
                      >
                        <td
                          colSpan={4}
                          className="px-5 py-3 text-xs font-bold tracking-wider text-text-primary"
                        >
                          {row.label}
                        </td>
                      </tr>
                    )
                  }

                  const variance = row.variance ?? 0
                  const varColor =
                    variance > 0
                      ? 'text-semantic-green'
                      : variance < 0
                        ? 'text-semantic-red'
                        : 'text-text-secondary'

                  return (
                    <tr
                      key={row.id}
                      className={`
                        cursor-pointer border-b border-border transition-colors hover:bg-[#EAF0FB] dark:hover:bg-brand-blue/10
                        ${row.isSubtotal ? 'bg-bg-tertiary font-medium' : ''}
                        ${row.isTotal ? 'bg-brand-navy/5 text-lg font-bold dark:bg-brand-blue/20' : ''}
                      `}
                    >
                      <td
                        className={`px-5 py-3 text-sm ${row.isSubtotal || row.isTotal ? 'text-text-primary' : 'pl-8 text-text-secondary'}`}
                      >
                        {row.label}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-sm text-text-primary">
                        {row.current ? formatGMD(row.current) : '-'}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-sm text-text-secondary">
                        {row.previous ? formatGMD(row.previous) : '-'}
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-mono text-sm ${varColor}`}
                      >
                        {row.variance
                          ? `${row.variance > 0 ? '+' : ''}${row.variance.toFixed(1)}%`
                          : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
