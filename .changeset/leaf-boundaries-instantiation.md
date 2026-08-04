---
"@beep/md": patch
"@beep/agents-server": patch
"@beep/agents-use-cases": patch
---

Cut typecheck instantiation mass via probe-proved leaf import boundaries
(quality-speedup follow-up): Md.safe imports its two policy schemas from
`@beep/html/Html.policy` instead of the barrel (−21.8% for the module), and
BlockRepair consumes `IndexedBlock`/`BlockRepairFailed` through new
`@beep/agents-use-cases/AssistantTurn.contracts` and
`.../AssistantTurn.repair-errors` leaf entry points instead of the public and
server barrels (−86.8%, 15.2M → 2.0M instantiations; peak RSS 5.1GB → 0.85GB).
A `@beep/agents-server/BlockRepair` leaf entry is exported alongside the
existing AssistantTurn barrel, which is retained for compatibility.
