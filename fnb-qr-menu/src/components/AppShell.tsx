import type { ReactNode } from 'react'

interface AppShellProps {
  cafeName?: string
  children: ReactNode
}

export function AppShell({ cafeName, children }: AppShellProps) {
  return (
    <div className="bg-canvas font-ui text-text min-h-dvh">
      <header className="bg-canvas/90 border-border sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-xl items-center px-4">
          <span className="font-editorial text-text text-lg font-semibold tracking-tight">
            {cafeName || 'QR Menu'}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-4">{children}</main>
    </div>
  )
}
