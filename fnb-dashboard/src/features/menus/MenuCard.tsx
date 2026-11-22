import { useState } from 'react'

import { useMutation } from '@tanstack/react-query'

import { api } from '@/api'
import type { Menu } from '@/types'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'

import { toastApiError } from '@/lib/errors'
import { formatRupiah } from '@/lib/format'
import { getMenuColorClass, getMenuInitials } from '@/lib/menu'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

import { MenuFormDialog } from './MenuFormDialog'
import { RecipeDialog } from './RecipeDialog'

export function MenuCard({
  menu,
  categoryId,
  canEdit,
  onChanged,
}: {
  menu: Menu
  categoryId: string
  canEdit: boolean
  onChanged: () => void
}) {
  const [editOpen, setEditOpen] = useState(false)

  const toggle = useMutation({
    mutationFn: () => api.updateMenu(menu.id, { is_available: !menu.is_available }),
    onSuccess: () => {
      toast.success(`Menu ${menu.name} ditandai ${menu.is_available ? 'habis' : 'tersedia'}`)
      onChanged()
    },
    onError: toastApiError,
  })

  const availableId = `menu-available-${menu.id}`

  return (
    <Card className="group flex flex-col overflow-hidden p-0 transition-all">
      {menu.image_url ? (
        <img
          src={menu.image_url}
          alt={menu.name}
          className={`h-28 w-full object-cover ${menu.is_available ? '' : 'opacity-60 grayscale'}`}
        />
      ) : (
        <div
          className={`flex h-28 w-full items-center justify-center text-2xl font-black tracking-wider ${
            menu.is_available ? '' : 'opacity-60 grayscale'
          } ${getMenuColorClass(menu.name)}`}
        >
          {getMenuInitials(menu.name)}
        </div>
      )}

      <CardContent className="flex flex-1 flex-col justify-between gap-2 p-3">
        <p className="text-foreground line-clamp-2 text-sm leading-tight font-semibold">
          {menu.name}
        </p>
        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
          {formatRupiah(menu.price)}
        </span>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2 border-t px-3 py-2">
        <div className="flex items-center gap-2">
          <Switch
            id={availableId}
            checked={menu.is_available}
            disabled={toggle.isPending}
            onCheckedChange={() => toggle.mutate()}
          />
          <Label htmlFor={availableId} className="text-muted-foreground cursor-pointer text-xs">
            {menu.is_available ? 'Tersedia' : 'Habis'}
          </Label>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            <RecipeDialog menu={menu} />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-7 gap-1 px-2 text-xs"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
        )}
      </CardFooter>

      <MenuFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={menu}
        categoryId={categoryId}
        onSaved={onChanged}
      />
    </Card>
  )
}
