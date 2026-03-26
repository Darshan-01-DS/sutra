'use client'
// src/app/dashboard/page.tsx — Full app experience

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'

export default function DashboardPage() {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  if (status === 'loading' || status === 'unauthenticated') return null

  return <AppShell />
}
