import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBackendUrl } from "@/lib/backendUrl";

const BACKEND_URL = getBackendUrl();
const AUTH_SECRET = process.env.AUTH_SECRET || "placeholder_jwt_secret_local_dev_only";

function isAuthorizedAdmin(email?: string | null): boolean {
  if (!email) return false;
  const rawEnv = process.env.AUTHORIZED_ADMIN_EMAILS || "";
  const allowed = rawEnv.trim()
    ? rawEnv.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
    : ["admin@share2.me", "rishabh@share2.me", "rishabhdev2026@gmail.com", "rishabhyadav5281@gmail.com"];
  return allowed.includes(email.trim().toLowerCase());
}

async function handleRootAdminProxy(request: NextRequest) {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail || !isAuthorizedAdmin(userEmail)) {
    return NextResponse.json(
      { error: "Unauthorized: Admin session required.", code: "UNAUTHORIZED_ADMIN" },
      { status: 401 }
    );
  }

  const targetUrl = new URL(`${BACKEND_URL}/api/admin`);
  request.nextUrl.searchParams.forEach((val, key) => {
    targetUrl.searchParams.set(key, val);
  });

  const headers: Record<string, string> = {
    "X-Admin-Secret": AUTH_SECRET,
    "X-Admin-Email": userEmail,
    "Accept": "application/json",
  };

  try {
    const res = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      cache: "no-store",
    });

    const data = await res.arrayBuffer();
    return new NextResponse(data, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (err: any) {
    console.error("[Next.js Root Admin Proxy Error]:", err.message);
    return NextResponse.json(
      { error: "Backend admin service unreachable." },
      { status: 502 }
    );
  }
}

export const GET = handleRootAdminProxy;
export const POST = handleRootAdminProxy;
