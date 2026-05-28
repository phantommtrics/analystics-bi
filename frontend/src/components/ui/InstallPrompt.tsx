import { usePwaInstallPrompt } from '../../lib/usePwaInstallPrompt'

export function InstallPrompt() {
  const { canInstall, promptInstall } = usePwaInstallPrompt()

  if (!canInstall) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-md border border-border bg-bg-primary p-4 shadow-xl">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-brand-navy text-white">
          <i className="ti ti-device-mobile-down text-xl"></i>
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-text-primary">
            Install APS Wallet BI
          </h2>
          <p className="mt-1 text-xs text-text-secondary">
            Add the reports app to your device for a faster standalone
            experience.
          </p>
          <button
            onClick={promptInstall}
            className="mt-3 rounded-sm bg-brand-navy px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-navy/90"
          >
            Install App
          </button>
        </div>
      </div>
    </div>
  )
}
