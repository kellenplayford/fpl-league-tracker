(()=>{const P={"37546":"sexy-pickford","118082":"the-battle-continues"},root="";
const j=async p=>{let r=await fetch(p+(p.includes("?")?"&":"?")+"v="+Date.now());if(!r.ok)throw Error(p);return r.json()};
const wanted=()=>new URLSearchParams(location.search).get("league")||(location.pathname.includes("the-battle-continues")?"118082":location.pathname.includes("sexy-pickford")?"37546":null);
const active=()=>document.querySelector(".tab.active")?.dataset.id||wanted()||"37546";
async function stamp(){try{let d=await j(root+"data/latest.json"),h=document.querySelector(".standings-section .section-head");if(!h)return;let e=document.querySelector("#standingsSnapshotNote");if(!e){e=document.createElement("div");e.id="standingsSnapshotNote";e.className="standings-snapshot";h.appendChild(e)}e.textContent="Standings snapshot: "+new Date(d.generated_at).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})+" · Updates daily"}catch(e){}}
async function chart(){let host=document.querySelector("#seasonProgressChart");if(!host)return;try{let m=await j(root+"data/manifest.json"),ss=(await Promise.all((m.official_snapshots||[]).map(p=>j(root+p).catch(()=>null)))).filter(Boolean),lid=active(),g=new Map;
for(let s of ss){let l=s.leagues?.find(x=>String(x.league_id)===lid);if(!l||!s.gameweek)continue;let t=new Date(s.generated_at||s.snapshot_date||0).getTime(),o=g.get(+s.gameweek);if(!o||t>=o.t)g.set(+s.gameweek,{t,rows:l.standings||[]})}
let gs=[...g.keys()].sort((a,b)=>a-b);if(gs.length<2){host.innerHTML='<div class="empty">Progress chart will appear after two recorded gameweeks.</div>';return}
let ms=new Map;for(let gw of gs)for(let x of g.get(gw).rows){let id=String(x.entry_id);if(!ms.has(id))ms.set(id,{name:x.manager_name,pts:[]});ms.get(id).pts.push({gw,pos:+x.league_position})}
let top=[...ms.values()].sort((a,b)=>(a.pts.at(-1)?.pos||999)-(b.pts.at(-1)?.pos||999)).slice(0,8),max=Math.max(1,...top.flatMap(x=>x.pts.map(p=>p.pos))),W=900,H=330,L=46,R=48,T=24,B=44,X=gw=>L+gs.indexOf(gw)/(gs.length-1)*(W-L-R),Y=p=>T+(p-1)/Math.max(1,max-1)*(H-T-B),c=["#25d0d8","#b48cff","#55d98b","#ffd166","#ff7b9c","#79a7ff","#f6a85f","#c7d36f"],initials=n=>{let a=String(n||"").trim().split(/\s+/).filter(Boolean);return a.length?((a[0][0]||"")+(a.length>1?(a.at(-1)[0]||""):"")).toUpperCase():""},svg=`<svg viewBox="0 0 ${W} ${H}">`;
for(let gw of gs)svg+=`<text x="${X(gw)}" y="${H-16}" text-anchor="middle" class="chart-axis">GW${gw}</text>`;for(let p=1;p<=max;p++)svg+=`<line x1="${L}" y1="${Y(p)}" x2="${W-R}" y2="${Y(p)}" class="chart-grid"/><text x="${L-12}" y="${Y(p)+4}" text-anchor="end" class="chart-axis">${p}</text>`;
let endGroups=new Map;top.forEach((x,i)=>{let p=x.pts.at(-1),k=p?.pos;if(k==null)return;(endGroups.get(k)||endGroups.set(k,[]).get(k)).push(i)});let labelOffset=new Map;for(let ids of endGroups.values())ids.forEach((id,j)=>labelOffset.set(id,(j-(ids.length-1)/2)*11));
top.forEach((x,i)=>{svg+=`<polyline points="${x.pts.map(p=>X(p.gw)+","+Y(p.pos)).join(" ")}" fill="none" stroke="${c[i]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;x.pts.forEach(p=>svg+=`<circle cx="${X(p.gw)}" cy="${Y(p.pos)}" r="4" fill="${c[i]}"/>`);let p=x.pts.at(-1);if(p)svg+=`<text x="${X(p.gw)+9}" y="${Y(p.pos)+4+(labelOffset.get(i)||0)}" fill="${c[i]}" font-size="10" font-weight="900" paint-order="stroke" stroke="#121025" stroke-width="3" stroke-linejoin="round">${initials(x.name)}</text>`});svg+="</svg>";host.innerHTML=svg+`<div class="chart-legend">${top.map((x,i)=>`<span><i style="background:${c[i]}"></i>${x.name}</span>`).join("")}</div>`}catch(e){host.innerHTML='<div class="empty">Unable to load season progress.</div>'}}

const ukDate=v=>{let ps=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(v)),o={};ps.forEach(x=>o[x.type]=x.value);return `${o.year}-${o.month}-${o.day}`};
const moveCache=new Map;
async function matchdayMoves(){
  let lid=active(),latest=await j(root+"data/latest.json"),gw=+latest.gameweek,key=`${lid}:${latest.snapshot_date}:${gw}`;
  if(moveCache.has(key))return moveCache.get(key);
  let work=(async()=>{
    let [m,fixtures]=await Promise.all([
      j(root+"data/manifest.json"),
      j(`https://fpl-scheduler.kellenplayford.workers.dev/fixtures?event=${gw}`).catch(()=>null)
    ]);
    if(!Array.isArray(fixtures)||!fixtures.length)return null;
    let fixtureDates=[...new Set(fixtures.map(f=>f.kickoff_time?ukDate(f.kickoff_time):null).filter(Boolean))].sort(),cut=latest.snapshot_date;
    let targetDate=fixtureDates.filter(d=>d<=cut).at(-1);if(!targetDate)return null;
    let paths=(m.official_snapshots||[]).map(p=>({p,d:(String(p).match(/(\d{4}-\d{2}-\d{2})\.json$/)||[])[1]})).filter(x=>x.d);
    let target=paths.filter(x=>x.d===targetDate).at(-1),prior=paths.filter(x=>x.d<targetDate).sort((a,b)=>a.d.localeCompare(b.d)).at(-1);
    if(!target||!prior)return null;
    let [a,b]=await Promise.all([j(root+target.p),j(root+prior.p)]),la=a.leagues?.find(x=>String(x.league_id)===lid),lb=b.leagues?.find(x=>String(x.league_id)===lid);
    if(!la||!lb)return null;
    let before=new Map((lb.standings||[]).map(x=>[String(x.entry_id),+x.league_position])),moves=new Map;
    for(let x of la.standings||[]){let id=String(x.entry_id),p=before.get(id),c=+x.league_position;if(p&&c)moves.set(id,p-c)}
    return{moves,date:targetDate};
  })();moveCache.set(key,work);return work;
}
async function dailyMove(){
  let data;try{data=await matchdayMoves()}catch(e){return}if(!data)return;
  let head=document.querySelector(".desktop-table thead th:nth-child(5)");if(head){head.textContent="Daily move";head.title="Movement from the most recent matchday; held until the next matchday snapshot."}
  const paint=(el,d)=>{if(!el)return;el.textContent=d>0?`▲ ${d}`:d<0?`▼ ${Math.abs(d)}`:"—";el.classList.remove("up","down","same");el.classList.add(d>0?"up":d<0?"down":"same")};
  document.querySelectorAll("tr.manager-row[data-d]").forEach(r=>paint(r.querySelector("td:nth-child(5)"),data.moves.get(String(r.dataset.d))||0));
  document.querySelectorAll("article.manager-card[data-m]").forEach(c=>paint(c.querySelector(".manager-summary>div:nth-child(2)>.team-name span"),data.moves.get(String(c.dataset.m))||0));
}
function watchDailyMove(){let host=document.querySelector("#standings");if(!host||host.dataset.dailyMoveWatch)return;host.dataset.dailyMoveWatch="1";let t;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(()=>{dailyMove();decorateDetails()},30)}).observe(host,{childList:true,subtree:true});}



