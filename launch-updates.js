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
function positionChartSvg(data){
  let {pts,leagueSize}=data,W=1000,H=150,L=38,R=18,T=18,B=30,orange="#f6a85f",grid="rgba(255,255,255,.08)",muted="#aaa5bd",X=gw=>L+(gw-1)/37*(W-L-R),Y=pos=>T+(pos-1)/Math.max(1,leagueSize-1)*(H-T-B);
  let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="League position from gameweek 1 to gameweek 38" style="width:100%;height:auto;display:block">`;
  let yTicks=[1,Math.max(1,Math.round((leagueSize+1)/2)),leagueSize].filter((v,i,a)=>a.indexOf(v)===i);
  for(let y of yTicks)svg+=`<line x1="${L}" y1="${Y(y)}" x2="${W-R}" y2="${Y(y)}" stroke="${grid}" stroke-width="1"/><text x="${L-9}" y="${Y(y)+4}" text-anchor="end" fill="${muted}" font-size="10">${y}</text>`;
  for(let gw=1;gw<=38;gw++)svg+=`<line x1="${X(gw)}" y1="${T}" x2="${X(gw)}" y2="${H-B}" stroke="rgba(255,255,255,${gw%5===0||gw===1||gw===38?'.055':'.025'})" stroke-width="1"/>`;
  let labels=[1,5,10,15,20,25,30,35,38];for(let gw of labels)svg+=`<text x="${X(gw)}" y="${H-10}" text-anchor="middle" fill="${muted}" font-size="10">${gw}</text>`;
  if(pts.length){
    svg+=`<polyline points="${pts.map(p=>`${X(p.gw)},${Y(p.pos)}`).join(" ")}" fill="none" stroke="${orange}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    for(let p of pts)svg+=`<circle cx="${X(p.gw)}" cy="${Y(p.pos)}" r="3.5" fill="${orange}"/>`;
    let p=pts.at(-1);svg+=`<circle cx="${X(p.gw)}" cy="${Y(p.pos)}" r="6" fill="none" stroke="${orange}" stroke-width="2"/><text x="${Math.min(W-R-2,X(p.gw)+10)}" y="${Math.max(12,Y(p.pos)-9)}" fill="${orange}" font-size="10" font-weight="900">GW${p.gw} · ${p.pos}${p.pos===1?'st':p.pos===2?'nd':p.pos===3?'rd':'th'}</text>`;
  }
  return svg+"</svg>";
}
async function addManagerCharts(){
  let boxes=[...document.querySelectorAll("[data-detail],[data-mobile-detail]")].filter(b=>b.innerHTML.trim());
  for(let box of boxes){
    if(box.querySelector(".manager-season-position"))continue;
    let id=box.dataset.detail||box.dataset.mobileDetail;if(!id)continue;
    let wrap=document.createElement("div");wrap.className="manager-season-position";wrap.style.cssText="margin-top:18px;border:1px solid var(--line);border-radius:14px;padding:12px 12px 6px;background:rgba(18,16,37,.58);overflow:hidden";
    wrap.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;margin-bottom:4px"><div><div style="color:#f6a85f;font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase">Season position</div><div style="color:var(--muted);font-size:11px;margin-top:2px">League position after each completed gameweek</div></div><div style="color:var(--muted);font-size:10px">GW1–GW38</div></div><div class="manager-season-position-svg" style="min-height:92px"></div>';
    box.appendChild(wrap);
    try{let data=await managerPositionData(id);wrap.querySelector(".manager-season-position-svg").innerHTML=data.pts.length?positionChartSvg(data):'<div class="empty" style="padding:12px">No completed gameweek history yet.</div>'}catch(e){wrap.remove()}
  }
}
function decorateDetails(){updatePointsLabels();addManagerCharts()}

function section(){if(document.querySelector("#seasonProgressSection"))return;let s=document.querySelector(".standings-section");if(!s)return;let n=document.createElement("section");n.className="section";n.id="seasonProgressSection";n.innerHTML='<div class="section-head"><div><div class="eyebrow">Season so far</div><h2>League position progress</h2></div><div class="section-note">Top 8 current managers</div></div><div id="seasonProgressChart" class="progress-chart"></div>';s.before(n)}
addEventListener("load",()=>setTimeout(()=>{let w=wanted();if(w){let b=document.querySelector(`.tab[data-id="${w}"]`);if(b&&!b.classList.contains("active"))b.click()}document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>setTimeout(()=>{chart();dailyMove()},50)));section();stamp();chart();watchDailyMove();dailyMove();decorateDetails()},300))})();
