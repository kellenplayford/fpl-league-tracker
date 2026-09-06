#!/usr/bin/env python3
from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SNAPSHOTS = DATA / "snapshots"
HISTORY = DATA / "history.json"


def build_leader_info(league):
    standings = league.get("standings") or []
    if not standings:
        return None

    top_points = max((m.get("total_points") or 0) for m in standings)
    tied = [m for m in standings if (m.get("total_points") or 0) == top_points]

    leaders = [
        {
            "entry_id": m.get("entry_id"),
            "manager": m.get("manager_name"),
            "team": m.get("team_name"),
            "points": m.get("total_points"),
            "overall_rank": m.get("overall_rank"),
        }
        for m in tied
    ]

    lead = tied[0]
    return {
        "league_name": league.get("league_name"),
        "leader_entry_id": lead.get("entry_id"),
        "leader_manager": lead.get("manager_name"),
        "leader_team": lead.get("team_name"),
        "leader_points": lead.get("total_points"),
        "leader_overall_rank": lead.get("overall_rank"),
        "leader_count": len(leaders),
        "leaders": leaders,
    }


def day_leaders(info):
    leaders = info.get("leaders")
    if isinstance(leaders, list) and leaders:
        return leaders

    if info.get("leader_entry_id") is not None or info.get("leader_manager"):
        return [{
            "entry_id": info.get("leader_entry_id"),
            "manager": info.get("leader_manager"),
            "team": info.get("leader_team"),
            "points": info.get("leader_points"),
            "overall_rank": info.get("leader_overall_rank"),
        }]
    return []


def days_top(history):
    totals = {}
    streaks = {}

    for day in sorted(history.get("days", []), key=lambda x: x["date"]):
        curr = date.fromisoformat(day["date"])

        for lid, info in day.get("leagues", {}).items():
            for leader in day_leaders(info):
                eid = str(leader.get("entry_id") or leader.get("manager"))
                key = (lid, eid)

                totals[key] = totals.get(key, 0) + 1

                s = streaks.setdefault(
                    key, {"current": 0, "longest": 0, "last": None}
                )

                consecutive = (
                    s["last"]
                    and curr - date.fromisoformat(s["last"]) == timedelta(days=1)
                )

                s["current"] = s["current"] + 1 if consecutive else 1
                s["longest"] = max(s["longest"], s["current"])
                s["last"] = day["date"]

    out = {}
    for (lid, eid), total in totals.items():
        out.setdefault(lid, {})[eid] = {
            "days_top": total,
            "longest_streak": streaks[(lid, eid)]["longest"],
        }

    return out


def main():
    history = json.loads(HISTORY.read_text())
    old_days = {
        d.get("date"): d
        for d in history.get("days", [])
        if d.get("date")
    }

    rebuilt = []
    tie_report = []

    snapshot_files = sorted(SNAPSHOTS.glob("*.json"))
    if not snapshot_files:
        raise RuntimeError("No archived snapshots found")

    for path in snapshot_files:
        snap = json.loads(path.read_text())
        ds = snap.get("snapshot_date") or path.stem
        old = old_days.get(ds, {})

        day = {
            "date": ds,
            "source": old.get("source")
            or snap.get("source")
            or "historical-rebuild",
            "leagues": {},
        }

        if old.get("notes"):
            day["notes"] = old["notes"]
        elif snap.get("notes"):
            day["notes"] = snap["notes"]

        for league in snap.get("leagues", []):
            info = build_leader_info(league)
            if not info:
                continue

            lid = str(league.get("league_id"))
            day["leagues"][lid] = info

            if info["leader_count"] > 1:
                tie_report.append({
                    "date": ds,
                    "league": league.get("league_name"),
                    "points": info["leader_points"],
                    "leaders": [x["manager"] for x in info["leaders"]],
                })

        rebuilt.append(day)

    rebuilt.sort(key=lambda x: x["date"])

    history["days"] = rebuilt
    history["days_top"] = days_top(history)
    HISTORY.write_text(json.dumps(history, indent=2) + "\n")

    print(f"Rebuilt {len(rebuilt)} daily history records from archived snapshots.")

    if tie_report:
        print("Historical ties found:")
        for tie in tie_report:
            print(
                f"- {tie['date']} | {tie['league']} | "
                f"{tie['points']} pts | {' & '.join(tie['leaders'])}"
            )
    else:
        print("No historical ties found.")


if __name__ == "__main__":
    main()
