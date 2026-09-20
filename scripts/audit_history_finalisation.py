#!/usr/bin/env python3
from __future__ import annotations
import json
from datetime import datetime,date,timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
import requests
ROOT=Path(__file__).resolve().parents[1]; DATA=ROOT/"data"; SNAPSHOTS=DATA/"snapshots"; HISTORY=DATA/"history.json"
BASE="https://fantasy.premierleague.com/api"; TZ=ZoneInfo("Europe/London")
S=requests.Session(); S.headers.update({"User-Agent":"fpl-league-tracker-history-audit/1.1","Accept":"application/json"})
FINAL_FIELDS=("gameweek_points","total_points","league_position","previous_league_position","overall_rank","gameweek_rank","points_on_bench","automatic_subs","squad")
def get_json(url):
    r=S.get(url,timeout=30); r.raise_for_status(); return r.json()
def load_snapshots():
    out={}
    for p in sorted(SNAPSHOTS.glob("*.json")):
        s=json.loads(p.read_text()); out[s.get("snapshot_date") or p.stem]=(p,s)
    return out
def final_fixture_dates():
    out={}
    for ev in get_json(f"{BASE}/bootstrap-static/").get("events",[]):
        gw=int(ev["id"]); fs=get_json(f"{BASE}/fixtures/?event={gw}"); ks=[f.get("kickoff_time") for f in fs if f.get("kickoff_time")]
        if ks: out[gw]=max(datetime.fromisoformat(k.replace("Z","+00:00")).astimezone(TZ).date() for k in ks)
    return out
def league_map(s): return {str(l.get("league_id")):l for l in s.get("leagues",[])}
def by_entry(l): return {str(m.get("entry_id")):m for m in l.get("standings",[]) if m.get("entry_id") is not None}
def material_changes(a,b):
    changes=[]
    for lid,bl in league_map(b).items():
        al=league_map(a).get(lid)
        if not al: continue
        am,bm=by_entry(al),by_entry(bl)
        for eid,new in bm.items():
            old=am.get(eid)
            if not old: continue
            diffs={k:(old.get(k),new.get(k)) for k in FINAL_FIELDS if old.get(k)!=new.get(k)}
            if diffs: changes.append((lid,eid,new.get("manager_name"),diffs))
    return changes
def merge_finalised_fields(target,final):
    fm=league_map(final)
    for tl in target.get("leagues",[]):
        fl=fm.get(str(tl.get("league_id")))
        if not fl: continue
        final_people=by_entry(fl)
        for m in tl.get("standings",[]):
            f=final_people.get(str(m.get("entry_id")))
            if not f: continue
            for k in FINAL_FIELDS:
                if k in f: m[k]=f[k]
def name_ids(snaps):
    out={}
    for _,s in snaps.values():
        for l in s.get("leagues",[]):
            for m in l.get("standings",[]):
                if m.get("manager_name") and m.get("entry_id") is not None: out.setdefault(m["manager_name"],int(m["entry_id"]))
    return out
def leader_info(l,ids):
    rows=l.get("standings") or []
    if not rows:return None
    top=max((m.get("total_points") or 0) for m in rows); tied=[m for m in rows if (m.get("total_points") or 0)==top]; leaders=[]
    for m in tied:
        eid=m.get("entry_id") if m.get("entry_id") is not None else ids.get(m.get("manager_name"))
        leaders.append({"entry_id":eid,"manager":m.get("manager_name"),"team":m.get("team_name"),"points":m.get("total_points"),"overall_rank":m.get("overall_rank")})
    x=leaders[0]
    return {"league_name":l.get("league_name"),"leader_entry_id":x["entry_id"],"leader_manager":x["manager"],"leader_team":x["team"],"leader_points":x["points"],"leader_overall_rank":x["overall_rank"],"leader_count":len(leaders),"leaders":leaders}
def days_top(h,ids):
    totals={}; streaks={}
    for d in sorted(h.get("days",[]),key=lambda x:x["date"]):
        curr=date.fromisoformat(d["date"])
        for lid,info in d.get("leagues",{}).items():
            for lead in info.get("leaders") or []:
                eid=lead.get("entry_id")
                if eid is None:eid=ids.get(lead.get("manager"),lead.get("manager"))
                key=(lid,str(eid)); totals[key]=totals.get(key,0)+1; s=streaks.setdefault(key,{"current":0,"longest":0,"last":None})
                s["current"]=s["current"]+1 if s["last"] and curr-date.fromisoformat(s["last"])==timedelta(days=1) else 1
                s["longest"]=max(s["longest"],s["current"]); s["last"]=d["date"]
    out={}
    for (lid,eid),n in totals.items(): out.setdefault(lid,{})[eid]={"days_top":n,"longest_streak":streaks[(lid,eid)]["longest"]}
    return out
def rebuild(snaps):
    h=json.loads(HISTORY.read_text()); old={d.get("date"):d for d in h.get("days",[]) if d.get("date")}; ids=name_ids(snaps); days=[]
    for ds,(p,s) in sorted(snaps.items()):
        od=old.get(ds,{}); d={"date":ds,"source":od.get("source") or s.get("source") or "historical-rebuild","leagues":{}}
        if od.get("notes"):d["notes"]=od["notes"]
        for l in s.get("leagues",[]):
            info=leader_info(l,ids)
            if info:d["leagues"][str(l.get("league_id"))]=info
        days.append(d)
    h["days"]=days; h["days_top"]=days_top(h,ids); h["official_snapshot_time"]="03:15 overnight + 10:30 Europe/London finalisation"
    HISTORY.write_text(json.dumps(h,indent=2)+"\n")
def main():
    snaps=load_snapshots()
    if not snaps:raise RuntimeError("No archived snapshots found")
    repaired=[]
    for gw,fd in sorted(final_fixture_dates().items()):
        ds=fd.isoformat()
        if ds not in snaps:continue
        p,target=snaps[ds]
        if int(target.get("gameweek") or -1)!=gw:continue
        ref=None
        for off in range(1,4):
            nd=(fd+timedelta(days=off)).isoformat()
            if nd in snaps and int(snaps[nd][1].get("gameweek") or -1)==gw:ref=snaps[nd][1];break
        if ref is None:continue
        changes=material_changes(target,ref)
        if changes:
            merge_finalised_fields(target,ref); target["historical_finalisation_repair"]={"audited_against_snapshot_date":ref.get("snapshot_date"),"selective_finalised_field_merge":True}
            p.write_text(json.dumps(target,indent=2)+"\n"); snaps[ds]=(p,target); repaired.append((gw,ds,len(changes)))
    rebuild(snaps)
    print("Audit complete. Selective finalised-field merge enabled; metadata uses 10:30 finalisation.")
    for x in repaired:print(f"GW{x[0]} {x[1]}: repaired {x[2]} manager records")
if __name__=="__main__":main()
