(()=>{
  const STYLE_ID='manager-form-guide-styles';

  function ensureStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .manager-form-guide{margin:16px 0 0;border:1px solid rgba(37,208,216,.28);border-radius:14px;padding:14px;background:linear-gradient(135deg,rgba(13,54,65,.38),rgba(18,16,37,.72))}
      .manager-form-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:12px}
      .manager-form-kicker{color:var(--cyan);font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
      .manager-form-rank{font-size:24px;font-weight:950;letter-spacing:-.03em;margin-top:3px}
      .manager-form-rank span{color:var(--muted);font-size:12px;font-weight:800;letter-spacing:0}
      .manager-form-summary{text-align:right;color:var(--muted);font-size:11px;line-height:1.35}
      .manager-form-summary strong{display:block;color:var(--text);font-size:16px;font-weight:950}
      .manager-form-weeks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
      .manager-form-week{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid var(--line);border-radius:10px;padding:9px 10px;background:rgba(18,16,37,.72)}
      .manager-form-gw{color:var(--muted);font-size:10px;font-weight:850}
      .manager-form-points{font-size:16px;font-weight:950}
      .manager-form-compare{color:var(--muted);font-size:11px;margin-top:10px}
      .manager-form-compare strong{color:#55d98b}
      .manager-form-compare.below strong{color:#ff7b9c}
      .manager-form-compare.level strong{color:var(--text)}
      .manager-form-leader{display:inline-block;margin-left:6px;color:#ffd166;font-size:10px;font-weight:900;vertical-align:middle}
      @media(max-width:680px){
        .manager-form-guide{padding:12px}
        .manager-form-rank{font-size:21px}
        .manager-form-week{display:block;padding:8px}
        .manager-form-points{margin-top:2px}
      }
    `;
    document.head.appendChild(style);
  }

  function formData(entryId){
    if(typeof recapData!=='function'||typeof completedRows!=='function')return null;
    const recap=recapData(),gws=(recap?.formGws||[]).map(Number);
    if(!gws.length)return null;

    const rows=completedRows().filter(r=>gws.includes(+r.gameweek));
    const totals=new Map(),weekly=new Map();
    for(const r of rows){
      const id=String(r.entry_id),net=(+r.gameweek_points||0)-(+r.transfer_cost||0);
      totals.set(id,(totals.get(id)||0)+net);
      if(!weekly.has(id))weekly.set(id,new Map());
      weekly.get(id).set(+r.gameweek,net);
    }

    const id=String(entryId);
    if(!totals.has(id)||!totals.size)return null;
    const total=totals.get(id),values=[...totals.values()],rank=1+values.filter(v=>v>total).length;
    const leagueAverage=values.reduce((a,b)=>a+b,0)/values.length;
    const difference=total-leagueAverage;
    return{
      gws,total,rank,count:values.length,
      average:total/gws.length,
      difference,
      weekly:gws.map(gw=>({gw,points:weekly.get(id)?.get(gw)}))
    };
  }

  function ordinal(n){
    n=+n;const v=n%100;
    if(v>=11&&v<=13)return`${n}th`;
    return`${n}${({1:'st',2:'nd',3:'rd'}[n%10]||'th')}`;
  }

  function guideHtml(d){
    const roundedDiff=Math.round(d.difference),compareClass=roundedDiff>0?'above':roundedDiff<0?'below':'level';
    const compareText=roundedDiff===0?'Level with league average':`${roundedDiff>0?'+':''}${roundedDiff} pts vs league average`;
    const weeks=d.weekly.map(x=>`<div class="manager-form-week"><span class="manager-form-gw">GW${x.gw}</span><span class="manager-form-points">${x.points==null?'—':x.points}</span></div>`).join('');
    return`<div class="manager-form-guide">
      <div class="manager-form-head">
        <div>
          <div class="manager-form-kicker">3-gameweek form</div>
          <div class="manager-form-rank">${ordinal(d.rank)} <span>of ${d.count}</span>${d.rank===1?'<span class="manager-form-leader">FORM LEADER</span>':''}</div>
        </div>
        <div class="manager-form-summary"><strong>${d.total} pts</strong>${d.average.toFixed(1)} average</div>
      </div>
      <div class="manager-form-weeks">${weeks}</div>
      <div class="manager-form-compare ${compareClass}"><strong>${compareText}</strong> over the last ${d.gws.length} completed GW${d.gws.length===1?'':'s'}</div>
    </div>`;
  }

  function addGuides(){
    ensureStyles();
    document.querySelectorAll('[data-detail],[data-mobile-detail]').forEach(box=>{
      if(!box.innerHTML.trim()||box.querySelector('.manager-form-guide'))return;
      const id=box.dataset.detail||box.dataset.mobileDetail;
      if(!id)return;
      const d=formData(id);if(!d)return;
      const grid=box.querySelector('.detail-grid,.mobile-detail-grid');
      if(!grid)return;
      grid.insertAdjacentHTML('afterend',guideHtml(d));
    });
  }

  function watch(){
    const host=document.querySelector('#standings');
    if(!host||host.dataset.formGuideWatch)return;
    host.dataset.formGuideWatch='1';
    let timer;
    new MutationObserver(()=>{
      clearTimeout(timer);
      timer=setTimeout(addGuides,25);
    }).observe(host,{childList:true,subtree:true});
    addGuides();
  }

  addEventListener('load',()=>setTimeout(watch,350));
})();