const archiveCache={promise:null};
async function archives(){
  if(archiveCache.promise)return archiveCache.promise;
  archiveCache.promise=(async()=>{
    let m=await j(root+"data/manifest.json");
    return (await Promise.all((m.official_snapshots||[]).map(p=>j(root+p).catch(()=>null)))).filter(Boolean);
  })();
  return archiveCache.promise;
}
function completedSnapshots(ss,lid,currentGw){
  let byGw=new Map,out=new Map;
  for(let s of ss){
    let gw=+s.gameweek,l=s.leagues?.find(x=>String(x.league_id)===String(lid));
    if(!gw||!l)continue;
    (byGw.get(gw)||byGw.set(gw,[]).get(gw)).push(s);
  }
  for(let [gw,candidates] of byGw){
    let hasFinalisation=candidates.some(s=>s.finalised_at||s.finalisation);
    if(gw===currentGw&&!hasFinalisation)continue;
    let chosen=candidates.slice().sort((a,b)=>new Date(b.generated_at||b.snapshot_date||0)-new Date(a.generated_at||a.snapshot_date||0))[0];
    out.set(gw,chosen);
  }
  return out;
}
async function currentGwConfirmed(){
  try{
    let latest=await j(root+"data/latest.json"),gw=+latest.gameweek,ss=await archives();
    return ss.some(s=>+s.gameweek===gw&&(s.finalised_at||s.finalisation));
  }catch(e){return false}
}
async function updatePointsLabels(){
  let confirmed=await currentGwConfirmed();
  let note=document.querySelector("#standings>div[style*='font-size:11px']");
  if(note&&/Live FPL standings/i.test(note.textContent||"")){
    let txt=confirmed?"FPL standings · confirmed. Records and Hall of Fame updated after finalisation.":"Live FPL standings · provisional. Records and Hall of Fame update after finalisation.";
    if(note.textContent!==txt)note.textContent=txt;
  }
  document.querySelectorAll(".detail-title").forEach(t=>{
    if(!/^Current squad/i.test(t.textContent||""))return;
    let span=t.querySelector("span");
    if(confirmed){
      if(!span){span=document.createElement("span");t.append(" · ",span)}
      if(span.textContent!=="FPL points · confirmed")span.textContent="FPL points · confirmed";
      if(span.style.color!=="rgb(85, 217, 139)")span.style.cssText="color:#55d98b;font-size:10px;font-weight:850";
    }else if(span){
      if(span.textContent!=="Live FPL points · provisional")span.textContent="Live FPL points · provisional";
      if(!span.style.cssText.includes("var(--cyan)"))span.style.cssText="color:var(--cyan);font-size:10px;font-weight:850";
    }
  });
}
async function managerPositionData(entryId){
  let lid=active(),latest=await j(root+"data/latest.json"),ss=await archives(),chosen=completedSnapshots(ss,lid,+latest.gameweek),pts=[],leagueSize=0;
  for(let [gw,s] of [...chosen.entries()].sort((a,b)=>a[0]-b[0])){
    let l=s.leagues?.find(x=>String(x.league_id)===String(lid));if(!l)continue;
    leagueSize=Math.max(leagueSize,(l.standings||[]).length);
    let r=(l.standings||[]).find(x=>String(x.entry_id)===String(entryId));
    if(r&&+r.league_position)pts.push({gw:+gw,pos:+r.league_position});
  }
  return{pts,leagueSize:Math.max(leagueSize,...pts.map(x=>x.pos),1)};
}
function ordinalPos(n){
  n=+n;let v=n%100,s=(v>=11&&v<=13)?"th":({1:"st",2:"nd",3:"rd"}[n%10]||"th");return `${n}${s}`;
}
function positionChartSvg(data){
  let {pts,leagueSize}=data,mobile=window.matchMedia("(max-width:680px)").matches,W=1000,H=mobile?190:150,L=mobile?42:38,R=18,T=mobile?24:18,B=30,orange="#f6a85f",grid="rgba(255,255,255,.08)",muted="#aaa5bd",X=gw=>L+(gw-1)/37*(W-L-R),Y=pos=>T+(pos-1)/Math.max(1,leagueSize-1)*(H-T-B);
  let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="League position from gameweek 1 to gameweek 38" style="width:100%;height:auto;display:block;overflow:visible">`;
  let yTicks=(mobile?[0,.25,.5,.75,1].map(f=>1+Math.round((leagueSize-1)*f)):[1,Math.max(1,Math.round((leagueSize+1)/2)),leagueSize]).filter((v,i,a)=>a.indexOf(v)===i);
  for(let y of yTicks)svg+=`<line x1="${L}" y1="${Y(y)}" x2="${W-R}" y2="${Y(y)}" stroke="${grid}" stroke-width="1"/><text x="${L-9}" y="${Y(y)+4}" text-anchor="end" fill="${muted}" font-size="10">${y}</text>`;
  for(let gw=1;gw<=38;gw++)svg+=`<line x1="${X(gw)}" y1="${T}" x2="${X(gw)}" y2="${H-B}" stroke="rgba(255,255,255,${gw%5===0||gw===1||gw===38?'.055':'.025'})" stroke-width="1"/>`;
  let labels=[1,5,10,15,20,25,30,35,38];for(let gw of labels)svg+=`<text x="${X(gw)}" y="${H-10}" text-anchor="middle" fill="${muted}" font-size="10">${gw}</text>`;
  if(pts.length){
    svg+=`<polyline points="${pts.map(p=>`${X(p.gw)},${Y(p.pos)}`).join(" ")}" fill="none" stroke="${orange}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    for(let p of pts)svg+=`<g class="manager-pos-point" data-gw="${p.gw}" data-pos="${p.pos}" tabindex="0" role="button" aria-label="Gameweek ${p.gw}, position ${ordinalPos(p.pos)}"><circle class="manager-pos-dot" cx="${X(p.gw)}" cy="${Y(p.pos)}" r="3.8" fill="${orange}"/><circle cx="${X(p.gw)}" cy="${Y(p.pos)}" r="16" fill="transparent" style="cursor:pointer;pointer-events:all"/></g>`;
    let p=pts.at(-1);svg+=`<circle cx="${X(p.gw)}" cy="${Y(p.pos)}" r="6.5" fill="none" stroke="${orange}" stroke-width="2" pointer-events="none"/><text x="${Math.min(W-R-2,X(p.gw)+10)}" y="${Math.max(12,Y(p.pos)-9)}" fill="${orange}" font-size="10" font-weight="900" pointer-events="none">GW${p.gw} · ${ordinalPos(p.pos)}</text>`;
  }
  return svg+"</svg>";
}
function bindPositionChart(host){
  if(!host||host.dataset.positionInteractive)return;host.dataset.positionInteractive="1";host.style.position="relative";
  let tip=document.createElement("div");tip.className="manager-position-tooltip";tip.style.cssText="position:absolute;z-index:5;display:none;pointer-events:none;background:#242039;border:1px solid rgba(246,168,95,.7);color:#fff;border-radius:8px;padding:6px 8px;font-size:10px;font-weight:850;white-space:nowrap;box-shadow:0 5px 16px rgba(0,0,0,.28)";host.appendChild(tip);
  let locked=null;
  const hide=()=>{if(!locked)tip.style.display="none"};
  const show=(g,lock=false)=>{let dot=g.querySelector(".manager-pos-dot");if(!dot)return;if(lock)locked=g;let dr=dot.getBoundingClientRect(),hr=host.getBoundingClientRect(),x=dr.left+dr.width/2-hr.left,y=dr.top+dr.height/2-hr.top,below=y<34;tip.textContent=`GW${g.dataset.gw} · ${ordinalPos(g.dataset.pos)}`;tip.style.display="block";let pad=42;tip.style.left=`${Math.max(pad,Math.min(hr.width-pad,x))}px`;tip.style.top=`${below?y+10:y-10}px`;tip.style.transform=below?"translate(-50%,0)":"translate(-50%,-100%)";};
  host.querySelectorAll(".manager-pos-point").forEach(g=>{
    g.addEventListener("mouseenter",()=>show(g));g.addEventListener("mouseleave",hide);
    g.addEventListener("focus",()=>show(g));g.addEventListener("blur",()=>{if(locked!==g)hide()});
    g.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();if(locked===g){locked=null;tip.style.display="none"}else show(g,true)});
  });
  host.addEventListener("click",e=>{if(!e.target.closest(".manager-pos-point")){locked=null;tip.style.display="none"}});
}
async function addManagerCharts(){
  let boxes=[...document.querySelectorAll("[data-detail],[data-mobile-detail]")].filter(b=>b.innerHTML.trim());
  for(let box of boxes){
    if(box.querySelector(".manager-season-position"))continue;
    let id=box.dataset.detail||box.dataset.mobileDetail;if(!id)continue;
    let wrap=document.createElement("div");wrap.className="manager-season-position";wrap.style.cssText="margin-top:18px;border:1px solid var(--line);border-radius:14px;padding:12px 12px 6px;background:rgba(18,16,37,.58);overflow:hidden";
    wrap.innerHTML='<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;margin-bottom:4px"><div><div style="color:#f6a85f;font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase">Season position</div><div style="color:var(--muted);font-size:11px;margin-top:2px">League position after each completed gameweek</div></div><div style="color:var(--muted);font-size:10px;white-space:nowrap;flex:0 0 auto">GW1–GW38</div></div><div class="manager-season-position-svg" style="min-height:92px"></div>';
    box.appendChild(wrap);
    try{let data=await managerPositionData(id),host=wrap.querySelector(".manager-season-position-svg");host.innerHTML=data.pts.length?positionChartSvg(data):'<div class="empty" style="padding:12px">No completed gameweek history yet.</div>';if(data.pts.length)bindPositionChart(host)}catch(e){wrap.remove()}
  }
}


