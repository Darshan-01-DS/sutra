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

        // Check account lock
        const user = await UserModel.findOne({ email }).select('+password +loginAttempts +lockUntil').lean()
        if (!user) { await new Promise(r => setTimeout(r, 300)); return null } // timing attack prevention

        if (user.lockUntil && user.lockUntil > new Date()) return null // account locked

        const valid = user.password && await bcrypt.compare(password, user.password)

        if (!valid) {
          const attempts = (user.loginAttempts || 0) + 1
          const update: any = { loginAttempts: attempts }
          if (attempts >= 5) update.lockUntil = new Date(Date.now() + 15 * 60 * 1000) // 15 min lock
          await UserModel.updateOne({ email }, update)
          return null
        }

        // Reset on successful login
        await UserModel.updateOne({ email }, { loginAttempts: 0, lockUntil: null, lastActiveAt: new Date() })

        return { id: String(user._id), name: user.name, email: user.email, image: user.image }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider !== 'credentials') {
        await connectDB()
        const existing = await UserModel.findOne({ email: user.email })
        if (!existing) {
          await UserModel.create({
            name:     user.name || user.email!.split('@')[0],
            email:    user.email,
            image:    user.image,
            provider: account?.provider,
            emailVerified: new Date(),
          })
        }
      }
      return true
    },
  },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
})
