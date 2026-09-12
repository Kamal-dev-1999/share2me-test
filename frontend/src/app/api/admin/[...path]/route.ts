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

async function handleAdminProxy(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail || !isAuthorizedAdmin(userEmail)) {
    return NextResponse.json(
      { error: "Unauthorized: Admin session required.", code: "UNAUTHORIZED_ADMIN" },
      { status: 401 }
    );
  }

  const resolvedParams = await params;
  const subPath = resolvedParams.path ? resolvedParams.path.join("/") : "";
  const targetUrl = new URL(`${BACKEND_URL}/api/admin/${subPath}`);
  
  // Forward search params
  request.nextUrl.searchParams.forEach((val, key) => {
    targetUrl.searchParams.set(key, val);
  });

  const headers: Record<string, string> = {
    "X-Admin-Secret": AUTH_SECRET,
    "X-Admin-Email": userEmail,
    "Accept": "application/json",
  };

  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  let body: BodyInit | null = null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    if (contentType?.includes("application/json")) {
      body = JSON.stringify(await request.json().catch(() => ({})));
    } else {
      body = await request.arrayBuffer();
    }
  }

  try {
    const res = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      body,
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
    console.error("[Next.js Admin Proxy Error]:", err.message);
    return NextResponse.json(
      { error: "Backend admin service unreachable." },
      { status: 502 }
    );
  }
}

export const GET = handleAdminProxy;
export const POST = handleAdminProxy;
export const PUT = handleAdminProxy;
export const DELETE = handleAdminProxy;
export const PATCH = handleAdminProxy;
