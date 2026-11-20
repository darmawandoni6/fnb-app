import { Search, X } from 'lucide-react'

import { Input } from '@/components/ui/input'

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  onClear: () => void
}

export function SearchField({ value, onChange, onClear }: SearchFieldProps) {
  return (
    <div className="relative flex items-center">
      <Search className="text-text-muted pointer-events-none absolute left-3 size-4 shrink-0" />
      <Input
        type="search"
        placeholder="Cari menu favorit..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-full pr-9 pl-9"
      />
      {value.trim() !== '' && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Hapus pencarian"
          className="text-text-muted hover:text-text absolute right-3 flex size-5 items-center justify-center rounded-full transition-colors"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
