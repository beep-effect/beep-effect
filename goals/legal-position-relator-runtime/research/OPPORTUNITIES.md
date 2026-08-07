# Opportunities & friction ledger

Receipts recorded at the moment of friction, per the repo friction-capture law.

## 2026-08-06 — P0 research

### `SourceTextResolver` port consumption has no law-practice README coupling record

- **What happened:** while verifying the foundation-mediated port-inversion shape for the
  rung-2 handoff decision, the evidence walk found that `packages/law-practice/use-cases`
  already consumes the `SourceTextResolver` port (`CandorPolicy.ports.ts:14`) with **no
  README coupling record on the law-practice side**, which
  `standards/architecture/DECISIONS.md:1117-1120` requires in both packages. The ratified
  mechanism's own record-keeping requirement is unmet for the one precedent this slice
  consumes.
- **Evidence:** [`02-handoff-shape-evidence.md`](./02-handoff-shape-evidence.md) §C4;
  `rg -n "SourceTextResolver" packages/law-practice/use-cases/README.md` returns nothing.
- **Prevention:** a lint that pairs foundation-port imports in slice packages with a README
  coupling-record mention (same spirit as `lint:promotion-records`) would have caught this
  when the candor gate landed. Fixing the missing record is a named follow-up, not this
  goal's edit — this packet must not carry unrelated refactors.

### Opus subagent died on the account session limit after writing its report

- **What happened:** the P0 handoff-evidence agent (Opus 5, per SPEC decision 3 and the
  operator's session directive) hit "You've hit your session limit · resets 9:40pm
  (America/Chicago)" and failed its final return. Its full 791-line dossier survived only
  because the orchestration contract makes agents write deliverables to disk before
  returning; the orchestrator resumed from the file with zero loss.
- **Evidence:** teammate failure notification 2026-08-06T22:57:45Z; recovered report at
  [`02-handoff-shape-evidence.md`](./02-handoff-shape-evidence.md) (scratchpad original
  written 22:57, 42,963 bytes).
- **Prevention:** the durable on-disk handoff doctrine (AGENTS.md Context Economy) is the
  prevention and it worked — worth noting that Opus-only orchestration mandates inherit a
  hard stall window when the account session limit trips mid-phase; phase plans should keep
  a main-thread-recordable paperwork lane (evidence promotion, ledger, packet updates) to
  absorb the window.
