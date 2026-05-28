import { useMemo, useState } from 'react'
import { TopBar } from '../components/layout/TopBar'
import { Badge, BadgeVariant } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { reportsCatalog } from '../lib/mockData'

const categoryConfig: Record<
  string,
  {
    icon: string
    bgClass: string
    textClass: string
    badgeVariant: BadgeVariant
  }
> = {
  Financial: {
    icon: 'ti-receipt',
    bgClass: 'bg-brand-blue/10',
    textClass: 'text-brand-blue',
    badgeVariant: 'blue',
  },
  Operational: {
    icon: 'ti-activity',
    bgClass: 'bg-brand-gold/10',
    textClass: 'text-brand-gold',
    badgeVariant: 'gold',
  },
  Compliance: {
    icon: 'ti-shield-check',
    bgClass: 'bg-semantic-green/10',
    textClass: 'text-semantic-green',
    badgeVariant: 'green',
  },
  Agent: {
    icon: 'ti-users',
    bgClass: 'bg-semantic-purple/10',
    textClass: 'text-semantic-purple',
    badgeVariant: 'purple',
  },
}

const roleBadgeMap: Record<string, BadgeVariant> = {
  'Super Admin': 'super-admin',
  'Finance Admin': 'finance',
  Compliance: 'compliance',
  'Master Agent': 'agent',
  Agent: 'agent',
}

const categoryFilters = [
  'All',
  'Financial',
  'Operational',
  'Compliance',
  'Agent',
]

export function ReportCatalog() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')

  const filteredReports = useMemo(() => {
    return reportsCatalog.filter((r) => {
      const matchesSearch =
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.category.toLowerCase().includes(search.toLowerCase())
      const matchesCategory =
        activeCategory === 'All' || r.category === activeCategory

      return matchesSearch && matchesCategory
    })
  }, [search, activeCategory])

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Report Catalog"
        showDateFilter={false}
        primaryAction={{
          label: 'New Report',
          onClick: () => {},
          icon: 'ti-plus',
        }}
      />

      <div className="flex-1 space-y-5 overflow-y-auto p-6">
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-bg-secondary p-1">
            {categoryFilters.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${activeCategory === cat ? 'bg-bg-primary text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex w-full items-center gap-2 lg:w-auto">
            <div className="relative w-full lg:w-80">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"></i>
              <input
                type="text"
                placeholder="Search reports..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-sm border border-border bg-bg-primary py-2 pl-10 pr-4 text-sm text-text-primary outline-none transition-colors focus:border-brand-blue"
              />
            </div>
            <button className="flex items-center gap-2 rounded-sm border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary transition-colors hover:bg-bg-secondary">
              <i className="ti ti-filter text-text-secondary"></i>
              <span className="hidden sm:inline">Filters</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-1 text-xs text-text-secondary">
          <span>
            Showing{' '}
            <span className="font-medium text-text-primary">
              {filteredReports.length}
            </span>{' '}
            of{' '}
            <span className="font-medium text-text-primary">
              {reportsCatalog.length}
            </span>{' '}
            reports
          </span>
        </div>

        <Card noPadding className="overflow-hidden">
          <div className="hidden grid-cols-12 gap-4 border-b border-border bg-bg-secondary px-5 py-3 text-micro font-medium uppercase tracking-wider text-text-secondary md:grid">
            <div className="col-span-5">Report</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-2">Frequency</div>
            <div className="col-span-2">Access Role</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          <div className="divide-y divide-border">
            {filteredReports.length === 0 ? (
              <div className="py-16 text-center text-text-secondary">
                <i className="ti ti-file-search mb-2 block text-3xl"></i>
                <p className="text-sm">No reports match your filters</p>
                <button
                  onClick={() => {
                    setSearch('')
                    setActiveCategory('All')
                  }}
                  className="mt-2 text-xs text-brand-blue hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              filteredReports.map((report) => {
                const cfg =
                  categoryConfig[report.category] || categoryConfig.Financial

                return (
                  <div
                    key={report.id}
                    className="group grid cursor-pointer grid-cols-12 items-center gap-4 px-5 py-4 transition-colors hover:bg-bg-tertiary"
                  >
                    <div className="col-span-12 flex min-w-0 items-center gap-3 md:col-span-5">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${cfg.bgClass} ${cfg.textClass}`}
                      >
                        <i className={`ti ${cfg.icon} text-xl`}></i>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-text-primary">
                          {report.title}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-text-secondary">
                          {report.id.toUpperCase()} · {report.format} export
                        </div>
                      </div>
                    </div>

                    <div className="col-span-6 md:col-span-2">
                      <Badge variant={cfg.badgeVariant}>
                        {report.category}
                      </Badge>
                    </div>

                    <div className="col-span-6 flex items-center gap-1.5 text-xs text-text-secondary md:col-span-2">
                      <i className="ti ti-clock"></i>
                      <span>{report.frequency}</span>
                    </div>

                    <div className="col-span-6 md:col-span-2">
                      <Badge variant={roleBadgeMap[report.role]}>
                        {report.role}
                      </Badge>
                    </div>

                    <div className="col-span-6 flex items-center justify-end gap-1 md:col-span-1">
                      <button
                        className="rounded-sm p-1.5 text-text-secondary transition-colors hover:bg-brand-blue/10 hover:text-brand-blue"
                        title="Schedule"
                        aria-label="Schedule report"
                      >
                        <i className="ti ti-calendar text-base"></i>
                      </button>
                      <button
                        className="rounded-sm p-1.5 text-text-secondary transition-colors hover:bg-brand-blue/10 hover:text-brand-blue"
                        title="Run Report"
                        aria-label="Run report"
                      >
                        <i className="ti ti-player-play text-base"></i>
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
