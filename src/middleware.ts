import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

export default auth((req: any) => {
  const isLoggedIn = !!req.auth
  const path = req.nextUrl.pathname
  const isAuthRoute = path.startsWith('/login') || path.startsWith('/register')
  
  // Exclude auth endpoints explicitly, though api endpoints generally don't redirect to /login in an SPA,
  // returning 401 is better, but the prompt says to bypass /api
  const isApiRoute = path.startsWith('/api')
  const isPublic = isAuthRoute

  if (!isLoggedIn && !isPublic && !isApiRoute) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', path)
    return NextResponse.redirect(loginUrl)
  }
  
  if (isLoggedIn && isAuthRoute) {
    return NextResponse.redirect(new URL('/', req.url))
  }
})

export const config = {
  matcher: ['/((?!_next|favicon|fonts|images|icons).*)'],
}
