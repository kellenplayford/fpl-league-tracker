#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, sys, time
from datetime import datetime, date, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
import requests

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"; SNAPSHOTS=DATA/"snapshots"; TEST=DATA/"test"
TZ=ZoneInfo("Europe/London"); BASE="https://fantasy.premierleague.com/api"
LEAGUES=[{"id":37546,"name":"Sexy Pickford"},{"id":118082,"name":"The Battle Continues"}]
S=requests.Session()
S.headers.update({"User-Agent":"fpl-league-tracker/2.1","Accept":"application/json,text/plain,*/*"})

def get_json(url,retries=4):
    last=None
    for attempt in range(retries):
        try:
            r=S.get(url,timeout=30); r.raise_for_status(); return r.json()
        except Exception as exc:
            last=exc
            if attempt<retries-1: time.sleep(2**attempt)
    raise RuntimeError(f"Failed to fetch {url}: {last}")

def current_gw(bootstrap):
    for e in bootstrap.get("events",[]):
        if e.get("is_current"): return int(e["id"])
    started=[e for e in bootstrap.get("events",[]) if e.get("started")]
    return int(started[-1]["id"]) if started else 1

def league_rows(lid):
    page=1; rows=[]; meta={}
    while True:
        p=get_json(f"{BASE}/leagues-classic/{lid}/standings/?page_standings={page}")
        meta=p.get("league",meta); st=p.get("standings",{}); rows+=st.get("results",[])
        if not st.get("has_next"): return meta,rows
        page+=1

def build_manager(row,gw,players,live):
    eid=int(row["entry"])
    hist=get_json(f"{BASE}/entry/{eid}/history/").get("current",[])
    gw_hist=next((x for x in hist if int(x.get("event",-1))==gw),{})
    try: picks=get_json(f"{BASE}/entry/{eid}/event/{gw}/picks/")
    except Exception: picks={}
    merged={**gw_hist, **(picks.get("entry_history",{}) or {})}
    squad=[]; captain=None; vice=None
    for p in picks.get("picks",[]) or []:
        pid=int(p["element"]); name=players.get(pid,{}).get("web_name")
        item={"element_id":pid,"player":name,"position":p.get("position"),"multiplier":p.get("multiplier"),
              "is_captain":bool(p.get("is_captain")),"is_vice_captain":bool(p.get("is_vice_captain")),
              "live_points":live.get(pid)}
        squad.append(item)
        if item["is_captain"]: captain=name
        if item["is_vice_captain"]: vice=name
    value,bank=merged.get("value"),merged.get("bank")
    return {"entry_id":eid,"manager_name":row.get("player_name"),"team_name":row.get("entry_name"),
      "league_position":row.get("rank"),"previous_league_position":row.get("last_rank"),
      "gameweek_points":row.get("event_total"),"total_points":row.get("total"),
      "overall_rank":merged.get("overall_rank"),"gameweek_rank":merged.get("rank"),
      "points_on_bench":merged.get("points_on_bench"),"transfers":merged.get("event_transfers"),
      "transfer_cost":merged.get("event_transfers_cost"),
      "team_value":value/10 if isinstance(value,(int,float)) else None,
      "bank":bank/10 if isinstance(bank,(int,float)) else None,
      "active_chip":picks.get("active_chip"),"captain":captain,"vice_captain":vice,
      "automatic_subs":picks.get("automatic_subs",[]),"squad":squad}

def days_top(history):
    totals={}; streaks={}
    for day in sorted(history.get("days",[]),key=lambda x:x["date"]):
        for lid,info in day.get("leagues",{}).items():
            e=str(info.get("leader_entry_id") or info.get("leader_manager")); key=(lid,e)
            totals[key]=totals.get(key,0)+1
            s=streaks.setdefault(key,{"current":0,"longest":0,"last":None})
            curr=date.fromisoformat(day["date"])
            s["current"]=s["current"]+1 if s["last"] and curr-date.fromisoformat(s["last"])==timedelta(days=1) else 1
            s["longest"]=max(s["longest"],s["current"]); s["last"]=day["date"]
    out={}
    for (lid,e),n in totals.items():
        out.setdefault(lid,{})[e]={"days_top":n,"longest_streak":streaks[(lid,e)]["longest"]}
    return out

