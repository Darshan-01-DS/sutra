// src/app/page.tsx — Root redirect: landing for guests, dashboard for signed-in users
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import LandingPage from './(landing)/page'

export default async function RootPage() {
  const session = await auth()
  if (session?.user?.id) redirect('/dashboard')
  return <LandingPage />
}
