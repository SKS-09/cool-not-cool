// app/api/pick/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { istDateStr } from '../../../lib/ist';
import { fetchTrendingWithFilter } from '../../../lib/trending';

export const runtime = 'edge';

function warpcastUrl(username?: string, hash?: string) {
  if (!username || !hash) return 'https://warpcast.com/';
  const short = hash?.startsWith('0x') ? hash.slice(2, 10) : hash?.slice(0, 8);
  return `https://warpcast.com/${username}/${short}`;
}

// Normalize embeds from various shapes
function normalizeEmbeds(c: any) {
  const arr = (c?.embeds || c?.attachments || [])
    .map((e: any) => ({
      url: e?.url || e?.uri || '',
      content_type: e?.metadata?.content_type || e?.content_type || '',
    }))
    .filter((e: any) => !!e.url);
  return arr;
}

async function handle(req: NextRequest) {
  try {
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'missing_api_key' }, { status: 500 });
    }

    const url = req.nextUrl;
    const forceUrl = url.searchParams.get('url');          // optional: full Warpcast URL
    const forceHash = url.searchParams.get('hash');        // optional: 0x... cast hash
    const forceUser = url.searchParams.get('username');    // optional: improves URL
    const forceText = url.searchParams.get('force_text');  // optional: fallback text
    const relaxed = url.searchParams.get('relaxed') === '1';
    const debug = url.searchParams.get('debug') === '1';

    if (debug) {
      return NextResponse.json({
        ok: true,
        saw_force_url: !!forceUrl,
        saw_force_hash: !!forceHash,
        forceHash,
        forceUser,
        hasForceText: !!forceText,
        relaxed,
        hasApiKey: !!apiKey,
      });
    }

    let picked: any | null = null;

    // ---------- FORCE by URL ----------
    if (forceUrl) {
      const r = await fetch(
        `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(forceUrl)}&type=url`,
        { headers: { 'api_key': apiKey } }
      );

      if (!r.ok) {
        const errTxt = await r.text().catch(() => 'force_url_fetch_failed');
        if (!forceText) {
          return NextResponse.json({ ok: false, error: errTxt || 'force_url_fetch_failed' }, { status: 500 });
        }
        // fallback to text-only if provided
        picked = {
          hash: undefined,
          text: forceText,
          author: { fid: undefined, username: forceUser || undefined, display_name: undefined, pfp_url: undefined },
          embeds: [],
          url: forceUrl,
        };
      } else {
        const data: any = await r.json();
        const cast = data?.cast || data;
        const author = cast?.author || cast?.user || cast?.cast?.author || {};
        const username = forceUser || author?.username || author?.username?.username;
        picked = {
          hash: cast?.hash || cast?.cast_hash,
          text: cast?.text || cast?.cast?.text || forceText || '',
          author: {
            fid: author?.fid,
            username,
            display_name: author?.display_name || author?.name,
            pfp_url: author?.pfp_url || author?.pfp_url?.url,
          },
          embeds: normalizeEmbeds(cast),
          url: warpcastUrl(username, cast?.hash || cast?.cast_hash),
        };
      }
    }

    // ---------- FORCE by HASH ----------
    if (!picked && forceHash) {
      const r = await fetch(
        `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(forceHash)}&type=hash`,
        { headers: { 'api_key': apiKey } }
      );

      if (!r.ok) {
        const errTxt = await r.text().catch(() => 'force_fetch_failed');
        if (!forceText) {
          return NextResponse.json({ ok: false, error: errTxt || 'force_fetch_failed' }, { status: 500 });
        }
        // fallback to text-only if provided
        picked = {
          hash: forceHash,
          text: forceText,
          author: { fid: undefined, username: forceUser || undefined, display_name: undefined, pfp_url: undefined },
          embeds: [],
          url: warpcastUrl(forceUser || undefined, forceHash),
        };
      } else {
        const data: any = await r.json();
        const cast = data?.cast || data;
        const author = cast?.author || cast?.user || cast?.cast?.author || {};
        const username = forceUser || author?.username || author?.username?.username;
        picked = {
          hash: cast?.hash || cast?.cast_hash || forceHash,
          text: cast?.text || cast?.cast?.text || forceText || '',
          author: {
            fid: author?.fid,
            username,
            display_name: author?.display_name || author?.name,
            pfp_url: author?.pfp_url || author?.pfp_url?.url,
          },
          embeds: normalizeEmbeds(cast),
          url: warpcastUrl(username, cast?.hash || cast?.cast_hash || forceHash),
        };
      }
    }

    // ---------- AUTO MODE ----------
    if (!picked) {
      const candidates = await fetchTrendingWithFilter(apiKey, { relaxed });
      if (!candidates.length) {
        return NextResponse.json({ ok: false, reason: 'no_match' });
      }

      const top = candidates[0];
      const author = top?.author || top?.user || {};
      const username = author?.username || author?.username?.username;

      picked = {
        hash: top?.hash || top?.cast_hash,
        text: top?.text || top?.cast?.text || '',
        author: {
          fid: author?.fid,
          username,
          display_name: author?.display_name || author?.name,
          pfp_url: author?.pfp_url || author?.pfp_url?.url,
        },
        embeds: normalizeEmbeds(top),
        url: warpcastUrl(username, top?.hash || top?.cast_hash),
      };
    }

    const date = istDateStr();
    await kv.set(`daily:${date}`, picked);
    await kv.hset(`votes:${date}`, { cool: 0, notcool: 0 });

    const mode = forceUrl ? 'force_url'
               : forceHash ? 'force_hash'
               : relaxed ? 'relaxed'
               : 'strict';

    return NextResponse.json({ ok: true, date, picked, mode });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

// Allow GET so you can call ?debug=1 from the browser
export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