// v3.8.0 — deadline-aware live gameweek squads.
// Historical records still come from archived snapshots. The current display switches
// only after FPL's official deadline and never decorates an old squad with new-GW fixtures.
const deadlineLive={activeGw:null,snapshotGw:null,afterDeadline:false,picksReady:false,pending:false,picks:new Map(),players:new Map(),retry:null};
window.FPL_DEADLINE_LIVE=deadlineLive;

const originalDisplayLeague=displayLeague;
const originalRemainingLabel=remainingLabel;
const originalSquadHTML=squadHTML;

function deadlineActiveEvent(events){
  const now=Date.now(),valid=(events||[]).filter(e=>e?.id&&e?.deadline_time&&!Number.isNaN(new Date(e.deadline_time).getTime()));
  const passed=valid.filter(e=>new Date(e.deadline_time).getTime()<=now).sort((a,b)=>+a.id-+b.id);
  return passed.at(-1)||valid.find(e=>e.is_current)||null;
}

async function fetchDeadlineBootstrap(){
  const r=await fetch('https://fpl-scheduler.kellenplayford.workers.dev/bootstrap',{cache:'no-store'});
  if(!r.ok)throw Error('bootstrap');
  const data=await r.json();
  if(!Array.isArray(data?.events)||!Array.isArray(data?.elements))throw Error('bootstrap-shape');
  deadlineLive.players=new Map(data.elements.map(x=>[String(x.id),{name:x.web_name||x.second_name||x.first_name||`Player ${x.id}`,team:+x.team}]));
  return data;
}

