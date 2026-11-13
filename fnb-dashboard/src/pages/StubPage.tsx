import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

export function StubPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">{title}</h1>
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">🚧</EmptyMedia>
          <EmptyTitle>Coming soon</EmptyTitle>
          <EmptyDescription>Fitur ini akan hadir di fase berikutnya.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}
