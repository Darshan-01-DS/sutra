import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  providers: [], // Overridden in auth.ts
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id
      }
      return token
    },
  },
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
} satisfies NextAuthConfig