async function fetchDeadlinePicks(gw,entryIds){
  if(!gw||!entryIds.length)return null;
  const entries=entryIds.join(',');
  const urls=[
    `https://fpl-scheduler.kellenplayford.workers.dev/picks?event=${encodeURIComponent(gw)}&entries=${encodeURIComponent(entries)}`
  ];
  for(const url of urls){
    try{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
      const r=await fetch(url,{signal:controller.signal,cache:'no-store'});clearTimeout(timer);
      if(!r.ok)continue;
      const data=await r.json(),raw=data?.picks||data?.entries||data;
      const map=new Map();
      for(const id of entryIds){
        const d=raw?.[id]||raw?.[String(id)];
        if(d&&Array.isArray(d.picks)&&d.picks.length===15)map.set(String(id),d);
      }
      if(map.size===entryIds.length)return map;
    }catch(e){}
  }
  return null;
}

function currentSquadFromPicks(m,pickData){
  const eh=pickData?.entry_history||{},squad=(pickData?.picks||[]).map(p=>{
    const meta=deadlineLive.players.get(String(p.element))||{};
    return{
      element_id:+p.element,
      player:meta.name||`Player ${p.element}`,
      position:+p.position,
      multiplier:+p.multiplier||0,
      is_captain:!!p.is_captain,
      is_vice_captain:!!p.is_vice_captain,
      live_points:livePlayerPoints.has(String(p.element))?livePlayerPoints.get(String(p.element)):0
    };
  });
  const cap=squad.find(p=>p.is_captain),vice=squad.find(p=>p.is_vice_captain);
  const hit=+eh.event_transfers_cost||0;
  const liveGw=squad.reduce((sum,p)=>sum+(+p.live_points||0)*(+p.multiplier||0),0)-hit;
  const snapshotGw=+deadlineLive.snapshotGw||+latest.gameweek||0;
  const priorTotal=(+deadlineLive.activeGw===snapshotGw)?((+m.total_points||0)-(+m.gameweek_points||0)):(+m.total_points||0);
  return{
    ...m,
    squad,
    gameweek_points:liveGw,
    total_points:priorTotal+liveGw,
    gameweek_rank:+eh.rank||null,
    overall_rank:+eh.overall_rank||m.overall_rank,
    points_on_bench:+eh.points_on_bench||0,
    transfers:+eh.event_transfers||0,
    transfer_cost:hit,
    team_value:eh.value!=null?(+eh.value/10):m.team_value,
    bank:eh.bank!=null?(+eh.bank/10):m.bank,
    active_chip:pickData.active_chip||null,
    captain:cap?.player||'—',
    vice_captain:vice?.player||'—',
    automatic_subs:Array.isArray(pickData.automatic_subs)?pickData.automatic_subs:[],
    _live:true,
    _display_gameweek:+deadlineLive.activeGw
  };
}

