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
  email:    z.string().email().max(255),
  password: z.string().min(8).max(128),
})

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

        const user = await UserModel.findOne({ email }).select('+password +loginAttempts +lockUntil').lean()
        if (!user) { await new Promise(r => setTimeout(r, 300)); return null }

        if (user.lockUntil && user.lockUntil > new Date()) return null

        const valid = user.password && await bcrypt.compare(password, user.password)

        if (!valid) {
          const attempts = (user.loginAttempts || 0) + 1
          const update: any = { loginAttempts: attempts }
          if (attempts >= 5) update.lockUntil = new Date(Date.now() + 15 * 60 * 1000)
          await UserModel.updateOne({ email }, update)
          return null
        }

        await UserModel.updateOne({ email }, { loginAttempts: 0, lockUntil: null, lastActiveAt: new Date() })

        // Return MongoDB _id as id so JWT picks it up
        return { id: String(user._id), name: user.name, email: user.email, image: user.image }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // On initial sign-in, user object is present
      if (user) {
        // For credentials: user.id is already the MongoDB _id
        // For OAuth: we need to look up or create the MongoDB user
        if (account && account.provider !== 'credentials') {
          await connectDB()
          let dbUserId: string
          const foundUser = await UserModel.findOne({ email: user.email }).lean()
          if (!foundUser) {
            const created = await UserModel.create({
              name:         user.name || user.email!.split('@')[0],
              email:        user.email,
              image:        user.image,
              provider:     account.provider as any,
              emailVerified: new Date(),
            })
            dbUserId = String(created._id)
          } else {
            await UserModel.updateOne({ _id: foundUser._id }, { lastActiveAt: new Date() })
            dbUserId = String(foundUser._id)
          }
          token.userId = dbUserId
          token.hasSeenOnboarding = (foundUser as any)?.hasSeenOnboarding ?? false
        } else {
          // Credentials provider — user.id is MongoDB _id
          token.userId = user.id
          const credUser = await UserModel.findById(user.id).lean()
          token.hasSeenOnboarding = (credUser as any)?.hasSeenOnboarding ?? false
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string
        ;(session as any).hasSeenOnboarding = token.hasSeenOnboarding ?? false
        // Always read fresh name/image from DB so profile changes are immediate
        try {
          await connectDB()
          const dbUser = await UserModel.findById(token.userId).select('name image').lean() as any
          if (dbUser) {
            session.user.name  = dbUser.name  ?? session.user.name
            session.user.image = dbUser.image ?? session.user.image
          }
        } catch {}
      }
      return session
    },
  },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
})
