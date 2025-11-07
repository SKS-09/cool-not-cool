'use client';

import './globals.css';
import { useEffect, useState } from 'react';

type Cast = {
  text: string;
  author?: { username?: string; display_name?: string; pfp_url?: string };
  embeds?: { url: string; content_type?: string }[];
  url?: string;
};

type Status =
  | { ok: false; reason: string }
  | {
      ok: true;
      phase: 'voting' | 'reveal';
      date: string;
      cast: Cast;
      totals?: { cool: number; notcool: number; total: number };
      percent?: { cool: number; notcool: number };
    };

export default function Page() {
  const [s, setS] = useState<Status | null>(null);
  const [voted, setVoted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    fetch('/api/status').then((r) => r.json()).then(setS as any);
    fetch('/api/me').then((r) => r.json()).then((j) => setUser(j.user || null));
  }, []);

  async function vote(choice: 'cool' | 'notcool') {
    const r = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choice }),
    });
    const j = await r.json();
    if (j.ok) {
      setVoted(true);
    } else if (j.error === 'signin_required') {
      alert('Please sign in first.');
    } else if (j.error === 'already_voted') {
      alert('You already voted today.');
      setVoted(true);
    } else {
      alert('Vote failed.');
    }
  }

  async function startSignerLogin() {
    try {
      setSigning(true);
      const r = await fetch('/api/signer/create', { method: 'POST' });
      const j = await r.json();
      if (!j.ok) {
        setSigning(false);
        return alert('Failed to start login.');
      }

      // Open Warpcast to approve signer
      if (j.deeplink) window.open(j.deeplink, '_blank');

      // Poll signer status up to ~20s
      const until = Date.now() + 20_000;
      let approved = false;
      while (Date.now() < until) {
        await new Promise((res) => setTimeout(res, 2000));
        const sres = await fetch(`/api/signer/status?signer=${encodeURIComponent(j.signerUuid)}`);
        const sj = await sres.json();
        if (sj?.ok && sj.status === 'approved') {
          approved = true;
          break;
        }
      }

      setSigning(false);
      if (!approved) {
        return alert('Not approved yet in Warpcast. Approve and try again.');
      }

      // refresh user after approval
      const u = await fetch('/api/me').then((r) => r.json());
      setUser(u.user || null);
    } catch {
      setSigning(false);
      alert('Login failed.');
    }
  }

  function shareVote(v: 'cool' | 'notcool') {
    if (!s || !s.ok) return;
    const msg = v === 'cool' ? "I voted *Cool* on today's launch." : "I voted *Not Cool* on today's launch.";
    const url = s.cast.url || '';
    const pre = encodeURIComponent(`${msg} What do you think? #CoolNotCool ${url}`);
    const compose = `https://warpcast.com/~/compose?text=${pre}`;
    window.open(compose, '_blank');
  }

  if (!s) return <div className="container">Loading…</div>;
  if (!s.ok) return <div className="container">Come back later.</div>;

  const a = s.cast.author || {};
  const name = a.display_name || a.username || 'user';

  const hasImage =
    Array.isArray(s.cast.embeds) &&
    s.cast.embeds.some(
      (e) =>
        /\.(png|jpe?g|gif|webp|svg)$/i.test(e.url) || (e.content_type || '').startsWith('image/')
    );
  const firstImage = hasImage
    ? (s.cast.embeds || []).find(
        (e) =>
          /\.(png|jpe?g|gif|webp|svg)$/i.test(e.url) || (e.content_type || '').startsWith('image/')
      )
    : null;

  return (
    <div className="container">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <div className="pill">{s.phase === 'voting' ? 'Voting open (IST)' : 'Results'}</div>
        <div>
          {user ? (
            <span className="muted" style={{ marginRight: 8 }}>
              @{user.username}
            </span>
          ) : (
            <button className="footerLink" onClick={startSignerLogin} disabled={signing}>
              {signing ? 'Opening Warpcast…' : 'Sign in'}
            </button>
          )}
          <img className="logo" src="/icon.svg" alt="CN" style={{ marginLeft: 8 }} />
        </div>
      </div>

      <div className="card">
        <div className="header">
          {a.pfp_url && <img src={a.pfp_url} alt="pfp" />}
          <div>
            <div className="author">{name}</div>
            {a.username && <div className="handle">@{a.username}</div>}
          </div>
        </div>

        <div className="text">{s.cast.text}</div>

        {hasImage && firstImage && (
          <div className="embedWrap" style={{ aspectRatio: '1/1', marginTop: 6 }}>
            <img src={firstImage.url} alt="embed" />
          </div>
        )}

        {s.phase === 'voting' ? (
          <div className="actions" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <button className="btn" disabled={voted} onClick={() => vote('cool')}>
              😎 Cool
            </button>
            <button className="btn" disabled={voted} onClick={() => vote('notcool')}>
              🙅‍♂️ Not Cool
            </button>
            {voted && <button className="btn" onClick={() => shareVote('cool')}>↗️ Share</button>}
          </div>
        ) : (
          <div className="result">
            <div className="big">{s.percent?.cool ?? 0}% Cool</div>
            <div className="muted">
              {s.totals?.cool ?? 0} 👍 • {s.totals?.notcool ?? 0} 👎
            </div>
            <div style={{ marginTop: 10 }}>
              <button className="btn" onClick={() => shareVote('cool')}>
                ↗️ Share result
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
          <div className="muted">
            {s.phase === 'voting' ? 'Vote today • Results tomorrow (IST)' : 'New post picks at 00:00 IST'}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {s.cast.url && (
              <a className="footerLink" href={s.cast.url} target="_blank" rel="noreferrer">
                view post
              </a>
            )}
            <a className="footerLink" href="/public">
              last 7 days
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