// Replace the app's live overlay only when we have a complete set of locked picks.
displayLeague=function(){
  if(!deadlineLive.picksReady||!deadlineLive.activeGw||!deadlineLive.picks.size)return originalDisplayLeague();
  const base=leagueData();if(!base)return base;
  const standings=(base.standings||[]).map(m=>{
    const pd=deadlineLive.picks.get(String(m.entry_id));
    return pd?currentSquadFromPicks(m,pd):m;
  }).sort((a,b)=>(+b.total_points||0)-(+a.total_points||0)||(+b.gameweek_points||0)-(+a.gameweek_points||0));
  let lastScore=null,lastRank=0;
  standings.forEach((m,i)=>{if(lastScore===null||+m.total_points!==lastScore){lastRank=i+1;lastScore=+m.total_points}m.league_position=lastRank});
  return{...base,gameweek:+deadlineLive.activeGw,standings};
};

remainingLabel=function(m){
  if(deadlineLive.pending&&+deadlineLive.activeGw>+deadlineLive.snapshotGw)return'';
  return originalRemainingLabel(m);
};

squadHTML=function(m){
  if(deadlineLive.pending&&+deadlineLive.activeGw>+deadlineLive.snapshotGw){
    return `<div class="empty" style="padding:16px 0">GW${deadlineLive.activeGw} squad pending. Waiting for FPL to publish the locked picks.</div>`;
  }
  return originalSquadHTML(m);
};

