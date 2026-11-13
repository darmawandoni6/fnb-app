import { useState } from 'react'

import { useNavigate } from 'react-router-dom'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { ROUTES } from '@/constants/routes'

import { useAuth } from '@/auth/context'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type LoginValues, loginSchema } from '@/features/auth/loginSchema'

const demoAccounts = [
  { email: 'owner@demo.cafe', label: 'Login Owner' },
  { email: 'kasir@demo.cafe', label: 'Login Kasir' },
  { email: 'dapur@demo.cafe', label: 'Login Dapur' },
]

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const [submitting, setSubmitting] = useState(false)

  const signIn = async (email: string, password: string) => {
    setSubmitting(true)
    try {
      await login(email, password)
      toast.success('Login berhasil')
      navigate(ROUTES.DASHBOARD, { replace: true })
    } catch (error) {
      toast.error((error as { message?: string }).message ?? 'Login gagal')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-background flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>FNB Dashboard</CardTitle>
          <CardDescription>Masuk untuk melanjutkan</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit((values) => signIn(values.email, values.password))}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-destructive text-sm">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...form.register('password')} />
              {form.formState.errors.password && (
                <p className="text-destructive text-sm">{form.formState.errors.password.message}</p>
              )}
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Memproses…' : 'Masuk'}
            </Button>
          </form>
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm">
              Mode mock — pilih role demo (password: demo)
            </p>
            {demoAccounts.map((account) => (
              <Button
                key={account.email}
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => {
                  form.setValue('email', account.email)
                  form.setValue('password', 'demo')
                  void signIn(account.email, 'demo')
                }}
              >
                {account.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
