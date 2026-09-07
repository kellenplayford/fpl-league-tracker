#!/usr/bin/env python3
from __future__ import annotations

import json
from datetime import datetime, date, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
import requests

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SNAPSHOTS = DATA / "snapshots"
HISTORY = DATA / "history.json"
BASE = "https://fantasy.premierleague.com/api"
TZ = ZoneInfo("Europe/London")
S = requests.Session()
S.headers.update({"User-Agent":"fpl-league-tracker-history-audit/1.0","Accept":"application/json"})

def get_json(url):
    r=S.get(url,timeout=30)
    r.raise_for_status()
    return r.json()

def load_snapshots():
    snaps={}
    for p in sorted(SNAPSHOTS.glob("*.json")):
        s=json.loads(p.read_text())
        ds=s.get("snapshot_date") or p.stem
        snaps[ds]=(p,s)
    return snaps

def final_fixture_dates():
    boot=get_json(f"{BASE}/bootstrap-static/")
    out={}
    for ev in boot.get("events",[]):
        gw=int(ev["id"])
        fixtures=get_json(f"{BASE}/fixtures/?event={gw}")
        kickoffs=[f.get("kickoff_time") for f in fixtures if f.get("kickoff_time")]
        if not kickoffs:
            continue
        local_dates=[
            datetime.fromisoformat(k.replace("Z","+00:00")).astimezone(TZ).date()
            for k in kickoffs
        ]
        out[gw]=max(local_dates)
    return out

def league_map(snap):
    return {str(l.get("league_id")):l for l in snap.get("leagues",[])}

def standings_by_entry(league):
    return {str(m.get("entry_id")):m for m in league.get("standings",[]) if m.get("entry_id") is not None}

def material_changes(early, final):
    changes=[]
    e_leagues=league_map(early); f_leagues=league_map(final)
    for lid,fl in f_leagues.items():
        el=e_leagues.get(lid)
        if not el: continue
        em=standings_by_entry(el); fm=standings_by_entry(fl)
        for eid,new in fm.items():
            old=em.get(eid)
            if not old: continue
            fields=("gameweek_points","total_points","league_position","overall_rank","gameweek_rank","points_on_bench")
            diffs={k:(old.get(k),new.get(k)) for k in fields if old.get(k)!=new.get(k)}
            if diffs:
                changes.append((lid,eid,new.get("manager_name"),diffs))
    return changes

def copy_finalised_standings(target_snap, final_snap):
    f_leagues=league_map(final_snap)
    for target_league in target_snap.get("leagues",[]):
        lid=str(target_league.get("league_id"))
        if lid in f_leagues:
            target_league["standings"]=f_leagues[lid].get("standings",[])
            target_league["manager_count"]=f_leagues[lid].get("manager_count",len(target_league["standings"]))
            target_league["league_name"]=f_leagues[lid].get("league_name",target_league.get("league_name"))

def build_name_id_map(snaps):
    result={}
    for _,snap in snaps.values():
        for lg in snap.get("leagues",[]):
            for m in lg.get("standings",[]):
                name=m.get("manager_name"); eid=m.get("entry_id")
                if name and eid is not None:
                    result.setdefault(name,int(eid))
    return result

def leader_info(league,name_ids):
    standings=league.get("standings") or []
    if not standings: return None
    top=max((m.get("total_points") or 0) for m in standings)
    tied=[m for m in standings if (m.get("total_points") or 0)==top]
    leaders=[]
    for m in tied:
        eid=m.get("entry_id")
        if eid is None:
            eid=name_ids.get(m.get("manager_name"))
        leaders.append({"entry_id":eid,"manager":m.get("manager_name"),"team":m.get("team_name"),"points":m.get("total_points"),"overall_rank":m.get("overall_rank")})
    lead=leaders[0]
    return {"league_name":league.get("league_name"),
            "leader_entry_id":lead.get("entry_id"),"leader_manager":lead.get("manager"),
            "leader_team":lead.get("team"),"leader_points":lead.get("points"),
            "leader_overall_rank":lead.get("overall_rank"),
            "leader_count":len(leaders),"leaders":leaders}

