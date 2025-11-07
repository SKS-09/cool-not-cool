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

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false, error: 'missing_api_key' }, { status: 500 });

    const relaxed = req.nextUrl.searchParams.get('relaxed') === '1';

    const candidates = await fetchTrendingWithFilter(apiKey, { relaxed });
    if (!candidates.length) {
      return NextResponse.json({ ok: false, reason: 'no_match' });
    }

    const top = candidates[0];
    const author = top?.author || top?.user || {};
    const username = author?.username || author?.username?.username;

    const obj = {
      hash: top?.hash || top?.cast_hash,
      text: top?.text || top?.cast?.text || '',
      author: {
        fid: author?.fid,
        username,
        display_name: author?.display_name || author?.name,
        pfp_url: author?.pfp_url || author?.pfp_url?.url
      },
      embeds: (top.__normalized_embeds || []).filter((e: any) => !!e.url),
      url: warpcastUrl(username, top?.hash || top?.cast_hash)
    };

    const date = istDateStr();
    await kv.set(`daily:${date}`, obj);
    await kv.hset(`votes:${date}`, { cool: 0, notcool: 0 });

    return NextResponse.json({ ok: true, date, picked: obj, relaxed });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
