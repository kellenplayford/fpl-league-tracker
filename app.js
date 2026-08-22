const LEAGUES = [
  {id:"37546", name:"Sexy Pickford"},
  {id:"118082", name:"The Battle Continues"}
];
let active = "37546";
let latest = null;
let history = null;

const fmt = n => (n === null || n === undefined) ? "—" : Number(n).toLocaleString("en-GB");

async function loadJson(path){
  const r = await fetch(path + "?v=" + Date.now());
  if(!r.ok) throw new Error(path);
  return r.json();
}

function leagueData(){
  return latest?.leagues?.find(l => String(l.league_id) === active);
}

function daysTopForLeague(){
  const counts = {};
  for(const day of (history?.days || [])){
    const l = day.leagues?.[active];
    if(!l) continue;
    const key = String(l.leader_entry_id || l.leader_manager);
    if(!counts[key]) counts[key] = {name:l.leader_manager, team:l.leader_team, days:0};
    counts[key].days++;
  }
  return Object.values(counts).sort((a,b)=>b.days-a.days || a.name.localeCompare(b.name));
}

function renderTabs(){
  document.querySelector("#tabs").innerHTML = LEAGUES.map(l =>
    `<button class="tab ${l.id===active?"active":""}" data-id="${l.id}">${l.name}</button>`
  ).join("");
  document.querySelectorAll(".tab").forEach(b => b.onclick = () => {active=b.dataset.id; render();});
}

function render(){
  renderTabs();
  const l = leagueData();
  const top = daysTopForLeague();
  const leader = l?.standings?.[0];
  const historyLeader = [...(history?.days||[])].reverse().find(d=>d.leagues?.[active])?.leagues?.[active];

  document.querySelector("#metrics").innerHTML = `
    <div class="card"><div class="label">Current leader</div><div class="metric">${leader?.manager_name || historyLeader?.leader_manager || "—"}</div><div class="small">${leader?.team_name || historyLeader?.leader_team || ""}</div></div>
    <div class="card"><div class="label">Leader points</div><div class="metric">${fmt(leader?.total_points ?? historyLeader?.leader_points)}</div><div class="small">FPL total</div></div>
    <div class="card"><div class="label">Most days No. 1</div><div class="metric">${top[0]?.days ?? 0}</div><div class="small">${top[0]?.name || "—"}</div></div>
    <div class="card"><div class="label">Managers</div><div class="metric">${fmt(l?.manager_count)}</div><div class="small">${l ? "latest snapshot" : "awaiting collection"}</div></div>
  `;

  const rows = l?.standings || [];
  document.querySelector("#standings").innerHTML = rows.length ? `
    <div class="table-wrap"><table>
      <thead><tr><th>Pos</th><th>Manager</th><th>Team</th><th>GW</th><th>Total</th><th>Overall rank</th><th>Captain</th><th>Value</th></tr></thead>
      <tbody>${rows.map((m,i)=>`
        <tr class="${i===0?"leader":""}">
          <td class="pos">${fmt(m.league_position)}</td>
          <td>${m.manager_name || "—"}</td>
          <td>${m.team_name || "—"}</td>
          <td>${fmt(m.gameweek_points)}</td>
          <td><strong>${fmt(m.total_points)}</strong></td>
          <td>${fmt(m.overall_rank)}</td>
          <td>${m.captain || "—"}</td>
          <td>${m.team_value ? "£"+Number(m.team_value).toFixed(1)+"m" : "—"}</td>
        </tr>`).join("")}</tbody>
    </table></div>` :
    `<div class="note">The website is ready. Run the GitHub Action once in <strong>test</strong> mode to prove the FPL connection, then once in <strong>official</strong> mode if you want to populate today's live table immediately. The 23:30 scheduled snapshot will run automatically thereafter.</div>`;

  document.querySelector("#daysTop").innerHTML = top.length ?
    `<div class="top-list">${top.map((x,i)=>`<div class="top-row"><span><strong>${i+1}. ${x.name}</strong><span class="small"> · ${x.team || ""}</span></span><strong>${x.days} day${x.days===1?"":"s"}</strong></div>`).join("")}</div>` :
    `<div class="note">No leader history yet.</div>`;

  const days = (history?.days||[]).filter(d=>d.leagues?.[active]).slice().reverse();
  document.querySelector("#dailyHistory").innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Leader</th><th>Team</th><th>Points</th><th>Overall rank</th><th>Source</th></tr></thead>
      <tbody>${days.map(d=>{const x=d.leagues[active];return `<tr><td>${d.date}</td><td>${x.leader_manager}</td><td>${x.leader_team||"—"}</td><td>${fmt(x.leader_points)}</td><td>${fmt(x.leader_overall_rank)}</td><td>${d.source}</td></tr>`}).join("")}</tbody>
    </table></div>`;

  document.querySelector("#updated").textContent = latest?.generated_at
    ? `Latest data: ${new Date(latest.generated_at).toLocaleString("en-GB")}`
    : "Awaiting first automated collection";
}

(async function(){
  try{latest = await loadJson("data/latest.json");}catch(e){latest={};}
  try{history = await loadJson("data/history.json");}catch(e){history={days:[]};}
  render();
})();
