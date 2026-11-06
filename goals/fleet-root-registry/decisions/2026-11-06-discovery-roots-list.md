---
title: "Fleet root is a per-repository ordered list of discovery roots"
date: 2026-11-06
lane: "@chore/deps-update-11-6-26 (grill session)"
reversal: "Collapse the list to a single root by keeping only its first entry and re-adding recursion into seats/ and lanes/ in discoverClones."
---

Live code reads one directory level under the fleet root and origin-matches (Fleet.service.ts discoverClones); Economics fleetCandidates prefix-matches beep-effect*. The 2026-10-05 criterion (projects/beep/seats/main discovered with the projects dir as root) was unreachable. The setting becomes an ordered list: <projects> (legacy, prefix-matched), <projects>/beep/seats, <projects>/beep/lanes. Discovery stays one level deep, origin-matched, no recursion, no symlinks. Unset defaults to today's derived root so fleet --json is byte-identical. Rejected: single root with two-level recursion (discovery learns a layout shape and the legacy dir still needs a second rule); single root at seats/ only (desktop-app and Codex lanes invisible until adopted).
