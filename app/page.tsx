'use client'; import './globals.css'; import { useEffect, useState } from 'react';
type Cast={text:string;author?:{username?:string;display_name?:string;pfp_url?:string};embeds?:{url:string;content_type?:string}[];url?:string};
type Status={ok:false;reason:string}|{ok:true;phase:'voting'|'reveal';date:string;cast:Cast;totals?:{cool:number;notcool:number;total:number};percent?:{cool:number;notcool:number}};
export default function Page(){const[s,setS]=useState<Status|null>(null);const[voted,setVoted]=useState(false);const[user,setUser]=useState<any>(null);
useEffect(()=>{fetch('/api/status').then(r=>r.json()).then(setS as any);fetch('/api/me').then(r=>r.json()).then(j=>setUser(j.user||null));},[]);
async function vote(choice:'cool'|'notcool'){const r=await fetch('/api/vote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({choice})});const j=await r.json();
if(j.ok)setVoted(true);else if(j.error==='signin_required'){window.location.href='/api/auth/login';}else if(j.error==='already_voted'){alert('You already voted today.');setVoted(true);}else{alert('Vote failed.');}}
function shareVote(v:'cool'|'notcool'){if(!s||!s.ok)return;const msg=v==='cool'?'I voted *Cool* on today\'s launch.':'I voted *Not Cool* on today\'s launch.';const url=s.cast.url||'';
const pre=encodeURIComponent(`${msg} What do you think? #CoolNotCool ${url}`);const compose=`https://warpcast.com/~/compose?text=${pre}`;window.open(compose,'_blank');}
if(!s)return <div className='container'>Loading…</div>; if(!s.ok)return <div className='container'>Come back later.</div>;
const a=s.cast.author||{}; const name=a.display_name||a.username||'user';
const hasImage=Array.isArray(s.cast.embeds)&&s.cast.embeds.some(e=>/\.(png|jpe?g|gif|webp|svg)$/i.test(e.url)||(e.content_type||'').startsWith('image/'));
const firstImage=hasImage?(s.cast.embeds||[]).find(e=>/\.(png|jpe?g|gif|webp|svg)$/i.test(e.url)||(e.content_type||'').startsWith('image/')):null;
return (<div className='container'><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
<div className='pill'>{s.phase==='voting'?'Voting open (IST)':'Results'}</div>
<div>{user?(<span className='muted' style={{marginRight:8}}>@{user.username}</span>):(<a className='footerLink' href='/api/auth/login'>Sign in</a>)}
<img className='logo' src='/icon.svg' alt='CN' style={{marginLeft:8}}/></div></div>
<div className='card'><div className='header'>{a.pfp_url&&<img src={a.pfp_url} alt='pfp'/>}<div><div className='author'>{name}</div>{a.username&&<div className='handle'>@{a.username}</div>}</div></div>
<div className='text'>{s.cast.text}</div>
{hasImage&&firstImage&&(<div className='embedWrap' style={{aspectRatio:'1/1',marginTop:6}}><img src={firstImage.url} alt='embed'/></div>)}
{s.phase==='voting'?(<div className='actions' style={{gridTemplateColumns:'1fr 1fr'}}>
<button className='btn' disabled={voted} onClick={()=>vote('cool')}>😎 Cool</button>
<button className='btn' disabled={voted} onClick={()=>vote('notcool')}>🙅‍♂️ Not Cool</button>{voted&&(<button className='btn' onClick={()=>shareVote('cool')}>↗️ Share</button>)}
</div>):(<div className='result'><div className='big'>{s.percent?.cool??0}% Cool</div>
<div className='muted'>{s.totals?.cool??0} 👍 • {s.totals?.notcool??0} 👎</div><div style={{marginTop:10}}><button className='btn' onClick={()=>shareVote('cool')}>↗️ Share result</button></div></div>)}
<div style={{display:'flex',justifyContent:'space-between',marginTop:10}}><div className='muted'>{s.phase==='voting'?'Vote today • Results tomorrow (IST)':'New post picks at 00:00 IST'}</div>
<div style={{display:'flex',gap:10}}>{s.cast.url&&(<a className='footerLink' href={s.cast.url} target='_blank' rel='noreferrer'>view post</a>)}<a className='footerLink' href='/public'>last 7 days</a></div></div></div></div>); }