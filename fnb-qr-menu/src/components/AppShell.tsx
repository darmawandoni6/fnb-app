import type { ReactNode } from 'react'

interface AppShellProps {
  cafeName?: string
  leading?: ReactNode
  trailing?: ReactNode
  children: ReactNode
}

export function AppShell({ cafeName, leading, trailing, children }: AppShellProps) {
  return (
    <div className="bg-canvas font-ui text-text min-h-dvh">
      <header className="bg-canvas/90 border-border sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-4">
          {leading}
          <span className="font-editorial text-text truncate text-lg font-semibold tracking-tight">
            {cafeName || 'QR Menu'}
          </span>
          {trailing && <div className="ml-auto shrink-0">{trailing}</div>}
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-4">{children}</main>
    </div>
  )
}
