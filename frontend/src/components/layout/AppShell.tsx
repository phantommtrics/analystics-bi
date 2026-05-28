import React, { createContext, useContext, useState } from 'react'
import { InstallPrompt } from '../ui/InstallPrompt'
import { Sidebar } from './Sidebar'

interface AppShellProps {
  children: React.ReactNode
}

const SidebarContext = createContext({
  openSidebar: () => {},
})

export function useSidebar() {
  return useContext(SidebarContext)
}

export function AppShell({ children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <SidebarContext.Provider
      value={{ openSidebar: () => setIsSidebarOpen(true) }}
    >
      <div className="flex min-h-screen bg-bg-tertiary">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="flex min-w-0 flex-1 flex-col md:ml-[220px]">
          {children}
        </main>
        <InstallPrompt />
      </div>
    </SidebarContext.Provider>
  )
}
