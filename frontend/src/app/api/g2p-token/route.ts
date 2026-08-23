import { auth } from "@/auth";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use the same secret shared with the Express backend
  const secret = process.env.AUTH_SECRET || "placeholder_jwt_secret";
  const secretKey = new TextEncoder().encode(secret);

  try {
    const token = await new SignJWT({ 
      id: (session.user as any).id,
      shareCode: (session.user as any).shareCode,
      email: session.user.email
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('12h') // 12-hour session for the dashboard
      .sign(secretKey);

    const response = NextResponse.json({ token });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (error) {
    console.error("[Token API] Token generation failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
