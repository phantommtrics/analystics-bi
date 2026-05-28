import { TopBar } from '../components/layout/TopBar'

export function DashboardBuilder() {
  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Dashboard Builder"
        primaryAction={{
          label: 'Save Layout',
          onClick: () => {},
          icon: 'ti-device-floppy',
        }}
      />

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="hidden w-full overflow-y-auto border-r border-border bg-bg-primary p-4 lg:block lg:w-64">
          <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-text-secondary">
            Available Widgets
          </h3>

          <div className="space-y-3">
            {[
              'KPI Card',
              'Bar Chart',
              'Line Chart',
              'Pie Chart',
              'Data Table',
              'Live Float',
            ].map((widget) => (
              <div
                key={widget}
                className="flex cursor-grab items-center gap-3 rounded-md border border-border bg-bg-secondary p-3 transition-colors hover:border-brand-blue"
              >
                <i className="ti ti-grip-vertical text-text-secondary"></i>
                <span className="text-sm font-medium">{widget}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-bg-tertiary p-6">
          <div className="mx-auto max-w-5xl space-y-4">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-medium">Main Dashboard Layout</h2>
              <button className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary">
                <i className="ti ti-settings"></i> Dashboard Settings
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="col-span-4 flex h-24 items-center justify-center rounded-md border-2 border-dashed border-border bg-bg-primary text-text-secondary sm:col-span-2 lg:col-span-1"
                >
                  KPI Slot
                </div>
              ))}

              <div className="group relative col-span-4 flex h-64 items-center justify-center rounded-md border-2 border-dashed border-border bg-bg-primary text-text-secondary lg:col-span-2">
                Chart Slot
                <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                  <button className="rounded bg-bg-secondary p-1 hover:text-brand-blue">
                    <i className="ti ti-pencil"></i>
                  </button>
                  <button className="rounded bg-bg-secondary p-1 hover:text-semantic-red">
                    <i className="ti ti-trash"></i>
                  </button>
                </div>
              </div>
              <div className="col-span-4 flex h-64 items-center justify-center rounded-md border-2 border-dashed border-border bg-bg-primary text-text-secondary lg:col-span-2">
                Chart Slot
              </div>

              <div className="col-span-4 flex h-80 items-center justify-center rounded-md border-2 border-dashed border-border bg-bg-primary text-text-secondary">
                Table Slot
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
