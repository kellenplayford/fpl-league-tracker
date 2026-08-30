const LEAGUES=[{id:"37546",name:"Sexy Pickford"},{id:"118082",name:"The Battle Continues"}];
let active="37546",latest={},history={days:[]},snapshots=[],fixtureProgress=null;

const fmt=n=>(n===null||n===undefined||n==="")?"—":Number(n).toLocaleString("en-GB");
const esc=s=>String(s??"—").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const loadJson=async p=>{const r=await fetch(`${p}?v=${Date.now()}`);if(!r.ok)throw Error(p);return r.json()};
const leagueData=(snap=latest)=>snap?.leagues?.find(l=>String(l.league_id)===active);
const chipName=c=>({bboost:"Bench Boost","3xc":"Triple Captain",freehit:"Free Hit",wildcard:"Wildcard"}[c]||c||"");

const movement=m=>{
  const c=+m.league_position,p=+m.previous_league_position;
  if(!p||p===c)return{text:"—",cls:"same",delta:0};
  return p>c?{text:`▲ ${p-c}`,cls:"up",delta:p-c}:{text:`▼ ${c-p}`,cls:"down",delta:p-c};
};

function getDaysTop(){
  const o={};
  for(const d of history.days||[]){
    const x=d.leagues?.[active];
    if(!x)continue;
    const id=String(x.leader_entry_id||x.leader_manager);
    o[id]??={id,name:x.leader_manager,team:x.leader_team,days:0};
    o[id].days++;
  }
  const st=history?.days_top?.[active]||{};
  return Object.values(o).map(x=>({...x,longest:st[x.id]?.longest_streak||0})).sort((a,b)=>b.days-a.days);
}

function completedRows(){
  const cur=+latest.gameweek||999,m=new Map();
  for(const s of snapshots){
    const l=leagueData(s),gw=+s.gameweek;
    if(!l||!gw||gw>=cur)continue;
    const stamp=new Date(s.generated_at||s.snapshot_date||0).getTime();
    for(const r of l.standings||[]){
      const k=`${gw}:${r.entry_id}`,old=m.get(k);
      if(!old||stamp>=old.stamp)m.set(k,{...r,gameweek:gw,stamp});
    }
  }
  return [...m.values()];
}

function gameweeks(){
  const g={};
  for(const r of completedRows())(g[r.gameweek]??=[]).push(r);
  return Object.entries(g).map(([gw,rs])=>{
    const net=r=>(+r.gameweek_points||0)-(+r.transfer_cost||0);
    const s=rs.slice().sort((a,b)=>net(b)-net(a));
    const score=net(s[0]);
    const winners=s.filter(r=>net(r)===score);
    const second=s.find(r=>net(r)<score);
    return{gw:+gw,winners,score,margin:second?score-net(second):null};
  }).sort((a,b)=>a.gw-b.gw);
}

const benchRaw=r=>(r.squad||[]).filter(p=>+p.position>=12).reduce((a,p)=>a+(+p.live_points||0),0);
const capRaw=r=>{const p=(r.squad||[]).find(p=>p.is_captain);return p?+p.live_points||0:null};

function best(rows,get,mode="max"){
  return rows.reduce((a,r)=>{
    const v=get(r);
    if(v==null)return a;
    return !a||(mode==="max"?v>a.value:v<a.value)?{row:r,value:v}:a;
  },null);
}

