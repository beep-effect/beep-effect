---
title: "Vercel objects without state read as Unowned; list() stays empty"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p2-vercel"
reversal: "Add an ownership marker (for example a project env var or comment carrying the stack, stage and logical id) and return owned reads for it, then implement list() for nuke."
---

Vercel projects, env vars and domains carry no tags or labels, so a provider cannot prove it created one. `read` returns plain attributes only with prior state, or when the object is the resource's own previous generation (`previous`, used by the engine's delete-first replacement admission); every other existing object is `Unowned` and needs `adopt(true)`/`--adopt`. `list()` keeps Alchemy's empty default, because without a marker it would hand every project in the team to `alchemy unsafe nuke`.
