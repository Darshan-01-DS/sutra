// src/app/api/imagekit/auth/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import ImageKit from 'imagekit'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT

  if (!publicKey || !privateKey || !urlEndpoint) {
    return NextResponse.json({ error: 'ImageKit not configured' }, { status: 500 })
  }

  const ik = new ImageKit({ publicKey, privateKey, urlEndpoint })
  const authParams = ik.getAuthenticationParameters()

  return NextResponse.json({
    ...authParams,
    publicKey,
    urlEndpoint,
  })
}