function allRecords(){
  const rows=completedRows(),days=getDaysTop(),gws=gameweeks();
  const high=best(rows,r=>+r.gameweek_points||0);
  const or=best(rows,r=>+r.overall_rank>0?+r.overall_rank:null,"min");
  const climb=best(rows,r=>movement(r).delta>0?movement(r).delta:null);
  const fall=best(rows,r=>movement(r).delta<0?Math.abs(movement(r).delta):null);
  const bench=best(rows,r=>+r.points_on_bench||0);
  const bb=best(rows.filter(r=>r.active_chip==="bboost"),benchRaw);
  const tc=best(rows.filter(r=>r.active_chip==="3xc"),r=>capRaw(r)==null?null:capRaw(r)*3);
  const longest=days.slice().sort((a,b)=>b.longest-a.longest)[0];
  const mostDays=days[0];
  const big=gws.reduce((a,g)=>g.margin!=null&&(!a||g.margin>a.margin)?g:a,null);
  const close=gws.reduce((a,g)=>g.margin!=null&&(!a||g.margin<a.margin)?g:a,null);

  return[
    {hero:true,label:"Highest GW score",holder:high?.row.manager_name,stat:high?`${fmt(high.value)} pts`:"—",context:high?`GW${high.row.gameweek}`:"No completed GW yet"},
    {hero:true,label:"Best overall rank",holder:or?.row.manager_name,stat:or?fmt(or.value):"—",context:or?`GW${or.row.gameweek}`:"No completed GW yet"},
    {hero:true,label:"Biggest GW winning margin",holder:big?.winners.map(x=>x.manager_name).join(" & "),stat:big?`${fmt(big.margin)} pts`:"—",context:big?`GW${big.gw}`:"No completed GW yet"},
    {hero:true,label:"Most calendar days on top",holder:mostDays?.name,stat:mostDays?`${fmt(mostDays.days)} days`:"—",context:"Daily snapshots"},
    {label:"Closest GW winning margin",holder:close?.winners.map(x=>x.manager_name).join(" & "),stat:close?`${fmt(close.margin)} pt${close.margin===1?"":"s"}`:"—",context:close?`GW${close.gw}`:"No completed GW yet"},
    {label:"Longest time at No. 1",holder:longest?.name,stat:longest?`${longest.longest} calendar day${longest.longest===1?"":"s"}`:"—",context:"Calendar-day streak"},
    {label:"Biggest climb",holder:climb?.row.manager_name,stat:climb?`▲ ${fmt(climb.value)} places`:"—",context:climb?`GW${climb.row.gameweek}`:"No completed movement yet"},
    {label:"Biggest fall",holder:fall?.row.manager_name,stat:fall?`▼ ${fmt(fall.value)} places`:"—",context:fall?`GW${fall.row.gameweek}`:"No completed movement yet"},
    {label:"Most points benched",holder:bench?.row.manager_name,stat:bench?`${fmt(bench.value)} pts`:"—",context:bench?`GW${bench.row.gameweek}`:"No completed GW yet"},
    {label:"Best Bench Boost",holder:bb?.row.manager_name,stat:bb?`${fmt(bb.value)} bench pts`:"—",context:bb?`GW${bb.row.gameweek}`:"No completed use yet"},
    {label:"Best Triple Captain",holder:tc?.row.manager_name,stat:tc?`${fmt(tc.value)} captain pts`:"—",context:tc?`GW${tc.row.gameweek}`:"No completed use yet"}
  ];
}

function leagueAvg(){
  const r=leagueData()?.standings||[];
  return r.length?r.reduce((a,x)=>a+(+x.gameweek_points||0),0)/r.length:null;
}

function avgTag(m){
  const a=leagueAvg();
  if(a==null)return"";
  const d=(+m.gameweek_points||0)-a,c=d>0?"above":d<0?"below":"level";
  return`<div class="avg-pill ${c}">${d>0?"+":""}${Math.round(d)} vs league avg</div>`;
}

function chips(id){
  const m=new Map();
  for(const s of snapshots){
    const gw=+s.gameweek,r=leagueData(s)?.standings?.find(x=>String(x.entry_id)===String(id));
    if(gw&&r?.active_chip)m.set(`${gw}:${r.active_chip}`,{gw,chip:r.active_chip});
  }
  return[...m.values()].sort((a,b)=>a.gw-b.gw);
}

