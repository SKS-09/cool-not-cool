// app/api/signer/create/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const apiKey = process.env.NEYNAR_API_KEY!;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "missing_api_key" }, { status: 500 });
  }

  const r = await fetch("https://api.neynar.com/v2/farcaster/signer", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api_key": apiKey },
    body: JSON.stringify({ name: "cool-not-cool" }),
  });

  if (!r.ok) {
    const txt = await r.text();
    return NextResponse.json({ ok: false, error: txt || "signer_create_failed" }, { status: 500 });
  }

  const j = await r.json();
  const signerUuid = j.signer_uuid || j.signer?.uuid || j.uuid;
  const deeplink = j.deep_link_url || j.signer?.deeplink_url || j.deeplink_url;

  return NextResponse.json({ ok: true, signerUuid, deeplink });
}
