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

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'missing_api_key' }, { status: 500 });
    }

    const url = req.nextUrl;
    const forceHash = url.searchParams.get('hash');       // 0x... cast hash
    const forceUser = url.searchParams.get('username');   // optional, improves URL
    const forceText = url.searchParams.get('force_text'); // optional fallback text
    const relaxed = url.searchParams.get('relaxed') === '1';

    let picked: any | null = null;

    // ---------- FORCE MODE ----------
    if (forceHash) {
      // Try Neynar "cast by hash" endpoint first
      // (supports shapes like: { cast: {...} } or direct {...})
      const r = await fetch(
        `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(forceHash)}&type=hash`,
        { headers: { 'api_key': apiKey } }
      );

      if (r.ok) {
        const data: any = await r.json();
        const cast = data?.cast || data;
        const text = cast?.text || cast?.cast?.text || '';
        const author = cast?.author || cast?.user || cast?.cast?.author || {};
        const username = forceUser || author?.username || author?.username?.username;

        picked = {
          hash: cast?.hash || cast?.cast_hash || forceHash,
          text: text || forceText || '',
          author: {
            fid: author?.fid,
            username,
            display_name: author?.display_name || author?.name,
            pfp_url: author?.pfp_url || author?.pfp_url?.url,
          },
          embeds: normalizeEmbeds(cast),
          url: warpcastUrl(username, cast?.hash || cast?.cast_hash || forceHash),
        };
      } else {
        // Fallback: minimal object if API call fails but user provided text
        if (forceText) {
          picked = {
            hash: forceHash,
            text: forceText,
            author: { fid: undefined, username: forceUser || undefined, display_name: undefined, pfp_url: undefined },
            embeds: [],
            url: warpcastUrl(forceUser || undefined, forceHash),
          };
        } else {
          const errTxt = await r.text().catch(() => 'force_fetch_failed');
          return NextResponse.json({ ok: false, error: errTxt || 'force_fetch_failed' }, { status: 500 });
        }
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

    const mode = forceHash ? 'force' : (relaxed ? 'relaxed' : 'strict');
    return NextResponse.json({ ok: true, date, picked, mode });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

  }
}
