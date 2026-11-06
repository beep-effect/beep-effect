---
title: "July validator scripts are archived, not tracked"
date: 2026-11-06
lane: "docs/git-history-rewrite-exploration"
reversal: "Copy census/*.mjs from ~/.local/state/beep/archive/beep-effect-cutover/ into docs/history/"
---

Refines the cutover-folder decision. Only the map data moves to docs/history/ (commit-message-map.json, commit-message-map.excluded.json, README.md). The July .mjs validators (merge-map, validate-map, build-dossier) go to the archive: beep history notes --check owns validation (decode, ancestry, drift), and loose scripts in the tree run against the scripts-to-beep-cli direction. Also adds the one saving commit the July map missed (6f33208961, a pure .repos/effect-tsgo deletion).