def collect(mode, snapshot_date):
    now=datetime.now(TZ)
    b=get_json(f"{BASE}/bootstrap-static/"); gw=current_gw(b)
    players={int(p["id"]):p for p in b.get("elements",[])}
    livep=get_json(f"{BASE}/event/{gw}/live/")
    live={int(x["id"]):(x.get("stats") or {}).get("total_points") for x in livep.get("elements",[])}
    snap={"status":"ok","mode":mode,"generated_at":now.isoformat(),
          "snapshot_date":snapshot_date.isoformat(),"gameweek":gw,"leagues":[]}
    for league in LEAGUES:
        meta,rows=league_rows(league["id"]); managers=[]
        for row in rows:
            managers.append(build_manager(row,gw,players,live)); time.sleep(.05)
        managers.sort(key=lambda x:(x.get("league_position") or 999999,-(x.get("total_points") or 0)))
        snap["leagues"].append({"league_id":league["id"],"league_name":meta.get("name") or league["name"],
                                "manager_count":len(managers),"standings":managers})
    return now,snap

def save_official(now,snap,source):
    SNAPSHOTS.mkdir(parents=True,exist_ok=True)
    ds=snap["snapshot_date"]; path=SNAPSHOTS/f"{ds}.json"

    # Replace any existing snapshot for the logical snapshot date.
    snap["mode"]="official"; path.write_text(json.dumps(snap,indent=2))
    (DATA/"latest.json").write_text(json.dumps(snap,indent=2))

    hp=DATA/"history.json"; h=json.loads(hp.read_text())
    day={"date":ds,"source":source,"leagues":{}}
    for lg in snap["leagues"]:
        if not lg["standings"]: continue
        lead=lg["standings"][0]
        day["leagues"][str(lg["league_id"])]={"league_name":lg["league_name"],"leader_entry_id":lead["entry_id"],
          "leader_manager":lead["manager_name"],"leader_team":lead["team_name"],"leader_points":lead["total_points"],
          "leader_overall_rank":lead["overall_rank"]}

    h["days"]=[d for d in h.get("days",[]) if d.get("date")!=ds]+[day]
    h["days"].sort(key=lambda x:x["date"]); h["days_top"]=days_top(h); hp.write_text(json.dumps(h,indent=2))

    mp=DATA/"manifest.json"; m=json.loads(mp.read_text()); name=f"data/snapshots/{ds}.json"
    m["official_snapshots"]=sorted(set(m.get("official_snapshots",[])+[name]))
    m["latest"]="data/latest.json"; m["updated_at"]=now.isoformat()
    mp.write_text(json.dumps(m,indent=2))
    print(f"Official snapshot saved/replaced for {ds}.")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--mode",choices=["test","scheduled","official"],default="test")
    args=ap.parse_args()

    now=datetime.now(TZ)

    if args.mode=="scheduled":
        # Scheduled overnight runs belong to the PREVIOUS UK calendar day.
        # This is deliberately independent of GitHub's actual start time.
        snapshot_date=now.date()-timedelta(days=1)
        source="automatic-overnight-snapshot"
    else:
        snapshot_date=now.date()
        source="manual-official-snapshot"

    now,snap=collect(args.mode,snapshot_date)

    if args.mode=="test":
        TEST.mkdir(parents=True,exist_ok=True)
        (TEST/"latest-test.json").write_text(json.dumps(snap,indent=2))
        print(f"Test collection succeeded for {snapshot_date.isoformat()}.")
        return 0

    save_official(now,snap,source)
    return 0

if __name__=="__main__":
    try: raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}",file=sys.stderr); raise