function managerSeason(m){
  const rows=completedRows().filter(r=>String(r.entry_id)===String(m.entry_id));
  const gwWins=gameweeks().filter(g=>g.winners.some(w=>String(w.entry_id)===String(m.entry_id))).length;
  const bestGw=best(rows,r=>+r.gameweek_points||0);
  const bestOr=best(rows,r=>+r.overall_rank>0?+r.overall_rank:null,"min");
  const days=getDaysTop().find(x=>String(x.id)===String(m.entry_id));
  return{gwWins,bestGw:bestGw?.value,bestOr:bestOr?.value,days:days?.days||0};
}

function squadHTML(m){
  const p=(m.squad||[]).slice().sort((a,b)=>+a.position-+b.position);
  return p.length?`<div class="squad">${p.map(x=>{
    const meta=[x.is_captain?"C":x.is_vice_captain?"VC":"",+x.position>=12?"Bench":""].filter(Boolean).join(" · ");
    return`<div class="player ${+x.position>=12?"bench":""} ${x.is_captain?"captain":""}">
      <div class="player-name">${esc(x.player)}</div>
      <div class="player-meta">${esc(meta||"Starting XI")}</div>
      <div class="player-points">${fmt(x.live_points)} pts</div>
    </div>`;
  }).join("")}</div>`:`<div class="empty">Squad unavailable.</div>`;
}

function detail(m,mobile=false){
  const s=managerSeason(m),ch=chips(m.entry_id);
  const items=[
    ["Overall rank",fmt(m.overall_rank)],["GW rank",fmt(m.gameweek_rank)],["Captain",esc(m.captain||"—")],
    ["Transfers",fmt(m.transfers)],["Hit",m.transfer_cost?`-${fmt(m.transfer_cost)}`:"0"],
    ["Team value",m.team_value!=null?`£${(+m.team_value).toFixed(1)}m`:"—"],
    ["Bank",m.bank!=null?`£${(+m.bank).toFixed(1)}m`:"—"]
  ];
  return`<div class="profile-top">
    <div><div class="profile-name">${esc(m.manager_name)}</div><div class="profile-team">${esc(m.team_name)}</div></div>
    <div class="profile-stats">
      <div class="profile-stat"><strong>${fmt(s.gwWins)}</strong><span>GW wins</span></div>
      <div class="profile-stat"><strong>${fmt(s.days)}</strong><span>Days top</span></div>
      <div class="profile-stat"><strong>${fmt(s.bestGw)}</strong><span>Best GW</span></div>
      <div class="profile-stat"><strong>${fmt(s.bestOr)}</strong><span>Best OR</span></div>
    </div>
  </div>
  <div class="${mobile?"mobile-detail-grid":"detail-grid"}">
    ${items.map(([a,b])=>`<div class="detail-item"><div class="mini-label">${a}</div><div class="detail-value">${b}</div></div>`).join("")}
  </div>
  <div class="detail-section"><div class="detail-title">Chips used</div><div class="chip-history">
    ${ch.length?ch.map(c=>`<span class="used-chip">${esc(chipName(c.chip))} · GW${c.gw}</span>`).join(""):`<span class="team-name">No chips recorded yet</span>`}
  </div></div>
  <div class="detail-section"><div class="detail-title">Current squad</div>${squadHTML(m)}</div>`;
}

function tabs(){
  const el=document.querySelector("#tabs");
  el.innerHTML=LEAGUES.map(l=>`<button class="tab ${l.id===active?"active":""}" data-id="${l.id}">${esc(l.name)}</button>`).join("");
  el.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{active=b.dataset.id;render()});
}

