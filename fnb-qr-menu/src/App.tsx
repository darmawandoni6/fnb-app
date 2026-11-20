import { Button } from '@/components/ui/button'
import { useCustomerSession } from '@/features/session/store'

export default function App() {
  const [session, update] = useCustomerSession()

  function handleAdd() {
    update((prev) => ({
      ...prev,
      cart: [...prev.cart, { menuId: `demo-${prev.cart.length + 1}`, qty: 1, note: '' }],
    }))
  }

  return (
    <main className="bg-canvas font-ui text-text min-h-dvh">
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h1 className="font-editorial text-2xl">QR Menu</h1>
        <p className="text-text-muted">Foundation shell — screens land in Phase 1.</p>
        <p className="text-sm">Cart lines: {session.cart.length}</p>
        <Button onClick={handleAdd}>Tambah baris uji</Button>
      </div>
    </main>
  )
}
