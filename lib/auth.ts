import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Discord from 'next-auth/providers/discord';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './prisma';

/** Retired. Tournament corridor is Steam OpenID (`aegis_session`). HTTP /api/auth/[...nextauth] returns 410. */

type SessionClaims = { role?: string; id?: string; userId?: string };
type TokenClaims = { role?: string; userId?: string; sub?: string };

export const { handlers, auth, signIn, signOut } = NextAuth({
	adapter: PrismaAdapter(prisma),
	providers: [
		Credentials({
			name: 'Credentials',
			credentials: {
				email: { label: 'Email', type: 'text' },
				password: { label: 'Password', type: 'password' }
			},
			authorize: async () => null
		}),
		Discord({
			clientId: process.env.DISCORD_ID || '',
			clientSecret: process.env.DISCORD_SECRET || ''
		})
	],
	callbacks: {
		session: async ({ session, user, token }) => {
			const sessionUser = session.user as typeof session.user & SessionClaims;
			const authUser = user as unknown as SessionClaims | undefined;
			const authToken = token as typeof token & TokenClaims;
			sessionUser.role = authUser?.role || authToken.role || 'USER';
			sessionUser.id = authUser?.id || authToken.sub || sessionUser.id;
			sessionUser.userId = authUser?.userId || authToken.userId;
			return session;
		},
		jwt: async ({ token, user }) => {
			if (user) {
				const authToken = token as typeof token & TokenClaims;
				const authUser = user as unknown as SessionClaims;
				authToken.role = authUser.role;
				authToken.userId = authUser.userId;
			}
			return token;
		}
	},
	pages: {
		signIn: '/api/auth/steam'
	}
});
