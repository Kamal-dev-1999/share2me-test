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
      if ((account && profile) || !token.shareCode || !token.id) {
        // Contact the Express backend to upsert or fetch the vendor
        try {
          const providerSub = profile?.sub || token.sub;
          const name = profile?.name || token.name || "Vendor";
          if (providerSub) {
            const res = await fetch(`${EXPRESS_BACKEND_URL}/g2p/vendor/upsert`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${AUTH_SECRET}`,
              },
              body: JSON.stringify({
                name,
                providerId: `google-oauth2|${providerSub}`,
              }),
            });
            
            if (res.ok) {
              const vendorData = await res.json();
              token.id = vendorData.id;
              token.shareCode = vendorData.share2me_id;
            } else {
              console.error("[NextAuth] Failed to upsert vendor:", await res.text());
            }
          }
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
