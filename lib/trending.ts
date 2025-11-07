// lib/trending.ts
const KEYWORDS_INCLUDE = [
  // launches / features
  "launch","launched","launching","introducing","introduce",
  "now live","rolled out","shipping","release","released","beta",
  "new feature","feature update","v2","v3","public beta","mainnet",
  // token/coin
  "token","coin","tge","ido","listing","airdrop","mint","$",
  // extra signals
  "announcing","announcement","went live","is live","drop","on base","base mainnet","l2","chain"
];

function looksLikeLaunch(text: string): boolean {
  const t = (text || "").toLowerCase();
  return KEYWORDS_INCLUDE.some(k => t.includes(k));
}

function engagementScore(c: any): number {
  const likes = Number(c?.reactions?.likes_count || c?.likes_count || 0);
  const recasts = Number(c?.reactions?.recasts_count || c?.recasts_count || 0);
  const replies = Number(c?.replies?.count || c?.replies_count || 0);
  return likes + recasts + replies;
}

export async function fetchTrendingWithFilter(apiKey: string, opts?: { relaxed?: boolean }) {
  const relaxed = !!opts?.relaxed;
  let cursor: string | undefined;
  const picked: any[] = [];

  // scan up to 8 pages of trending (was 4)
  for (let page = 0; page < 8; page++) {
    const url = new URL("https://api.neynar.com/v2/farcaster/feed/trending");
    url.searchParams.set("limit", "50");
    if (cursor) url.searchParams.set("cursor", cursor);

    const r = await fetch(url.toString(), { headers: { "api_key": apiKey } });
    if (!r.ok) break;

    const data: any = await r.json();
    const casts: any[] = data?.casts || [];

    for (const c of casts) {
      const text = c?.text || c?.cast?.text || "";
      // prefer text-only, but keep image if present
      const embeds = (c?.embeds || c?.attachments || [])
        .map((e: any) => ({
          url: e?.url || e?.uri || "",
          content_type: e?.metadata?.content_type || ""
        }))
        .filter((e: any) => e.url);

      (c as any).__normalized_embeds = embeds;

      // STRICT mode: only keep launch/coin-ish casts
      if (!relaxed) {
        if (!looksLikeLaunch(text)) continue;
      } else {
        // RELAXED mode: allow any non-empty text cast, prefer longer texts
        if (!text || text.trim().length < 12) continue;
      }

      picked.push(c);
    }

    cursor = data?.next?.cursor;
    if (!cursor) break;
  }

  // sort by crude engagement
  picked.sort((a, b) => engagementScore(b) - engagementScore(a));
  return picked;
}
