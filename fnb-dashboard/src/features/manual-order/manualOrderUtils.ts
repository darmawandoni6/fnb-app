export function getMenuInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

const PASTEL_COLORS = [
  'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-amber-300',
  'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 border-blue-300',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-300',
  'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200 border-purple-300',
  'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border-rose-300',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200 border-cyan-300',
  'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200 border-orange-300',
]

export function getMenuColorClass(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % PASTEL_COLORS.length
  return PASTEL_COLORS[index]
}
