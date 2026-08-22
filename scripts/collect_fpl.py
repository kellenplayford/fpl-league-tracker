#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SNAPSHOTS = DATA / "snapshots"
TEST = DATA / "test"
TZ = ZoneInfo("Europe/London")
BASE = "https://fantasy.premierleague.com/api"

LEAGUES = [
    {"id": 37546, "name": "Sexy Pickford", "slug": "sexy-pickford"},
    {"id": 118082, "name": "The Battle Continues", "slug": "the-battle-continues"},
]

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "fpl-league-tracker/1.0 (+https://github.com/kellenplayford/fpl-league-tracker)",
    "Accept": "application/json,text/plain,*/*",
})

def get_json(url: str, retries: int = 3):
    last = None
    for attempt in range(retries):
        try:
            r = SESSION.get(url, timeout=30)
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            last = exc
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Failed to fetch {url}: {last}")

def current_gameweek(bootstrap):
    events = bootstrap.get("events", [])
    for e in events:
        if e.get("is_current"):
            return int(e["id"])
    started = [e for e in events if e.get("started")]
    if started:
        return int(started[-1]["id"])
    return 1

def league_rows(league_id: int):
    page = 1
    rows = []
    league_meta = {}
    while True:
        url = f"{BASE}/leagues-classic/{league_id}/standings/?page_standings={page}"
        payload = get_json(url)
        league_meta = payload.get("league", league_meta)
        standings = payload.get("standings", {})
        rows.extend(standings.get("results", []))
        if not standings.get("has_next"):
            break
        page += 1
        if page > 20:
            raise RuntimeError(f"Unexpected pagination for league {league_id}")
    return league_meta, rows

def manager_history(entry_id: int):
    return get_json(f"{BASE}/entry/{entry_id}/history/")

def manager_picks(entry_id: int, gw: int):
    return get_json(f"{BASE}/entry/{entry_id}/event/{gw}/picks/")

def build_manager(row, gw, players_by_id, live_points):
    entry_id = int(row["entry"])
    history_payload = manager_history(entry_id)
    current_rows = history_payload.get("current", [])
    gw_hist = next((x for x in current_rows if int(x.get("event", -1)) == gw), {})
    try:
        picks_payload = manager_picks(entry_id, gw)
    except Exception:
        picks_payload = {}

    entry_hist = picks_payload.get("entry_history", {}) or {}
    merged_hist = {**gw_hist, **entry_hist}
    picks = picks_payload.get("picks", []) or []

    squad = []
    captain = None
    vice_captain = None
    for pick in picks:
        pid = int(pick["element"])
        pdata = players_by_id.get(pid, {})
        item = {
            "element_id": pid,
            "player": pdata.get("web_name"),
            "position": pick.get("position"),
            "multiplier": pick.get("multiplier"),
            "is_captain": bool(pick.get("is_captain")),
            "is_vice_captain": bool(pick.get("is_vice_captain")),
            "live_points": live_points.get(pid),
        }
        squad.append(item)
        if item["is_captain"]:
            captain = item["player"]
        if item["is_vice_captain"]:
            vice_captain = item["player"]

    value = merged_hist.get("value")
    bank = merged_hist.get("bank")

    return {
        "entry_id": entry_id,
        "manager_name": row.get("player_name"),
        "team_name": row.get("entry_name"),
        "league_position": row.get("rank"),
        "previous_league_position": row.get("last_rank"),
        "gameweek_points": row.get("event_total"),
        "total_points": row.get("total"),
        "overall_rank": merged_hist.get("overall_rank"),
        "gameweek_rank": merged_hist.get("rank"),
        "points_on_bench": merged_hist.get("points_on_bench"),
        "transfers": merged_hist.get("event_transfers"),
        "transfer_cost": merged_hist.get("event_transfers_cost"),
        "team_value": (value / 10) if isinstance(value, (int, float)) else None,
        "bank": (bank / 10) if isinstance(bank, (int, float)) else None,
        "active_chip": picks_payload.get("active_chip"),
        "captain": captain,
        "vice_captain": vice_captain,
        "automatic_subs": picks_payload.get("automatic_subs", []),
        "squad": squad,
    }

