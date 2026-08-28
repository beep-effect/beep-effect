#!/usr/bin/env python3
"""S0 KPI baseline probe v3 — reads yeet attempt journals.

Source vein: .beep/yeet/runs/*/attempts.ndjson (yeet-attempt-journal/v1),
branch-scoped Started/Finished events with the full verdict embedded per
attempt (wall elapsedMs, outcome, failedStepId, failureKind).

VEIN CAVEAT (round-1 seat C, 2026-08-27): the journal is a RING BUFFER, not
append-only history — Yeet retains only the newest ~50 attempt starts per
branch (RETAINED_ATTEMPTS in Yeet/internal/AttemptJournal.ts). Episodes that
crossed the retention boundary are truncated or missing; every number this
probe prints is a fact about the RETAINED WINDOW only.

v3 changes (round-1 panel):
- multi-root fleet mode + the fleet filters that produced the published v0.5
  numbers (--modes, --exclude-bounces, --max-episode-hours) so the baseline
  is reproducible from the committed script;
- right-censored red streaks (open at journal end) are COUNTED and reported,
  not silently dropped (they bias time-to-certainty downward);
- schemaVersion asserted per event; duplicate attemptIds dropped; unmatched
  starts counted; chronological sort uses parsed timestamps; the resolved
  roots and journal count are echoed; percentile estimator is named.

Percentile estimator: nearest-rank on the sorted sample
(index = round(p/100 * (n-1))).

Usage:
  python kpi_baseline_probe.py <root> [<root> ...]                 # raw, all modes
  python kpi_baseline_probe.py <roots...> --modes verify,repair,publish \
      --exclude-bounces --max-episode-hours 24                     # fleet v0.5 recipe
"""
import argparse
import glob
import json
import sys
from datetime import datetime

SCHEMA = "yeet-attempt-journal/v1"
VERDICT_SCHEMA = "yeet-verdict/v2"
LOCK_SENTENCE = "Another Yeet full proof"  # prose heuristic; see report caveat


def pct(vals, p):
    if not vals:
        return None
    s = sorted(vals)
    k = max(0, min(len(s) - 1, round(p / 100 * (len(s) - 1))))
    return s[k]


def fmt(ms):
    if ms is None:
        return "n/a"
    if ms >= 3_600_000:
        return f"{ms/3_600_000:.1f}h"
    return f"{ms/60000:.1f}m" if ms >= 60000 else f"{ms/1000:.1f}s"


def ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def load(roots):
    attempts, starts, finishes = [], set(), set()
    bad_schema = bad_verdict = dupes = 0
    journals = []
    for root in roots:
        journals += sorted(glob.glob(f"{root}/.beep/yeet/runs/*/attempts.ndjson"))
    if not journals:
        print(
            f"ERROR: no attempts.ndjson journals under {roots} — wrong root(s)?",
            file=sys.stderr,
        )
        sys.exit(2)
    root_of = {}
    for root in roots:
        for j in sorted(glob.glob(f"{root}/.beep/yeet/runs/*/attempts.ndjson")):
            root_of[j] = root
    for f in journals:
        for line in open(f):
            line = line.strip()
            if not line:
                continue
            e = json.loads(line)
            if e.get("schemaVersion") != SCHEMA:
                bad_schema += 1
                continue
            aid = e.get("attemptId")
            if e.get("_tag") == "attempt-started":
                starts.add(aid)
                continue
            if e.get("_tag") != "attempt-finished":
                continue
            if aid in finishes:
                dupes += 1
                continue
            finishes.add(aid)
            v = e.get("verdict", {})
            if v.get("schemaVersion") not in (None, VERDICT_SCHEMA):
                bad_verdict += 1
                continue
            attempts.append(
                {
                    "checkout": root_of.get(f, "?"),
                    "branch": v.get("branch"),
                    "mode": v.get("mode"),
                    "outcome": v.get("outcome"),
                    "elapsedMs": v.get("elapsedMs"),
                    "startedAt": v.get("startedAt"),
                    "endedAt": v.get("endedAt"),
                    "failedStepId": v.get("failedStepId"),
                    "failureKind": v.get("failureKind"),
                    "lockBounce": LOCK_SENTENCE in (v.get("message") or ""),
                }
            )
    unmatched = len(starts - finishes)
    pairs = {(a["checkout"], a["branch"]) for a in attempts}
    print(f"roots={list(roots)} journals={len(journals)}")
    print(
        f"loaded {len(attempts)} finished attempts across {len(pairs)} (checkout, branch) pairs "
        f"(SKIPPED, not asserted: {bad_schema} wrong journal schema, {bad_verdict} wrong verdict "
        f"schema, {dupes} duplicate attemptIds; {unmatched} starts with no finish — abandoned or in flight)"
    )
    return attempts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("roots", nargs="+", help="checkout root(s) containing .beep/yeet/runs/")
    ap.add_argument("--modes", help="comma list; keep only these attempt modes (fleet v0.5: verify,repair,publish)")
    ap.add_argument("--exclude-bounces", action="store_true", help="drop lock-contention bounces before analysis (fleet v0.5)")
    ap.add_argument("--max-episode-hours", type=float, help="drop episodes longer than this (fleet v0.5: 24) — CENSORS THE TAIL; report both with and without")
    args = ap.parse_args()

    attempts = load(args.roots)
    total_raw = len(attempts)
    if args.modes:
        keep = set(args.modes.split(","))
        attempts = [a for a in attempts if a["mode"] in keep]
        print(f"mode filter {sorted(keep)}: {len(attempts)}/{total_raw} attempts kept")
    bounces_all = [a for a in attempts if a["lockBounce"]]
    print(f"lock-contention bounces n={len(bounces_all)} ({100*len(bounces_all)/max(1,len(attempts)):.0f}% of kept attempts)")
    if args.exclude_bounces:
        attempts = [a for a in attempts if not a["lockBounce"]]
        print(f"bounce exclusion: {len(attempts)} attempts remain (bounce lock-wait leaves the clock — documented censorship)")

    print(f"attempts={len(attempts)} branches={len({a['branch'] for a in attempts})}")

    greens = [a["elapsedMs"] for a in attempts if a["outcome"] == "success" and a["elapsedMs"]]
    reds = [a["elapsedMs"] for a in attempts if a["outcome"] != "success" and a["elapsedMs"]]
    no_elapsed = sum(1 for a in attempts if not a["elapsedMs"])
    print(f"green attempts n={len(greens)} P50={fmt(pct(greens,50))} P95={fmt(pct(greens,95))}")
    print(f"red   attempts n={len(reds)} P50={fmt(pct(reds,50))} P95={fmt(pct(reds,95))}")
    if no_elapsed:
        print(f"({no_elapsed} attempts with missing/zero elapsedMs excluded from all wall stats)")

    kinds = {}
    for a in attempts:
        if a["outcome"] != "success":
            k = a["failureKind"] or "unknown"
            kinds[k] = kinds.get(k, 0) + 1
    print("failureKind mix:", dict(sorted(kinds.items(), key=lambda kv: -kv[1])))

    steps = {}
    for a in attempts:
        if a["failedStepId"]:
            steps[a["failedStepId"]] = steps.get(a["failedStepId"], 0) + 1
    print("top failed steps:", dict(sorted(steps.items(), key=lambda kv: -kv[1])[:6]))

    episodes, censored = [], []
    by_branch = {}
    for a in attempts:
        if a["startedAt"]:
            # (checkout, branch) key — same-named branches exist in sibling checkouts
            # (round-2 seat F: branch-only keying let one checkout's green close
            # another checkout's red streak)
            by_branch.setdefault((a["checkout"], a["branch"]), []).append(a)
    for (checkout, branch), rs in by_branch.items():
        rs.sort(key=lambda a: ts(a["startedAt"]))
        red_start, red_attempts = None, 0
        for a in rs:
            if a["outcome"] != "success":
                if red_start is None:
                    red_start = ts(a["startedAt"])
                red_attempts += 1
            elif red_start is not None:
                episodes.append(
                    {
                        "branch": branch,
                        "ms": (ts(a["endedAt"] or a["startedAt"]) - red_start).total_seconds() * 1000,
                        "attempts": red_attempts + 1,
                    }
                )
                red_start, red_attempts = None, 0
        if red_start is not None:
            last = ts(rs[-1]["endedAt"] or rs[-1]["startedAt"])
            censored.append(
                {"branch": branch, "ms": (last - red_start).total_seconds() * 1000, "attempts": red_attempts}
            )

    dropped_long = 0
    if args.max_episode_hours:
        cut = args.max_episode_hours * 3_600_000
        dropped_long = sum(1 for e in episodes if e["ms"] > cut)
        episodes = [e for e in episodes if e["ms"] <= cut]

    ep = [e["ms"] for e in episodes]
    print(f"\nred->green episodes n={len(ep)} P50={fmt(pct(ep,50))} P95={fmt(pct(ep,95))} (nearest-rank estimator)")
    if dropped_long:
        print(f"  CENSORED: {dropped_long} closed episodes > {args.max_episode_hours}h dropped by --max-episode-hours")
    if censored:
        cm = [c["ms"] for c in censored]
        print(
            f"  RIGHT-CENSORED: {len(censored)} (checkout, branch) pairs end the retained window "
            f"still red (observed streak span — first red to LAST RECORDED EVENT, a lower bound "
            f"with no common observation cutoff: P50={fmt(pct(cm,50))} max={fmt(max(cm))}; "
            f"{sum(c['attempts'] for c in censored)} red attempts) — excluded above, biasing P50/P95 DOWN"
        )
    for e in sorted(episodes, key=lambda e: e["ms"])[:3]:
        print(f"  spot: {e['branch']}: {fmt(e['ms'])} across {e['attempts']} attempts")
    for e in sorted(episodes, key=lambda e: -e["ms"])[:3]:
        print(f"  worst: {e['branch']}: {fmt(e['ms'])} across {e['attempts']} attempts")

    modes = {}
    for a in attempts:
        if a["elapsedMs"]:
            modes.setdefault(a["mode"], []).append(a["elapsedMs"])
    print("\nper-mode P50 wall (missing-elapsed excluded):", {m: fmt(pct(v, 50)) for m, v in modes.items()})


if __name__ == "__main__":
    main()