function hero(){
  const l=leagueData(),lead=l?.standings?.[0],avg=leagueAvg(),fp=fixtureProgress,managerCount=l?.standings?.length||0;
  document.querySelector("#hero").innerHTML=`
    <div class="hero-card hero-leader">
      <div class="hero-label">League leader</div><div class="hero-value">${esc(lead?.manager_name)}</div>
      <div class="hero-sub">${esc(lead?.team_name)} · ${fmt(lead?.total_points)} points</div>
    </div>
    <div class="hero-card">
      <div class="hero-label">Gameweek ${fmt(latest.gameweek)}</div>
      <div class="hero-value">${fp?`${fp.remaining} left`:"Live"}</div>
      <div class="hero-sub">${fp?`${fp.played} of ${fp.total} matches finished${fp.live?` · ${fp.live} live`:""}`:"Fixture progress unavailable"}</div>
      ${fp?`<div class="progress"><span style="width:${fp.total?fp.played/fp.total*100:0}%"></span></div>`:""}
    </div>
    <div class="hero-card">
      <div class="hero-label">League GW average</div><div class="hero-value">${avg==null?"—":Math.round(avg)}</div>
      <div class="hero-sub">Average points right now</div>
    </div>
    <div class="hero-card">
      <div class="hero-label">Managers in league</div><div class="hero-value">${fmt(managerCount)}</div>
      <div class="hero-sub">Current league size</div>
    </div>`;
}

function renderRecords(){
  const r=allRecords();
  const card=x=>`<div class="record"><div class="record-label">${esc(x.label)}</div><div class="record-holder">${esc(x.holder||"No record yet")}</div><div class="record-stat">${esc(x.stat)}</div><div class="record-context">${esc(x.context)}</div></div>`;
  document.querySelector("#headlineRecords").innerHTML=r.filter(x=>x.hero).map(card).join("");
  document.querySelector("#otherRecords").innerHTML=r.filter(x=>!x.hero).map(card).join("");
}

function renderGW(){
  const g=gameweeks().slice().reverse();
  document.querySelector("#gwWinners").innerHTML=g.length?`<div class="gw-card">${g.map(x=>`
    <div class="gw-row"><div class="gw-num">GW${x.gw}</div>
    <div><div class="gw-name">${esc(x.winners.map(w=>w.manager_name).join(" & "))}</div><div class="gw-margin">${x.margin==null?"":`${x.margin}-point winning margin`}</div></div>
    <div class="gw-score">${fmt(x.score)} pts</div></div>`).join("")}</div>`:`<div class="empty">No completed gameweeks yet.</div>`;
}

function renderDays(){
  const l=getDaysTop(),max=l[0]?.days||1;
  document.querySelector("#daysTop").innerHTML=l.length?`<div class="days-card">${l.map((x,i)=>`
    <div class="day-row"><div class="day-main">
    <div><span class="day-person">${i+1}. ${esc(x.name)}</span><div class="team-name">${esc(x.team||"")}</div></div>
    <div class="day-count">${x.days}</div></div><div class="bar"><span style="width:${Math.max(5,x.days/max*100)}%"></span></div></div>`).join("")}</div>`:`<div class="empty">No leader history yet.</div>`;
}