function deadlineDisplayLabel(){
  if(deadlineLive.pending&&+deadlineLive.activeGw>+deadlineLive.snapshotGw)return{txt:`GW${deadlineLive.activeGw} · squad pending`,color:'#ffd166'};
  if(deadlineLive.picksReady&&+deadlineLive.activeGw>=+deadlineLive.snapshotGw){
    if(fixtureProgress?.status==='Not started')return{txt:`GW${deadlineLive.activeGw} squad · locked`,color:'#f6a85f'};
    if(fixtureProgress?.status==='Complete')return{txt:`GW${deadlineLive.activeGw} points · provisional`,color:'var(--cyan)'};
    return{txt:`GW${deadlineLive.activeGw} · live FPL points · provisional`,color:'var(--cyan)'};
  }
  return null;
}

// v3.8.0 owns the current-squad status wording. Confirmed means the displayed GW,
// not merely the latest archived snapshot, has a finalisation marker.
updatePointsLabels=async function(){
  let display=deadlineDisplayLabel(),confirmed=false;
  if(!display){
    try{
      let d=await j(root+'data/latest.json'),ss=await archives(),gw=+d.gameweek;
      confirmed=ss.some(s=>+s.gameweek===gw&&(s.finalised_at||s.finalisation));
    }catch(e){}
  }
  let note=document.querySelector("#standings>div[style*='font-size:11px']");
  if(deadlineLive.pending&&+deadlineLive.activeGw>+deadlineLive.snapshotGw){
    if(!note){note=document.createElement('div');note.style.cssText='color:var(--muted);font-size:11px;margin:0 0 10px';document.querySelector('#standings')?.prepend(note)}
    if(note)note.textContent=`GW${deadlineLive.activeGw} squads pending · showing last confirmed league totals. No current-GW player status is shown until squads load.`;
  }else if(note&&deadlineLive.picksReady){
    note.textContent=`GW${deadlineLive.activeGw} live FPL standings · provisional. Records and Hall of Fame update after finalisation.`;
  }else if(note&&/Live FPL standings/i.test(note.textContent||'')){
    note.textContent=confirmed?'FPL standings · confirmed. Records and Hall of Fame updated after finalisation.':'Live FPL standings · provisional. Records and Hall of Fame update after finalisation.';
  }
  const stampEl=document.querySelector('#standingsSnapshotNote');
  if(stampEl){
    if(deadlineLive.pending&&+deadlineLive.activeGw>+deadlineLive.snapshotGw)stampEl.textContent=`GW${deadlineLive.activeGw} live · squads pending · last confirmed standings retained`;
    else if(deadlineLive.picksReady)stampEl.textContent=`GW${deadlineLive.activeGw} live FPL standings · provisional`;
    else if(liveDisplay&&fixtureProgress?.gameweek)stampEl.textContent=(confirmed&&fixtureProgress.status==='Complete')?`GW${fixtureProgress.gameweek} confirmed standings · FPL finalised`:`GW${fixtureProgress.gameweek} live FPL standings · provisional`;
  }
  document.querySelectorAll('.detail-title').forEach(t=>{
    if(!/^Current squad/i.test(t.textContent||''))return;
    let span=t.querySelector('span');
    const state=display||(confirmed?{txt:'FPL points · confirmed',color:'#55d98b'}:null);
    if(!state)return;
    if(!span){span=document.createElement('span');t.append(' · ',span)}
    span.textContent=state.txt;span.style.cssText=`color:${state.color};font-size:10px;font-weight:850`;
  });
};

