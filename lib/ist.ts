export function istDateStr(d: Date|undefined=undefined):string{
const date=d?d:new Date();return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function todayIST():Date{ return new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Kolkata'})); }
export function yesterdayIST():string{ const t=todayIST(); t.setDate(t.getDate()-1); return istDateStr(t); }