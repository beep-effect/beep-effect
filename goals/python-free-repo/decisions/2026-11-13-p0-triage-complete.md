---
title: "P0 triage complete; P1 running in four lanes"
date: 2026-11-13
kind: checkpoint
lane: "chore/python-free-repo"
reversal: "n/a (status note)"
---

308 tracked .py on 05ed8bc6b6cc. 273 one-shot packet/exploration probes with no runtime consumer were deleted, one commit per packet, each with history/2026-11-13-python-removed.md naming where results are recorded. Live consumers found: heavy.yml (native-dependency-diagnostics.py), cache-warm.yml and Cache.adapter.ts (r2-cache), a systemd drop-in (cli-proxy-startup-check.py), four skills, photo-face. Note: the first consumer search missed hidden directories (rg skips .github by default); rerun with --hidden.