function decoratePendingHero(){
  if(!(deadlineLive.pending&&+deadlineLive.activeGw>+deadlineLive.snapshotGw))return;
  const status=document.querySelector('#hero .hero-current-status'),sub=document.querySelector('#hero .hero-current-sub');
  if(status)status.textContent=fixtureProgress?.started>0?'LIVE':'LOCKED';
  if(sub)sub.textContent=`GW${deadlineLive.activeGw} squads pending from FPL · last confirmed league totals shown below`;
  const cards=[...document.querySelectorAll('#hero .hero-mini')];
  if(cards[0]){let l=cards[0].querySelector('.hero-label');if(l)l.textContent='Last confirmed leader'}
  if(cards[1]){let l=cards[1].querySelector('.hero-label'),v=cards[1].querySelector('.hero-mini-value'),x=cards[1].querySelector('.hero-sub');if(l)l.textContent=`GW${deadlineLive.activeGw} league average`;if(v)v.textContent='—';if(x)x.textContent='Squads pending'}
  if(cards[2]){let l=cards[2].querySelector('.hero-label'),v=cards[2].querySelector('.hero-mini-value'),x=cards[2].querySelector('.hero-mini-stat');if(l)l.textContent=`GW${deadlineLive.activeGw} high score`;if(v)v.textContent='—';if(x)x.textContent='Squads pending'}
}

