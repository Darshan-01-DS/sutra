import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import Google from 'next-auth/providers/google'
import GitHub from 'next-auth/providers/github'
import Credentials from 'next-auth/providers/credentials'
import { connectDB } from '@/lib/mongodb'
import UserModel from '@/lib/models/User'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
})

async function findUserByEmail(email?: string | null) {
  if (!email) return null
  await connectDB()
  return UserModel.findOne({ email }).select('name email image hasSeenOnboarding').lean() as Promise<{
    _id: unknown
    name?: string | null
    email?: string | null
    image?: string | null
    hasSeenOnboarding?: boolean
  } | null>
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })] : []),
    ...(process.env.GITHUB_CLIENT_ID ? [GitHub({ clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET! })] : []),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw)
        if (!parsed.success) return null

        await connectDB()
        const { email, password } = parsed.data

        const user = await UserModel.findOne({ email }).select('+password +loginAttempts +lockUntil').lean() as {
          _id: unknown
          name?: string | null
          email?: string | null
          image?: string | null
          password?: string | null
          loginAttempts?: number
          lockUntil?: Date | null
        } | null

        if (!user) { await new Promise((resolve) => setTimeout(resolve, 300)); return null }
        if (user.lockUntil && user.lockUntil > new Date()) return null

        const valid = user.password ? await bcrypt.compare(password, user.password) : false
        if (!valid) {
          const attempts = (user.loginAttempts || 0) + 1
          const update: { loginAttempts: number; lockUntil?: Date } = { loginAttempts: attempts }
          if (attempts >= 5) update.lockUntil = new Date(Date.now() + 15 * 60 * 1000)
          await UserModel.updateOne({ email }, update)
          return null
        }

        await UserModel.updateOne({ email }, { loginAttempts: 0, lockUntil: null, lastActiveAt: new Date() })
        return { id: String(user._id), name: user.name, email: user.email, image: user.image }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        if (account && account.provider !== 'credentials') {
          await connectDB()
          const foundUser = await UserModel.findOne({ email: user.email }).lean() as { _id: unknown; hasSeenOnboarding?: boolean } | null
          if (!foundUser) {
            const created = await UserModel.create({
              name: user.name || user.email!.split('@')[0],
              email: user.email,
              image: user.image,
              provider: account.provider,
              emailVerified: new Date(),
            })
            token.userId = String(created._id)
            token.hasSeenOnboarding = false
          } else {
            await UserModel.updateOne({ _id: foundUser._id }, { lastActiveAt: new Date(), image: user.image ?? undefined, name: user.name ?? undefined })
            token.userId = String(foundUser._id)
            token.hasSeenOnboarding = foundUser.hasSeenOnboarding ?? false
          }
        } else {
          token.userId = user.id
          const credUser = await UserModel.findById(user.id).select('hasSeenOnboarding').lean() as { hasSeenOnboarding?: boolean } | null
          token.hasSeenOnboarding = credUser?.hasSeenOnboarding ?? false
        }
      }

      if (!token.userId && token.email) {
        const dbUser = await findUserByEmail(token.email)
        if (dbUser) {
          token.userId = String(dbUser._id)
          token.hasSeenOnboarding = dbUser.hasSeenOnboarding ?? false
        }
      }

      return token
    },
    async session({ session, token }) {
      if (!session.user) return session

      let resolvedUserId = typeof token.userId === 'string' ? token.userId : undefined
      let dbUser: Awaited<ReturnType<typeof findUserByEmail>> = null

      if (!resolvedUserId && session.user.email) {
        dbUser = await findUserByEmail(session.user.email)
        resolvedUserId = dbUser ? String(dbUser._id) : undefined
      }

      if (resolvedUserId) {
        session.user.id = resolvedUserId
      }

      ;(session as { hasSeenOnboarding?: boolean }).hasSeenOnboarding = (typeof token.hasSeenOnboarding === 'boolean' ? token.hasSeenOnboarding : dbUser?.hasSeenOnboarding) ?? false

      try {
        await connectDB()
        const freshUser = resolvedUserId
          ? await UserModel.findById(resolvedUserId).select('name image').lean() as { name?: string | null; image?: string | null } | null
          : dbUser

        if (freshUser) {
          session.user.name = freshUser.name ?? session.user.name
          session.user.image = freshUser.image ?? session.user.image
        }
      } catch {}

      return session
    },
  },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
})
