// app/api/signer/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "../../../../lib/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const apiKey = process.env.NEYNAR_API_KEY!;
  const { searchParams } = new URL(req.url);
  const signerUuid = searchParams.get("signer");

  if (!apiKey) return NextResponse.json({ ok: false, error: "missing_api_key" }, { status: 500 });
  if (!signerUuid) return NextResponse.json({ ok: false, error: "missing_signer" }, { status: 400 });

  // Check signer status
  const r = await fetch(`https://api.neynar.com/v2/farcaster/signer/${signerUuid}`, {
    headers: { "api_key": apiKey },
  });

  if (!r.ok) {
    const txt = await r.text();
    return NextResponse.json({ ok: false, error: txt || "signer_status_failed" }, { status: 500 });
  }

  const j = await r.json();
  const status = j.status || j.signer?.status;

  if (status !== "approved") {
    return NextResponse.json({ ok: true, status });
  }

  const fid = j.fid || j.signer?.fid;
  if (!fid) return NextResponse.json({ ok: false, error: "approved_but_no_fid" }, { status: 500 });

  // Fetch user profile (optional)
  const u = await fetch(`https://api.neynar.com/v2/farcaster/user?fid=${fid}`, {
    headers: { "api_key": apiKey },
  }).then((x) => x.json()).catch(() => null);

  const user = {
    fid,
    username: u?.user?.username,
    display_name: u?.user?.display_name,
    pfp_url: u?.user?.pfp_url,
  };

  const headers = new Headers();
  setSessionCookie(headers, user);

  return new NextResponse(JSON.stringify({ ok: true, status: "approved", user }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
