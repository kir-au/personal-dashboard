import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

const googleClientId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;

export const isAuthConfigured = Boolean(process.env.AUTH_SECRET && googleClientId && googleClientSecret);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: isAuthConfigured
    ? [
        Google({
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        }),
      ]
    : [],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  trustHost: true,
});
