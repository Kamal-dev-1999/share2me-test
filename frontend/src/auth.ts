import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getBackendUrl } from "@/lib/backendUrl";

const EXPRESS_BACKEND_URL = getBackendUrl();
const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) {
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.DOCKER_BUILD &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    throw new Error(
      "[FATAL] AUTH_SECRET environment variable is not set. Refusing to start.",
    );
  }
  console.warn(
    "[Auth] WARNING: AUTH_SECRET is not set. Using build/dev placeholder.",
  );
}
const _AUTH_SECRET = AUTH_SECRET || "build_placeholder_secret_min_32_chars_12345";

const SAFE_ROOT_DOMAINS = ["share2me.in", "share2.me"];
const DEV_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

function isSafeHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  if (DEV_HOSTNAMES.has(normalized)) return true;
  return SAFE_ROOT_DOMAINS.some(
    (domain) => normalized === domain || normalized.endsWith(`.${domain}`),
  );
}

function isEmailAdminAuthorized(email?: string | null): boolean {
  if (!email) return false;
  const rawEnv = process.env.AUTHORIZED_ADMIN_EMAILS || "";
  const allowed = rawEnv.trim()
    ? rawEnv
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    : [
        "admin@share2.me",
        "rishabh@share2.me",
        "rishabhdev2026@gmail.com",
        "rishabhyadav5281@gmail.com",
      ];
  return allowed.includes(email.trim().toLowerCase());
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  cookies: {
    sessionToken: {
      name: "__session",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
      },
    },
  },
  secret: _AUTH_SECRET,
  session: { strategy: "jwt" },
  callbacks: {
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      let origin: string;
      try {
        origin = new URL(baseUrl).origin;
      } catch {
        origin = "https://share2me.in";
      }

      // Relative callbacks must stay on the host the visitor actually used.
      // Protocol-relative URLs ("//evil.example") are NOT relative paths.
      if (url.startsWith("/") && !url.startsWith("//")) {
        return `${origin}${url}`;
      }

      try {
        const target = new URL(url);
        if (
          target.origin === origin ||
          (target.protocol === "https:" && isSafeHostname(target.hostname))
        ) {
          return url;
        }
      } catch {
        // Fall through to the safe origin below.
      }

      return origin;
    },
    async jwt({ token, account, profile, trigger, session }: any) {
      const email = profile?.email || token.email;
      token.adminAuthorized = isEmailAdminAuthorized(email);

      // Handle programmatic session updates: update({ planType: 'PRO', name: 'New Name' })
      if (trigger === "update") {
        if (session?.planType) token.planType = session.planType;
        if (session?.name) token.name = session.name;
      }

      const now = Date.now();
      const lastChecked = (token.lastPlanCheck as number) || 0;
      const shouldRefreshPlan =
        now - lastChecked > 30000 || trigger === "update" || !token.planType;

      if (
        (account && profile) ||
        !token.shareCode ||
        !token.id ||
        shouldRefreshPlan
      ) {
        // Contact the Express backend to upsert or fetch the latest vendor record
        try {
          const rawSub = profile?.sub || token.sub;
          const providerId = rawSub
            ? String(rawSub).startsWith("google-oauth2|")
              ? String(rawSub)
              : `google-oauth2|${rawSub}`
            : undefined;
          const name = profile?.name || token.name || "Vendor";

          if (providerId || email) {
            const res = await fetch(
              `${EXPRESS_BACKEND_URL}/g2p/vendor/upsert`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${_AUTH_SECRET}`,
                },
                body: JSON.stringify({
                  name,
                  email: email,
                  providerId: providerId || `google-oauth2|${email}`,
                }),
              },
            );

            if (res.ok) {
              const vendorData = await res.json();
              token.id = vendorData.id;
              token.shareCode = vendorData.share2me_id;
              token.planType = vendorData.plan_type || "FREE";
              token.vendorSetupCompleted = !!vendorData.vendor_setup_completed;
              token.printAgentToken = vendorData.print_agent_token;
              if (vendorData.name) {
                token.name = vendorData.name;
              }
              token.lastPlanCheck = now;
            } else {
              console.error(
                "[NextAuth] Failed to upsert vendor:",
                await res.text(),
              );
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
        session.user.planType = token.planType || "FREE";
        session.user.vendorSetupCompleted = !!token.vendorSetupCompleted;
        session.user.adminAuthorized = !!token.adminAuthorized;
        session.user.print_agent_token = token.printAgentToken;
        if (token.name) {
          session.user.name = token.name as string;
        }
      }
      return session;
    },
  },
});
