import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const EXPRESS_BACKEND_URL = process.env.NEXT_PUBLIC_EXPRESS_URL || "http://localhost:3000";
const AUTH_SECRET = process.env.AUTH_SECRET || "placeholder_jwt_secret";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  secret: AUTH_SECRET,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        // Initial sign in - Contact the Express backend to upsert the vendor
        try {
          const res = await fetch(`${EXPRESS_BACKEND_URL}/g2p/vendor/upsert`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${AUTH_SECRET}`,
            },
            body: JSON.stringify({
              name: profile.name,
              providerId: `google-oauth2|${profile.sub}`,
            }),
          });
          
          if (!res.ok) {
            console.error("[NextAuth] Failed to upsert vendor:", await res.text());
            return token;
          }

          const vendorData = await res.json();
          token.id = vendorData.id; // Emulate jose expectation
          token.shareCode = vendorData.share2me_id;
        } catch (e) {
          console.error("[NextAuth] Error upserting vendor:", e);
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id;
        session.user.shareCode = token.shareCode;
      }
      return session;
    },
  },
});
