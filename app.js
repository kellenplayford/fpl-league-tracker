const LEAGUES=[{id:"37546",name:"Sexy Pickford"},{id:"118082",name:"The Battle Continues"}];
let active="37546",latest={},history={days:[]},snapshots=[],fixtureProgress=null,liveFixtures=[],playerTeams=new Map();

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

function longestReign(){
  const days=(history.days||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  let best=null,current=null,previousDate=null;
  for(const d of days){
    const x=d.leagues?.[active];
    if(!x||!d.date)continue;
    const id=String(x.leader_entry_id||x.leader_manager);
    const dt=new Date(`${d.date}T12:00:00Z`);
    const prev=previousDate?new Date(`${previousDate}T12:00:00Z`):null;
    const consecutive=prev&&((dt-prev)/86400000===1);
    if(current&&current.id===id&&consecutive)current.days++;
    else current={id,name:x.leader_manager,team:x.leader_team,days:1,start:d.date,end:d.date};
    current.end=d.date;
    if(!best||current.days>best.days)best={...current};
    previousDate=d.date;
  }
  return best;
}

function completedRows(){
  const cur=+(fixtureProgress?.gameweek||latest.gameweek)||999,m=new Map();
  const includeCurrent=fixtureProgress?.status==="Complete";
  for(const s of snapshots){
    const l=leagueData(s),gw=+s.gameweek;
    if(!l||!gw)continue;
    if(gw>cur)continue;
    if(gw===cur&&!includeCurrent)continue;
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
const captainPlayer=r=>(r.squad||[]).find(p=>(+p.multiplier||0)>1)||(r.squad||[]).find(p=>p.is_captain);
const captainContribution=r=>{const p=captainPlayer(r);if(!p)return null;const mult=(+p.multiplier||0)>1?+p.multiplier:(r.active_chip==="3xc"?3:2);return(+p.live_points||0)*mult};

function best(rows,get,mode="max"){
  return rows.reduce((a,r)=>{
    const v=get(r);
    if(v==null)return a;
    return !a||(mode==="max"?v>a.value:v<a.value)?{row:r,value:v}:a;
  },null);
}

function tiedBest(rows,get,mode="max"){
  const vals=rows.map(row=>({row,value:get(row)})).filter(x=>x.value!=null);
  if(!vals.length)return null;
  const target=vals.reduce((a,x)=>mode==="max"?Math.max(a,x.value):Math.min(a,x.value),vals[0].value);
  return{value:target,rows:vals.filter(x=>x.value===target).map(x=>x.row)};
}

const firstName=n=>String(n||"").trim().split(/\s+/)[0]||"—";
const tiedNames=rows=>[...new Set((rows||[]).map(r=>firstName(r.manager_name)))].join(" & ");
const tiedContext=(rows,label)=>{
  const gws=[...new Set((rows||[]).map(r=>+r.gameweek).filter(Boolean))];
  if(gws.length===1)return `GW${gws[0]}`;
  return label||"Joint record";
};

function tiedMapLeader(map){
  const vals=[...map.values()];
  if(!vals.length)return null;
  const max=Math.max(...vals.map(x=>x.value));
  return{value:max,rows:vals.filter(x=>x.value===max).map(x=>x.row)};
}

function allRecords(){
  const rows=completedRows(),days=getDaysTop(),gws=gameweeks();

  const high=tiedBest(rows,r=>+r.gameweek_points||0);
  const bestGwRank=tiedBest(rows,r=>+r.gameweek_rank>0?+r.gameweek_rank:null,"min");
  const bestOr=tiedBest(rows,r=>+r.overall_rank>0?+r.overall_rank:null,"min");
  const climb=tiedBest(rows,r=>movement(r).delta>0?movement(r).delta:null);
  const fall=tiedBest(rows,r=>movement(r).delta<0?Math.abs(movement(r).delta):null);

  const longestDays=Math.max(0,...days.map(x=>x.longest||0));
  const longestLeaders=days.filter(x=>(x.longest||0)===longestDays&&longestDays>0);
  const mostDaysValue=Math.max(0,...days.map(x=>x.days||0));
  const mostDaysLeaders=days.filter(x=>(x.days||0)===mostDaysValue&&mostDaysValue>0);

  const bigMargin=Math.max(-Infinity,...gws.filter(g=>g.margin!=null).map(g=>g.margin));
  const smallMargin=Math.min(Infinity,...gws.filter(g=>g.margin!=null).map(g=>g.margin));
  const bigGws=gws.filter(g=>g.margin!=null&&g.margin===bigMargin);
  const smallGws=gws.filter(g=>g.margin!=null&&g.margin===smallMargin);

  const winTotals=new Map();
  for(const g of gws){
    for(const w of g.winners){
      const id=String(w.entry_id);
      const old=winTotals.get(id)||{value:0,row:w};
      old.value++;old.row=w;winTotals.set(id,old);
    }
  }
  const winLeader=tiedMapLeader(winTotals);

  const singleTC=tiedBest(rows.filter(r=>r.active_chip==="3xc"),captainContribution);
  const singleBB=tiedBest(rows.filter(r=>r.active_chip==="bboost"),benchRaw);
  const singleFH=tiedBest(rows.filter(r=>r.active_chip==="freehit"),r=>(+r.gameweek_points||0)-(+r.transfer_cost||0));
  const singleCaptain=tiedBest(rows,captainContribution);
  const gwBench=tiedBest(rows.filter(r=>r.active_chip!=="bboost"),r=>+r.points_on_bench||0);

  const tcTotals=new Map(),bbTotals=new Map(),fhTotals=new Map(),captainTotals=new Map();
  const benchTotals=new Map(),transferTotals=new Map(),hitTotals=new Map();

  for(const r of rows){
    const id=String(r.entry_id);

    const cap=captainContribution(r);
    if(cap!=null){
      const old=captainTotals.get(id)||{value:0,row:r};
      old.value+=cap;old.row=r;captainTotals.set(id,old);
    }

    if(r.active_chip==="3xc"){
      const v=captainContribution(r);
      if(v!=null){
        const old=tcTotals.get(id)||{value:0,row:r};
        old.value+=v;old.row=r;tcTotals.set(id,old);
      }
    }

    if(r.active_chip==="bboost"){
      const v=benchRaw(r);
      const old=bbTotals.get(id)||{value:0,row:r};
      old.value+=v;old.row=r;bbTotals.set(id,old);
    }

    if(r.active_chip==="freehit"){
      const v=(+r.gameweek_points||0)-(+r.transfer_cost||0);
      const old=fhTotals.get(id)||{value:0,row:r};
      old.value+=v;old.row=r;fhTotals.set(id,old);
    }

    if(r.active_chip!=="bboost"){
      const v=+r.points_on_bench||0;
      const old=benchTotals.get(id)||{value:0,row:r};
      old.value+=v;old.row=r;benchTotals.set(id,old);
    }

    const transfers=+r.transfers||0;
    const oldTransfers=transferTotals.get(id)||{value:0,row:r};
    oldTransfers.value+=transfers;oldTransfers.row=r;transferTotals.set(id,oldTransfers);

    const hit=+r.transfer_cost||0;
    const oldHit=hitTotals.get(id)||{value:0,row:r};
    oldHit.value+=hit;oldHit.row=r;hitTotals.set(id,oldHit);
  }

  const combinedTC=tiedMapLeader(tcTotals);
  const combinedBB=tiedMapLeader(bbTotals);
  const combinedFH=tiedMapLeader(fhTotals);
  const captainBest=tiedMapLeader(captainTotals);
  const seasonBench=tiedMapLeader(benchTotals);
  const transferBest=tiedMapLeader(transferTotals);
  const hitBest=tiedMapLeader(hitTotals);

  const marginHolder=gs=>[...new Set(gs.flatMap(g=>g.winners.map(w=>firstName(w.manager_name))))].join(" & ");
  const marginContext=gs=>gs.length===1?`GW${gs[0].gw}`:"Joint record";

  return[
    {label:"Best GW score",holder:high?tiedNames(high.rows):null,stat:high?`${fmt(high.value)} pts`:"—",context:high?tiedContext(high.rows):"No completed GW yet"},
    {label:"Most GW wins",holder:winLeader?tiedNames(winLeader.rows):null,stat:winLeader?`${fmt(winLeader.value)} win${winLeader.value===1?"":"s"}`:"—",context:winLeader&&winLeader.rows.length>1?"Joint leaders":winLeader?"Season total":"No completed GW yet"},

    {label:"Best GW rank",holder:bestGwRank?tiedNames(bestGwRank.rows):null,stat:bestGwRank?fmt(bestGwRank.value):"—",context:bestGwRank?tiedContext(bestGwRank.rows):"No completed GW yet"},
    {label:"Best overall rank",holder:bestOr?tiedNames(bestOr.rows):null,stat:bestOr?fmt(bestOr.value):"—",context:bestOr?tiedContext(bestOr.rows):"No completed GW yet"},

    {label:"Biggest GW margin",holder:bigGws.length?marginHolder(bigGws):null,stat:bigGws.length?`${fmt(bigMargin)} pts`:"—",context:bigGws.length?marginContext(bigGws):"No completed GW yet"},
    {label:"Smallest GW margin",holder:smallGws.length?marginHolder(smallGws):null,stat:smallGws.length?`${fmt(smallMargin)} pt${smallMargin===1?"":"s"}`:"—",context:smallGws.length?marginContext(smallGws):"No completed GW yet"},

    {label:"Best Single Triple Captain",holder:singleTC?tiedNames(singleTC.rows):null,stat:singleTC?`${fmt(singleTC.value)} captain pts`:"—",context:singleTC?tiedContext(singleTC.rows):"No completed use yet"},
    {label:"Best Combined TC Score",holder:combinedTC?tiedNames(combinedTC.rows):null,stat:combinedTC?`${fmt(combinedTC.value)} captain pts`:"—",context:combinedTC&&combinedTC.rows.length>1?"Joint leaders":combinedTC?"Season chip total":"No completed use yet"},

    {label:"Best Single Bench Boost",holder:singleBB?tiedNames(singleBB.rows):null,stat:singleBB?`${fmt(singleBB.value)} bench pts`:"—",context:singleBB?tiedContext(singleBB.rows):"No completed use yet"},
    {label:"Best Combined Bench Boost",holder:combinedBB?tiedNames(combinedBB.rows):null,stat:combinedBB?`${fmt(combinedBB.value)} bench pts`:"—",context:combinedBB&&combinedBB.rows.length>1?"Joint leaders":combinedBB?"Season chip total":"No completed use yet"},

    {label:"Best Single Free Hit",holder:singleFH?tiedNames(singleFH.rows):null,stat:singleFH?`${fmt(singleFH.value)} pts`:"—",context:singleFH?tiedContext(singleFH.rows):"No completed use yet"},
    {label:"Best Combined Free Hit Score",holder:combinedFH?tiedNames(combinedFH.rows):null,stat:combinedFH?`${fmt(combinedFH.value)} pts`:"—",context:combinedFH&&combinedFH.rows.length>1?"Joint leaders":combinedFH?"Season chip total":"No completed use yet"},

    {label:"Best Single Captain Score",holder:singleCaptain?tiedNames(singleCaptain.rows):null,stat:singleCaptain?`${fmt(singleCaptain.value)} pts`:"—",context:singleCaptain?tiedContext(singleCaptain.rows):"No completed GW yet"},
    {label:"Most Combined Captain Points",holder:captainBest?tiedNames(captainBest.rows):null,stat:captainBest?`${fmt(captainBest.value)} pts`:"—",context:captainBest&&captainBest.rows.length>1?"Joint leaders":captainBest?"Season total":"No completed GW yet"},

    {label:"Most GW Points Left on Bench",holder:gwBench?tiedNames(gwBench.rows):null,stat:gwBench?`${fmt(gwBench.value)} pts`:"—",context:gwBench?tiedContext(gwBench.rows):"No completed GW yet"},
    {label:"Most Season Points Left on Bench",holder:seasonBench?tiedNames(seasonBench.rows):null,stat:seasonBench?`${fmt(seasonBench.value)} pts`:"—",context:seasonBench&&seasonBench.rows.length>1?"Joint leaders":seasonBench?"Season total":"No completed GW yet"},

    {label:"Most Transfers",holder:transferBest?tiedNames(transferBest.rows):null,stat:transferBest?`${fmt(transferBest.value)} transfers`:"—",context:transferBest&&transferBest.rows.length>1?"Joint leaders":transferBest?"Season total":"No completed GW yet"},
    {label:"Most Transfer Hits",holder:hitBest&&hitBest.value>0?tiedNames(hitBest.rows):null,stat:hitBest&&hitBest.value>0?`-${fmt(hitBest.value)} pts`:"—",context:hitBest&&hitBest.value>0?(hitBest.rows.length>1?"Joint leaders":"Season total"):"No transfer hits yet"},

    {label:"Most Days at No. 1",cadence:"daily",holder:mostDaysLeaders.length?mostDaysLeaders.map(x=>firstName(x.name)).join(" & "):null,stat:mostDaysLeaders.length?`${fmt(mostDaysValue)} days`:"—",context:mostDaysLeaders.length>1?"Joint leaders":"Total days leading"},
    {label:"Longest No. 1 Streak",cadence:"daily",holder:longestLeaders.length?longestLeaders.map(x=>firstName(x.name)).join(" & "):null,stat:longestLeaders.length?`${fmt(longestDays)} day${longestDays===1?"":"s"}`:"—",context:longestLeaders.length>1?"Joint record":"Longest streak"},

    {label:"Biggest GW Climb",holder:climb?tiedNames(climb.rows):null,stat:climb?`▲ ${fmt(climb.value)} places`:"—",context:climb?tiedContext(climb.rows,"Joint record"):"No completed movement yet"},
    {label:"Biggest GW Fall",holder:fall?tiedNames(fall.rows):null,stat:fall?`▼ ${fmt(fall.value)} places`:"—",context:fall?tiedContext(fall.rows,"Joint record"):"No completed movement yet"}
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
  const bestGwRank=best(rows,r=>+r.gameweek_rank>0?+r.gameweek_rank:null,"min");
  const days=getDaysTop().find(x=>String(x.id)===String(m.entry_id));
  return{gwWins,bestGw:bestGw?.value,bestOr:bestOr?.value,bestGwRank:bestGwRank?.value,days:days?.days||0};
}

function playerFixtureState(elementId){
  const team=playerTeams.get(String(elementId));
  if(!team||!liveFixtures.length)return"";
  const games=liveFixtures.filter(f=>+f.team_h===+team||+f.team_a===+team);
  if(!games.length)return"";
  if(games.some(f=>f.started===true&&f.finished!==true&&f.finished_provisional!==true))return"live";
  return games.every(f=>f.finished===true||f.finished_provisional===true)?"played":"";
}

function playerHasFootballLeft(elementId){
  const team=playerTeams.get(String(elementId));
  if(!team||!liveFixtures.length)return null;
  const games=liveFixtures.filter(f=>+f.team_h===+team||+f.team_a===+team);
  if(!games.length)return false;
  return games.some(f=>f.finished!==true&&f.finished_provisional!==true);
}

function remainingPlayers(m){
  if(!playerTeams.size||!liveFixtures.length)return null;
  const squad=(m.squad||[]).filter(p=>m.active_chip==="bboost"||+p.position<12);
  if(!squad.length)return null;
  return squad.reduce((n,p)=>n+(playerHasFootballLeft(p.element_id)===true?1:0),0);
}

function remainingLabel(m){
  const n=remainingPlayers(m);
  if(n==null)return"";
  return n===0?"All played":`${n} player${n===1?"":"s"} remaining`;
}

function squadHTML(m){
  const p=(m.squad||[]).slice().sort((a,b)=>+a.position-+b.position);
  if(!p.length)return`<div class="empty">Squad unavailable.</div>`;
  const card=x=>{
    const mult=+x.multiplier||0,bench=+x.position>=12,state=playerFixtureState(x.element_id);
    const meta=[x.is_captain?"C":x.is_vice_captain?"VC":"",bench?"Bench":""].filter(Boolean).join(" · ");
    const captainLine=mult>1?`<div class="captain-return">Captain return: ${fmt(x.live_points)} × ${mult} = ${fmt((+x.live_points||0)*mult)} pts</div>`:"";
    const dot=state?`<span class="fixture-dot ${state}" title="${state==="played"?"Fixture complete":"Playing now"}" aria-label="${state==="played"?"Fixture complete":"Playing now"}"></span>`:"";
    return`<div class="player ${bench?"bench":""} ${mult>1?"captain":""}">
      <div class="player-name">${esc(x.player)}${dot}</div>
      <div class="player-meta">${esc(meta||"Starting XI")}</div>
      <div class="player-points">${fmt(x.live_points)} pts</div>${captainLine}
    </div>`;
  };
  const starters=p.filter(x=>+x.position<12),bench=p.filter(x=>+x.position>=12);
  return`<div class="squad squad-starters">${starters.map(card).join("")}</div>
    ${bench.length?`<div class="bench-divider">Bench</div><div class="squad squad-bench">${bench.map(card).join("")}</div>`:""}`;
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
      <div class="profile-stat"><strong>${fmt(s.bestGwRank)}</strong><span>Best GW rank</span></div>
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
  const l=leagueData(),lead=l?.standings?.[0],avg=leagueAvg(),fp=fixtureProgress,managerCount=l?.standings?.length||l?.manager_count||0;
  const displayGw=fp?.gameweek||latest.gameweek;
  const gwValue=fp?`${fp.ended} / ${fp.total}`:"— / —";
  const gwSub=fp
    ? fp.status==="Complete"
      ? "Complete · FPL has finalised all matches"
      : fp.status==="Finalising"
        ? `Finalising · ${fp.finalised} of ${fp.total} finalised`
        : fp.status==="Not started"
          ? "Not started"
          : `${fp.status}${fp.live?` · ${fp.live} live`:""}${fp.remaining?` · ${fp.remaining} to play`:""}`
    : "Fixture progress unavailable";
  document.querySelector("#hero").innerHTML=`
    <div class="hero-card hero-leader hero-daily">
      <div class="hero-label">League leader</div><div class="hero-value">${esc(lead?.manager_name)}</div>
      <div class="hero-sub">${esc(lead?.team_name)} · ${fmt(lead?.total_points)} points · 1st of ${fmt(managerCount)} managers</div>
    </div>
    <div class="hero-card hero-gameweek hero-daily">
      <div class="hero-label">Gameweek ${fmt(displayGw)}</div>
      <div class="hero-value">${gwValue}</div>
      <div class="hero-sub">${gwSub}</div>
      ${fp?`<div class="progress"><span style="width:${fp.total?fp.ended/fp.total*100:0}%"></span></div>`:""}
    </div>
    <div class="hero-card hero-daily">
      <div class="hero-label">League GW average</div><div class="hero-value">${avg==null?"—":Math.round(avg)}</div>
      <div class="hero-sub">Latest overnight snapshot</div>
    </div>`;
}

function renderRecords(){
  const r=allRecords();
  const card=x=>{
    const cadence=x.cadence==="daily"?` <span class="update-pill daily">Daily</span>`:"";
    return`<div class="record ${x.wide?"record-wide":""} ${x.cadence==="daily"?"record-daily":""}"><div class="record-label">${esc(x.label)}${cadence}</div><div class="record-holder">${esc(x.holder||"No record yet")}</div><div class="record-stat">${esc(x.stat)}</div><div class="record-context">${esc(x.context)}</div></div>`;
  };
  const hof=r.filter(x=>x.label!=="Most Days at No. 1"&&x.label!=="Longest No. 1 Streak");
  document.querySelector("#headlineRecords").innerHTML=hof.filter(x=>x.wide).map(card).join("");
  document.querySelector("#otherRecords").innerHTML=hof.filter(x=>!x.wide).map(card).join("");
}

function renderGW(){
  const g=gameweeks().slice().reverse();
  document.querySelector("#gwWinners").innerHTML=g.length?`<div class="gw-card">${g.map(x=>`
    <div class="gw-row"><div class="gw-num">GW${x.gw}</div>
    <div><div class="gw-name">${esc(x.winners.map(w=>w.manager_name).join(" & "))}</div><div class="gw-margin">${x.margin==null?"":`${x.margin}-point winning margin`}</div></div>
    <div class="gw-score">${fmt(x.score)} pts</div></div>`).join("")}</div>`:`<div class="empty">No completed gameweeks yet.</div>`;
}

function renderDays(){
  const l=getDaysTop().slice(0,5),max=l[0]?.days||1;
  const all=getDaysTop();
  const most=Math.max(0,...all.map(x=>x.days||0));
  const mostLeaders=all.filter(x=>(x.days||0)===most&&most>0);
  const longest=Math.max(0,...all.map(x=>x.longest||0));
  const streakLeaders=all.filter(x=>(x.longest||0)===longest&&longest>0);
  const first=n=>String(n||"").trim().split(/\s+/)[0]||"—";
  const names=xs=>[...new Set(xs.map(x=>first(x.name)))].join(" & ");
  const summary=`<div class="brag-summary">
    <div class="brag-stat"><div class="record-label">Most Days at No. 1</div><div class="record-holder">${mostLeaders.length?esc(names(mostLeaders)):"No record yet"}</div><div class="record-stat">${most?`${fmt(most)} days`:"—"}</div><div class="record-context">Total days leading</div></div>
    <div class="brag-stat"><div class="record-label">Longest No. 1 Streak</div><div class="record-holder">${streakLeaders.length?esc(names(streakLeaders)):"No record yet"}</div><div class="record-stat">${longest?`${fmt(longest)} days`:"—"}</div><div class="record-context">Longest streak</div></div>
  </div>`;
  const board=l.length?`<div class="days-card daily-card">${l.map((x,i)=>`
    <div class="day-row"><div class="day-main">
    <div><span class="day-person">${i+1}. ${esc(x.name)}</span><div class="team-name">${esc(x.team||"")}</div></div>
    <div class="day-count">${x.days}</div></div><div class="bar"><span style="width:${Math.max(5,x.days/max*100)}%"></span></div></div>`).join("")}</div>`:`<div class="empty">No leader history yet.</div>`;
  document.querySelector("#daysTop").innerHTML=summary+board;
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
      <div class="manager-points"><strong>${fmt(m.total_points)}</strong><span class="team-name">${fmt(m.gameweek_points)} GW</span>${remainingLabel(m)?`<span class="remaining-count">${esc(remainingLabel(m))}</span>`:""}</div><div class="chev">⌄</div></div>
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

async function fetchFixtures(gw){
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
      const payload=await r.json();
      const f=Array.isArray(payload)?payload:(Array.isArray(payload?.fixtures)?payload.fixtures:null);
      if(f?.length)return f;
    }catch(e){}
  }
  return null;
}

function summariseFixtures(f,gw){
  const total=f.length;
  const finalised=f.filter(x=>x.finished===true).length;
  const provisional=f.filter(x=>x.finished_provisional===true&&x.finished!==true).length;
  const ended=f.filter(x=>x.finished===true||x.finished_provisional===true).length;
  const live=f.filter(x=>x.started===true&&x.finished!==true&&x.finished_provisional!==true).length;
  const started=f.filter(x=>x.started===true).length;
  const remaining=Math.max(0,total-ended);

  let status="Live";
  if(total&&finalised===total)status="Complete";
  else if(total&&ended===total)status="Finalising";
  else if(started===0&&ended===0)status="Not started";

  return{gameweek:gw,total,finalised,provisional,ended,live,remaining,started,status};
}

async function fetchPlayerTeams(){
  try{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),3000);
    const r=await fetch("https://fpl-scheduler.kellenplayford.workers.dev/bootstrap",{signal:controller.signal});
    clearTimeout(timer);
    if(!r.ok)return false;
    const data=await r.json();
    if(!Array.isArray(data?.elements))return false;
    playerTeams=new Map(data.elements.map(x=>[String(x.id),+x.team]));
    return true;
  }catch(e){return false}
}

async function fixture(){
  const snapshotGw=+latest.gameweek;
  if(!snapshotGw)return;

  await fetchPlayerTeams();

  // Probe the next GW first. This lets the live status card move into a new
  // gameweek immediately when its first fixture starts, without waiting for
  // the next overnight manager snapshot.
  const nextGw=snapshotGw+1;
  const nextFixtures=await fetchFixtures(nextGw);
  if(nextFixtures){
    const next=summariseFixtures(nextFixtures,nextGw);
    if(next.started>0||next.ended>0){
      fixtureProgress=next;
      liveFixtures=nextFixtures;
      hero();
      standings();
      return;
    }
  }

  const currentFixtures=await fetchFixtures(snapshotGw);
  if(!currentFixtures)return;

  fixtureProgress=summariseFixtures(currentFixtures,snapshotGw);
  liveFixtures=currentFixtures;
  hero();
  standings();

  if(fixtureProgress.status==="Complete"){
    renderRecords();
    renderGW();
    standings();
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