function updateStandingsStamp(){
  const e=document.querySelector('#standingsSnapshotNote');if(!e)return;
  if(deadlineLive.pending&&+deadlineLive.activeGw>+deadlineLive.snapshotGw){
    e.textContent=`GW${deadlineLive.activeGw} live · squads pending · last confirmed standings retained`;
  }else if(deadlineLive.picksReady&&fixtureProgress?.gameweek){
    e.textContent=`GW${fixtureProgress.gameweek} live FPL standings · provisional`;
  }
}

function renderDeadlineState(){
  hero();decoratePendingHero();renderRecap();standings();updateStandingsStamp();
  setTimeout(()=>{dailyMove();decorateDetails();updateStandingsStamp();decoratePendingHero()},30);
}

async function deadlineGameweekFix(){
  clearTimeout(deadlineLive.retry);
  try{
    const boot=await fetchDeadlineBootstrap(),event=deadlineActiveEvent(boot.events);
    if(!event)return;
    deadlineLive.activeGw=+event.id;deadlineLive.snapshotGw=+latest.gameweek||0;deadlineLive.afterDeadline=new Date(event.deadline_time).getTime()<=Date.now();
    // Before the next deadline, keep the last confirmed snapshot exactly as before.
    // If the snapshot has already caught up to the active GW, the app's normal live
    // overlay is safe; only clarify that the standings are live/provisional.
    if(!deadlineLive.afterDeadline||deadlineLive.activeGw<=deadlineLive.snapshotGw){updateStandingsStamp();return}
    const fixtures=await fetchFixtures(deadlineLive.activeGw);
    if(fixtures?.length){fixtureProgress=summariseFixtures(fixtures,deadlineLive.activeGw);liveFixtures=fixtures}
    deadlineLive.pending=true;deadlineLive.picksReady=false;liveDisplay=false;livePlayerPoints=new Map();
    renderDeadlineState();
    const base=leagueData(),ids=(base?.standings||[]).map(m=>String(m.entry_id));
    const picks=await fetchDeadlinePicks(deadlineLive.activeGw,ids);
    if(!picks){
      renderDeadlineState();
      deadlineLive.retry=setTimeout(deadlineGameweekFix,60000);
      return;
    }
    deadlineLive.picks=picks;deadlineLive.pending=false;deadlineLive.picksReady=true;
    await fetchLivePoints(deadlineLive.activeGw);
    liveDisplay=true;
    renderDeadlineState();
  }catch(e){
    if(+deadlineLive.activeGw>+deadlineLive.snapshotGw){deadlineLive.pending=true;liveDisplay=false;renderDeadlineState()}
    deadlineLive.retry=setTimeout(deadlineGameweekFix,60000);
  }
}

function decorateDetails(){updatePointsLabels();addManagerCharts()}

function section(){if(document.querySelector("#seasonProgressSection"))return;let s=document.querySelector(".standings-section");if(!s)return;let n=document.createElement("section");n.className="section";n.id="seasonProgressSection";n.innerHTML='<div class="section-head"><div><div class="eyebrow">Season so far</div><h2>League position progress</h2></div><div class="section-note">Top 8 current managers</div></div><div id="seasonProgressChart" class="progress-chart"></div>';s.before(n)}
addEventListener("load",()=>setTimeout(()=>{let w=wanted();if(w){let b=document.querySelector(`.tab[data-id="${w}"]`);if(b&&!b.classList.contains("active"))b.click()}document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>setTimeout(()=>{chart();dailyMove();deadlineGameweekFix()},50)));section();stamp();chart();watchDailyMove();dailyMove();decorateDetails();deadlineGameweekFix();setTimeout(deadlineGameweekFix,4500);setTimeout(deadlineGameweekFix,7500)},300))})();
