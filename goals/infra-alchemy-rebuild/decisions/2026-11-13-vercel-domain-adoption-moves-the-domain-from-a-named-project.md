---
title: "Vercel.Domain adoption moves the domain from a named project"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p2-vercel"
reversal: "Drop the moveFrom prop and adopt per domain by removing it from the Pulumi project first (delete-then-create in the flip)."
---

A domain belongs to one project at a time and the project-scoped API cannot find which project holds a domain, so `Vercel.Domain` takes an optional `moveFrom` (id or name of the project holding it today). Without prior state, `read` looks on the target project and then on `moveFrom`, and reports what it finds as `Unowned`; under `adopt(true)` the engine takes it over and `reconcile` calls `moveProjectDomain` from the holding project to the target, carrying redirect and git-branch settings. A later change of the `project` prop is an update that moves the domain the same way. This is the D20 per-object adoption for the oip.law domains: the cutover flip is one deploy with `moveFrom` set to the Pulumi-owned project.