def calculate_days_top(history):
    totals = {}
    streaks = {}
    for day in sorted(history.get("days", []), key=lambda x: x["date"]):
        for league_id, info in day.get("leagues", {}).items():
            entry = str(info.get("leader_entry_id") or info.get("leader_manager"))
            key = (league_id, entry)
            totals[key] = totals.get(key, 0) + 1
            s = streaks.setdefault(key, {"current": 0, "longest": 0, "last_date": None})
            if s["last_date"]:
                from datetime import date, timedelta
                prev = date.fromisoformat(s["last_date"])
                curr = date.fromisoformat(day["date"])
                if curr - prev == timedelta(days=1):
                    s["current"] += 1
                else:
                    s["current"] = 1
            else:
                s["current"] = 1
            s["longest"] = max(s["longest"], s["current"])
            s["last_date"] = day["date"]

    out = {}
    for (league_id, entry), days in totals.items():
        out.setdefault(league_id, {})[entry] = {
            "days_top": days,
            "longest_streak": streaks[(league_id, entry)]["longest"],
        }
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["test", "official"], default="test")
    args = ap.parse_args()

    now = datetime.now(TZ)

    # Scheduled workflow runs at both 22:30 and 23:30 UTC so this keeps
    # exactly the run that lands within the UK 23:00 hour in BST or GMT.
    if args.mode == "official" and now.hour != 23:
        print(f"Not UK 23:xx ({now.isoformat()}); no official snapshot required.")
        return 0

    bootstrap = get_json(f"{BASE}/bootstrap-static/")
    gw = current_gameweek(bootstrap)
    players_by_id = {int(p["id"]): p for p in bootstrap.get("elements", [])}

    live_payload = get_json(f"{BASE}/event/{gw}/live/")
    live_points = {
        int(x["id"]): (x.get("stats") or {}).get("total_points")
        for x in live_payload.get("elements", [])
    }

    snapshot = {
        "status": "ok",
        "mode": args.mode,
        "generated_at": now.isoformat(),
        "snapshot_date": now.date().isoformat(),
        "gameweek": gw,
        "leagues": [],
    }

    for league in LEAGUES:
        meta, rows = league_rows(league["id"])
        managers = []
        for row in rows:
            managers.append(build_manager(row, gw, players_by_id, live_points))
            time.sleep(0.08)

        managers.sort(key=lambda x: (x.get("league_position") or 999999, -(x.get("total_points") or 0)))
        snapshot["leagues"].append({
            "league_id": league["id"],
            "league_name": meta.get("name") or league["name"],
            "manager_count": len(managers),
            "standings": managers,
        })

    if args.mode == "test":
        TEST.mkdir(parents=True, exist_ok=True)
        (TEST / "latest-test.json").write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
        print(f"Test collection succeeded for {len(snapshot['leagues'])} leagues.")
        return 0

    SNAPSHOTS.mkdir(parents=True, exist_ok=True)
    date_str = now.date().isoformat()
    snapshot_path = SNAPSHOTS / f"{date_str}.json"
    snapshot_path.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
    (DATA / "latest.json").write_text(json.dumps(snapshot, indent=2), encoding="utf-8")

    history_path = DATA / "history.json"
    history = json.loads(history_path.read_text(encoding="utf-8"))
    history["days"] = [d for d in history.get("days", []) if d.get("date") != date_str]

    day = {"date": date_str, "source": "automatic-23:30-snapshot", "leagues": {}}
    for league in snapshot["leagues"]:
        standings = league["standings"]
        if not standings:
            continue
        leader = standings[0]
        day["leagues"][str(league["league_id"])] = {
            "league_name": league["league_name"],
            "leader_entry_id": leader["entry_id"],
            "leader_manager": leader["manager_name"],
            "leader_team": leader["team_name"],
            "leader_points": leader["total_points"],
            "leader_overall_rank": leader["overall_rank"],
        }

    history["days"].append(day)
    history["days"].sort(key=lambda x: x["date"])
    history["days_top"] = calculate_days_top(history)
    history_path.write_text(json.dumps(history, indent=2), encoding="utf-8")

    manifest_path = DATA / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    names = sorted(set(manifest.get("official_snapshots", []) + [f"data/snapshots/{date_str}.json"]))
    manifest["official_snapshots"] = names
    manifest["latest"] = "data/latest.json"
    manifest["updated_at"] = now.isoformat()
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"Official snapshot saved for {date_str}.")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