function standings(){
  const rows=leagueData()?.standings||[];
  const badge=m=>m.active_chip?`<span class="chip-badge">${esc(chipName(m.active_chip))}</span>`:"";

  const desk=`<div class="desktop-table"><table><thead><tr><th>Pos</th><th>Manager</th><th>GW</th><th>Total</th><th>Move</th><th>Overall</th></tr></thead><tbody>${rows.map((m,i)=>{
    const mv=movement(m);
    return`<tr class="manager-row ${i===0?"leader":""}" data-d="${m.entry_id}">
      <td class="pos">${fmt(m.league_position)}</td>
      <td><div class="manager-name">${esc(m.manager_name)}${badge(m)}</div><div class="team-name">${esc(m.team_name)}</div>${avgTag(m)}</td>
      <td>${fmt(m.gameweek_points)}</td><td class="points">${fmt(m.total_points)}</td><td class="${mv.cls}">${mv.text}</td><td>${fmt(m.overall_rank)}</td>
    </tr>
    <tr class="desktop-detail-row" id="d-${m.entry_id}">
      <td colspan="6" class="desktop-detail-cell"><div class="desktop-detail" data-detail="${m.entry_id}"></div></td>
    </tr>`;
  }).join("")}</tbody></table></div>`;

  const mob=`<div class="mobile-list">${rows.map((m,i)=>{
    const mv=movement(m);
    return`<article class="manager-card ${i===0?"leader":""}" data-m="${m.entry_id}">
      <div class="manager-summary"><div class="pos">${fmt(m.league_position)}</div>
      <div><div class="manager-name">${esc(m.manager_name)}${badge(m)}</div><div class="team-name">${esc(m.team_name)} · <span class="${mv.cls}">${mv.text}</span></div>${avgTag(m)}</div>
      <div class="manager-points"><strong>${fmt(m.total_points)}</strong><span class="team-name">${fmt(m.gameweek_points)} GW</span></div><div class="chev">⌄</div></div>
      <div class="manager-detail" data-mobile-detail="${m.entry_id}"></div>
    </article>`;
  }).join("")}</div>`;

  document.querySelector("#standings").innerHTML=desk+mob;

  document.querySelectorAll("[data-d]").forEach(r=>r.onclick=()=>{
    const id=r.dataset.d,row=document.querySelector(`#d-${id}`),box=row.querySelector("[data-detail]");
    const opening=!row.classList.contains("open");
    document.querySelectorAll(".desktop-detail-row.open").forEach(x=>{if(x!==row)x.classList.remove("open")});
    row.classList.toggle("open");
    if(opening&&!box.dataset.loaded){
      const m=rows.find(x=>String(x.entry_id)===String(id));
      box.innerHTML=detail(m);box.dataset.loaded="1";
    }
  });

  document.querySelectorAll("[data-m]").forEach(c=>c.onclick=()=>{
    const id=c.dataset.m,box=c.querySelector("[data-mobile-detail]"),opening=!c.classList.contains("open");
    c.classList.toggle("open");
    if(opening&&!box.dataset.loaded){
      const m=rows.find(x=>String(x.entry_id)===String(id));
      box.innerHTML=detail(m,true);box.dataset.loaded="1";
    }
  });
}

async function fixture(){
  const gw=+latest.gameweek;
  if(!gw)return;
  const urls=[
    `https://fpl-scheduler.kellenplayford.workers.dev/fixtures?event=${gw}`,
    `https://fantasy.premierleague.com/api/fixtures/?event=${gw}`
  ];
  for(const url of urls){
    try{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),2500);
      const r=await fetch(url,{signal:controller.signal});
      clearTimeout(timer);
      if(!r.ok)continue;
      const f=await r.json();
      if(!Array.isArray(f))continue;
      const total=f.length,played=f.filter(x=>x.finished===true).length;
      const live=f.filter(x=>x.started===true&&x.finished!==true).length;
      fixtureProgress={total,played,live,remaining:Math.max(0,total-played)};
      hero();
      return;
    }catch(e){}
  }
}

function render(){
  tabs();hero();renderRecords();renderGW();renderDays();standings();
  document.querySelector("#updated").textContent=latest.generated_at
    ?`Updated ${new Date(latest.generated_at).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"})}`
    :"Awaiting snapshot";
}

async function loadArchives(){
  try{
    const m=await loadJson("data/manifest.json");
    snapshots=(await Promise.all((m.official_snapshots||[]).map(p=>loadJson(p).catch(()=>null)))).filter(Boolean);
  }catch(e){snapshots=latest?.leagues?[latest]:[]}
  render();
}

(async()=>{
  try{latest=await loadJson("data/latest.json")}catch(e){}
  try{history=await loadJson("data/history.json")}catch(e){}
  snapshots=latest?.leagues?[latest]:[];
  render();
  fixture();
  loadArchives();
})();
