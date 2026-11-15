---
title: "Port the live infra/r2-cache Python in this goal instead of waiting for infra-alchemy-rebuild P6"
date: 2026-11-13
lane: "chore/python-free-repo"
reversal: "Restore infra/r2-cache/*.py from 05ed8bc6b6cc and point Cache.adapter.ts and cache-warm.yml back at them"
---

SPEC lists infra/r2-cache Python as a non-goal because infra-alchemy-rebuild deletes it. That packet is at P1 and deletes r2-cache only at P6, while policy_runtime.py (spawned by Cache.adapter.ts) and probe.py (cache-warm.yml) are live. Waiting would hold acceptance item 1 (no tracked .py on main) open indefinitely. This goal ports the live scripts to repo-cli TypeScript and deletes the one-shot ones; infra-alchemy-rebuild later deletes TypeScript instead of Python. Details: research/r2-cache-port.md.
