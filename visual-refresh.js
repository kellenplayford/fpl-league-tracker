/* FPL League Tracker visual hierarchy refresh v3.9.0 */
(() => {
  const STYLE_ID = 'fpl-visual-refresh-v390';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* ---- Page rhythm and section architecture ---- */
      .section{margin-top:64px}
      .recap-section{margin-top:42px}
      .section.visual-section,
      .visual-subsection{
        position:relative;
        border:1px solid var(--line);
        border-radius:24px;
        padding:26px;
        overflow:hidden;
        box-shadow:0 18px 50px rgba(0,0,0,.16)
      }
      .section.visual-section::before,
      .visual-subsection::before{
        content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--section-accent,var(--cyan));opacity:.9
      }
      .visual-purple{--section-accent:#b48cff;background:linear-gradient(145deg,rgba(139,92,246,.10),rgba(18,16,37,.94) 32%,rgba(18,16,37,.98))}
      .visual-cyan{--section-accent:#25d0d8;background:linear-gradient(145deg,rgba(37,208,216,.085),rgba(18,16,37,.94) 32%,rgba(18,16,37,.98))}
      .visual-gold{--section-accent:#ffd166;background:linear-gradient(145deg,rgba(255,209,102,.075),rgba(18,16,37,.94) 32%,rgba(18,16,37,.98))}
      .visual-green{--section-accent:#55d98b;background:linear-gradient(145deg,rgba(85,217,139,.07),rgba(18,16,37,.94) 32%,rgba(18,16,37,.98))}
      .visual-blue{--section-accent:#79a7ff;background:linear-gradient(145deg,rgba(121,167,255,.075),rgba(18,16,37,.94) 32%,rgba(18,16,37,.98))}

      .section-head{align-items:flex-end;margin-bottom:22px}
      .section-head .eyebrow{font-size:11px;letter-spacing:.15em;margin-bottom:5px;color:var(--section-accent,var(--cyan))}
      .section-head h2{font-size:clamp(29px,2.7vw,38px);line-height:1;letter-spacing:-.04em;margin:0}
      .visual-section-subtitle{margin-top:7px;color:var(--muted);font-size:13px;line-height:1.4}
      .section-head>.section-note{font-size:12px;padding-bottom:3px}

      /* Recap is a major chapter too */
      .recap-shell{padding:24px;border-radius:24px;border-color:rgba(37,208,216,.34)}
      .recap-head{margin-bottom:18px}
      .recap-head h2{font-size:clamp(27px,2.5vw,35px);line-height:1;letter-spacing:-.035em}
      .recap-head .eyebrow{font-size:11px;letter-spacing:.14em;margin-bottom:5px}

      /* Split the two middle sections into clear chapters */
      .lower-stats{gap:58px}
      .lower-stats.visual-section-group{margin-top:64px}
      .lower-stats.visual-section-group>.visual-subsection{padding:26px}

      /* ---- Hall of Fame: useful records first, full book on demand ---- */
      .visual-record-hidden{display:none!important}
      .record-book-controls{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:18px}
      .record-book-toggle{
        appearance:none;border:1px solid rgba(180,140,255,.46);background:rgba(139,92,246,.10);color:var(--text);
        border-radius:999px;padding:10px 16px;font:inherit;font-size:11px;font-weight:900;letter-spacing:.055em;text-transform:uppercase;cursor:pointer
      }
      .record-book-toggle:hover{background:rgba(139,92,246,.18);border-color:rgba(180,140,255,.72)}
      .record-book-count{color:var(--muted);font-size:11px}
      .other-records{margin-top:0}

      /* ---- Expanded manager should look nested, not like more table ---- */
      .desktop-detail-cell{background:transparent!important;padding:0 22px 22px!important}
      .desktop-detail{
        position:relative;margin:0;border:1px solid rgba(37,208,216,.28)!important;border-left:4px solid var(--cyan)!important;
        border-radius:0 0 18px 18px!important;padding:24px!important;
        background:linear-gradient(135deg,rgba(37,208,216,.075),rgba(33,28,62,.94) 34%,rgba(18,16,37,.98))!important;
        box-shadow:0 18px 35px rgba(0,0,0,.20)!important
      }
      .manager-row.expanded-parent{background:linear-gradient(90deg,rgba(37,208,216,.14),rgba(139,92,246,.055))!important}
      .manager-row.expanded-parent td{border-bottom-color:rgba(37,208,216,.28)}
      .desktop-detail .profile-top{padding-bottom:17px;margin-bottom:18px;border-bottom:1px solid rgba(255,255,255,.075)}
      .desktop-detail .profile-name{font-size:28px}
      .desktop-detail .detail-grid{gap:10px}
      .desktop-detail .detail-item{background:rgba(9,7,22,.34);border:1px solid rgba(255,255,255,.045);padding:11px}
      .desktop-detail .detail-section{margin-top:24px;padding-top:18px;border-top:1px solid rgba(255,255,255,.075)}
      .desktop-detail .detail-title,
      .manager-detail .detail-title{
        color:var(--text);font-size:12px;letter-spacing:.11em;margin-bottom:12px;display:flex;align-items:center;gap:8px
      }
      .desktop-detail .detail-title::before,
      .manager-detail .detail-title::before{content:"";display:block;width:3px;height:14px;border-radius:4px;background:var(--cyan)}
      .desktop-detail .manager-form-guide{margin-top:22px;padding:17px;border-color:rgba(37,208,216,.34);background:linear-gradient(135deg,rgba(13,54,65,.52),rgba(18,16,37,.72))}
      .desktop-detail .manager-season-position{margin-top:24px!important;border-color:rgba(121,167,255,.24)!important;background:rgba(9,7,22,.30)!important;padding:16px 16px 8px!important}
      .desktop-detail .manager-season-position>div:first-child>div:first-child>div:first-child{font-size:12px!important;color:#79a7ff!important}

      /* Mobile expanded cards */
      .manager-card.open{border-color:rgba(37,208,216,.45);box-shadow:0 16px 34px rgba(0,0,0,.18)}
      .manager-card.open .manager-summary{background:linear-gradient(90deg,rgba(37,208,216,.12),rgba(139,92,246,.05))}
      .manager-card.open .manager-detail{margin:0 8px 10px;border:1px solid rgba(37,208,216,.22);border-left:3px solid var(--cyan);border-radius:0 0 14px 14px;background:linear-gradient(145deg,rgba(37,208,216,.055),rgba(18,16,37,.97));padding:14px}
      .manager-detail .detail-section{margin-top:22px;padding-top:16px;border-top:1px solid rgba(255,255,255,.07)}

      /* ---- Charts ---- */
      #seasonProgressChart{padding:18px;background:rgba(9,7,22,.26);border-color:rgba(121,167,255,.20)}

      @media(max-width:980px){
        .section{margin-top:54px}
        .lower-stats.visual-section-group{margin-top:54px}
        .section.visual-section,.visual-subsection{padding:22px}
        .lower-stats.visual-section-group>.visual-subsection{padding:22px}
      }
      @media(max-width:680px){
        .shell{width:calc(100% - 18px)}
        .section{margin-top:46px}
        .recap-section{margin-top:34px}
        .lower-stats.visual-section-group{margin-top:46px;gap:46px}
        .section.visual-section,.visual-subsection{border-radius:19px;padding:16px 13px}
        .lower-stats.visual-section-group>.visual-subsection{padding:16px 13px}
        .section-head{margin-bottom:17px;align-items:flex-start}
        .section-head .eyebrow{font-size:10px;margin-bottom:5px}
        .section-head h2{font-size:27px}
        .visual-section-subtitle{font-size:12px;margin-top:5px}
        .recap-shell{padding:16px 13px;border-radius:19px}
        .recap-head h2{font-size:27px}
        .record-book-controls{display:block;text-align:center}
        .record-book-count{display:block;margin-bottom:8px}
        .record-book-toggle{width:100%;padding:11px 14px}
        .record-context{font-size:11px;line-height:1.35}
        #seasonProgressChart{padding:12px 8px 14px;min-height:330px}
        #seasonProgressChart svg{min-height:245px;width:100%;height:245px}
        #seasonProgressChart .chart-legend{margin-top:12px;gap:8px 12px;line-height:1.25}
        .manager-card.open .manager-detail{margin:0 6px 8px;padding:12px}
        .manager-detail .profile-name{font-size:23px}
        .manager-detail .manager-form-guide{margin-top:18px}
      }
    `;
    document.head.appendChild(style);
  }

  const setText = (el, value) => { if (el && el.textContent !== value) el.textContent = value; };

  const setHeading = (root, eyebrow, title, subtitle) => {
    if (!root) return;
    const head = root.querySelector(':scope > .section-head') || root.querySelector('.section-head');
    if (!head) return;
    const left = head.firstElementChild;
    if (!left) return;
    const eye = left.querySelector('.eyebrow');
    const h2 = left.querySelector('h2');
    if (eye && eyebrow) setText(eye, eyebrow);
    if (h2 && title) setText(h2, title);
    let sub = left.querySelector('.visual-section-subtitle');
    if (!sub && subtitle) {
      sub = document.createElement('div');
      sub.className = 'visual-section-subtitle';
      left.appendChild(sub);
    }
    if (sub && subtitle) setText(sub, subtitle);
  };

  const decorateSections = () => {
    const hallRecords = document.getElementById('otherRecords');
    const hall = hallRecords?.closest('.section');
    if (hall) {
      hall.classList.add('visual-section','visual-purple');
      setHeading(hall,'RECORD BOOK','Hall of Fame','Season records from completed gameweeks');
      const note = hall.querySelector(':scope > .section-head > .section-note');
      if (note) setText(note, 'Completed gameweeks only');
    }

    const lower = document.querySelector('.lower-stats');
    if (lower) {
      lower.classList.add('visual-section-group');
      const parts = [...lower.children];
      if (parts[0]) {
        parts[0].classList.add('visual-subsection','visual-blue');
        setHeading(parts[0],'WEEK BY WEEK','Gameweek Winners','Every weekly winner this season');
      }
      if (parts[1]) {
        parts[1].classList.add('visual-subsection','visual-gold');
        setHeading(parts[1],'LEAGUE LEADERS','Bragging Rights','Calendar days spent at No. 1');
      }
    }

    const season = document.getElementById('seasonProgressSection');
    if (season) {
      season.classList.add('visual-section','visual-cyan');
      setHeading(season,'SEASON SO FAR','Season Progress','League position after each completed gameweek');
    }

    const standings = document.querySelector('.standings-section');
    if (standings) {
      standings.classList.add('visual-section','visual-green');
      setHeading(standings,'LEAGUE TABLE','Current Standings','Select a manager to explore form, squad, chips, and season stats');
    }
  };

  const preferredRecordLabels = new Set([
    'Best GW score','Most GW wins','Best GW rank','Best overall rank','Biggest GW margin',
    'Best Single Triple Captain','Best Single Bench Boost','Best Single Captain Score',
    'Most Combined Captain Points','Biggest GW Climb'
  ]);
  let recordsExpanded = false;

  const decorateRecords = () => {
    const grid = document.getElementById('otherRecords');
    if (!grid) return;
    const records = [...grid.querySelectorAll(':scope > .record')];
    if (!records.length) return;

    records.forEach((card, i) => {
      const label = card.querySelector('.record-label')?.textContent.trim() || '';
      const preferred = preferredRecordLabels.has(label);
      card.dataset.visualPreferred = preferred ? '1' : '0';
      card.classList.toggle('visual-record-hidden', !recordsExpanded && !preferred);
    });

    const hall = grid.closest('.section');
    if (!hall) return;
    let controls = hall.querySelector('.record-book-controls');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'record-book-controls';
      controls.innerHTML = '<span class="record-book-count"></span><button type="button" class="record-book-toggle"></button>';
      grid.insertAdjacentElement('afterend', controls);
      controls.querySelector('button').addEventListener('click', () => {
        recordsExpanded = !recordsExpanded;
        decorateRecords();
      });
    }
    const visible = records.filter(r => r.dataset.visualPreferred === '1').length;
    setText(controls.querySelector('.record-book-count'), recordsExpanded ? `${records.length} records shown` : `${visible} featured records`);
    const btn = controls.querySelector('.record-book-toggle');
    setText(btn, recordsExpanded ? 'Show featured records ↑' : `View all ${records.length} records ↓`);
    btn.setAttribute('aria-expanded', recordsExpanded ? 'true' : 'false');
  };

  const decorateExpandedManagers = () => {
    document.querySelectorAll('.manager-row.expanded-parent').forEach(r => r.classList.remove('expanded-parent'));
    document.querySelectorAll('.desktop-detail-row.open').forEach(detailRow => {
      const parent = detailRow.previousElementSibling;
      if (parent?.classList.contains('manager-row')) parent.classList.add('expanded-parent');
    });
  };

  let scheduled = false;
  const enhance = () => {
    scheduled = false;
    decorateSections();
    decorateRecords();
    decorateExpandedManagers();
  };
  const scheduleEnhance = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  };

  const start = () => {
    enhance();
    const target = document.querySelector('main.shell') || document.body;
    new MutationObserver(scheduleEnhance).observe(target,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    window.addEventListener('resize', scheduleEnhance, {passive:true});
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
