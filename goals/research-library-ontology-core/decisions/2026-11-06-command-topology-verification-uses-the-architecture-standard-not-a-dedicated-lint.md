---
title: "Command-topology verification uses the architecture standard, not a dedicated lint"
date: 2026-11-06
lane: "feat/research-library-ontology-core"
reversal: "Wire a topology lint later and re-run it on the group"
---

No command-topology lint exists in @beep/repo-cli. The no-role-drift criterion is checked against standards/architecture/07 §Repo CLI Command Topology: the command, schemas, errors and service roles, earned paths/render/ontology/projection/views roles, and an index.ts facade without export *. bun run beep architecture plan/check is the tool-backed part.
