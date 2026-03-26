import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  providers: [], // Overridden in auth.ts
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string
      }
      return session
    },
    async jwt({ token, user }) {
      // Only runs on initial sign-in for credentials provider
      if (user?.id) {
        token.userId = user.id
      }
      return token
    },
  },
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
} satisfies NextAuthConfig