def days_top(history,name_ids):
    totals={}; streaks={}
    for day in sorted(history.get("days",[]),key=lambda x:x["date"]):
        curr=date.fromisoformat(day["date"])
        for lid,info in day.get("leagues",{}).items():
            leaders=info.get("leaders") or []
            for leader in leaders:
                eid=leader.get("entry_id")
                if eid is None: eid=name_ids.get(leader.get("manager"),leader.get("manager"))
                key=(lid,str(eid))
                totals[key]=totals.get(key,0)+1
                s=streaks.setdefault(key,{"current":0,"longest":0,"last":None})
                consecutive=s["last"] and curr-date.fromisoformat(s["last"])==timedelta(days=1)
                s["current"]=s["current"]+1 if consecutive else 1
                s["longest"]=max(s["longest"],s["current"]); s["last"]=day["date"]
    out={}
    for (lid,eid),n in totals.items():
        out.setdefault(lid,{})[eid]={"days_top":n,"longest_streak":streaks[(lid,eid)]["longest"]}
    return out

def rebuild_history(snaps):
    history=json.loads(HISTORY.read_text())
    old_days={d.get("date"):d for d in history.get("days",[]) if d.get("date")}
    name_ids=build_name_id_map(snaps)
    rebuilt=[]
    for ds,(path,snap) in sorted(snaps.items()):
        old=old_days.get(ds,{})
        day={"date":ds,"source":old.get("source") or snap.get("source") or "historical-rebuild","leagues":{}}
        if old.get("notes"): day["notes"]=old["notes"]
        for lg in snap.get("leagues",[]):
            info=leader_info(lg,name_ids)
            if info: day["leagues"][str(lg.get("league_id"))]=info
        rebuilt.append(day)
    history["days"]=rebuilt
    history["days_top"]=days_top(history,name_ids)
    history["official_snapshot_time"]="03:15 overnight + 09:05 Europe/London finalisation"
    HISTORY.write_text(json.dumps(history,indent=2)+"\n")

def main():
    snaps=load_snapshots()
    if not snaps: raise RuntimeError("No archived snapshots found")
    final_dates=final_fixture_dates()
    repaired=[]; checked=[]

    for gw,final_day in sorted(final_dates.items()):
        ds=final_day.isoformat()
        if ds not in snaps: continue
        target_path,target=snaps[ds]
        if int(target.get("gameweek") or -1)!=gw: continue

        # Use the next archived calendar day with the same GW as a post-finalisation reference.
        ref=None
        for offset in range(1,4):
            nd=(final_day+timedelta(days=offset)).isoformat()
            if nd in snaps and int(snaps[nd][1].get("gameweek") or -1)==gw:
                ref=snaps[nd][1]; break
        if ref is None:
            print(f"GW{gw}: {ds} has no later same-GW archive to audit yet.")
            continue

        changes=material_changes(target,ref)
        checked.append((gw,ds,len(changes)))
        if changes:
            copy_finalised_standings(target,ref)
            target["historical_finalisation_repair"]={
                "audited_against_snapshot_date":ref.get("snapshot_date"),
                "repaired_fields_from_later_official_snapshot":True,
            }
            target_path.write_text(json.dumps(target,indent=2)+"\n")
            repaired.append((gw,ds,changes))
            snaps[ds]=(target_path,target)

    rebuild_history(snaps)

    print("Historical completed-GW audit:")
    for gw,ds,count in checked:
        print(f"- GW{gw} final day {ds}: {count} manager records differed after FPL finalisation")
    if repaired:
        print("Repairs applied:")
        for gw,ds,changes in repaired:
            print(f"- GW{gw} {ds}: repaired {len(changes)} manager records")
            for lid,eid,name,diffs in changes:
                print(f"  league {lid} | {name} ({eid}) | {diffs}")
    else:
        print("No historical final-day score/position repairs were required.")
    print("History rebuilt with canonical entry IDs, tie-aware leaders, and recalculated day/streak totals.")

if __name__=="__main__":
    main()
