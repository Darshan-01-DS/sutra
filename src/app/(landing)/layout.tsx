// src/app/(landing)/layout.tsx — Standalone layout for the landing page (no sidebar)
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sutra — Your Thinking System',
  description: 'Capture signals, build collections, and let AI surface the connections you\'d otherwise miss.',
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
