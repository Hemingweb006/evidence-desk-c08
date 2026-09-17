import { NextResponse, type NextRequest } from "next/server";

/**
 * Protection optionnelle de la démo exposée via ngrok.
 * Si DEMO_PASSWORD est défini : authentification HTTP Basic (utilisateur « dail »).
 */
export function proxy(req: NextRequest) {
  const password = process.env.DEMO_PASSWORD;
  if (!password) return NextResponse.next();
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const [user, pass] = atob(header.slice(6)).split(":");
    if (user === "dail" && pass === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Evidence Desk"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
