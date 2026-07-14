# Lint Advisory Hardening Plan

## Status

Status: `closeout-reconciled`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | done | Confirm scope, current inventory, owners, and CI bypass risks. | Inventory and decisions recorded. |
| P1 Implement | done | Add policy lane, harden checkers, and clear current findings. | Acceptance criteria are implemented. |
| P2 Verify | done modulo consolidation PR verify | Run focused and repo quality proof. | The portfolio-consolidation PR's own verify lane supplies final evidence. |
| P3 Close | done | Publish, monitor, and close the packet. | Closure bookkeeping and packet reflection exist; lifecycle flip remains external. |

## Completed Implementation Record

1. Created this packet and baseline inventory.
2. Extracted root lint policy steps behind reusable `bun run beep lint policy`
   behavior while keeping unscoped root `bun run lint` equivalent.
3. Added a dedicated PR CI lane for `bun run beep lint policy`.
4. Hardened `native-runtime` false positives with precise context checks.
5. Cleared the `terse-effect`, `native-runtime`, and reflection backlog.
6. Promoted `terse-effect`, `native-runtime`, `reflection-artifacts`, and
   `schema-first` advisory categories to failures.
7. Updated docs and tests.
8. Completed the original Yeet publish/monitor path; this consolidation PR's
   verify lane supplies the retained packet's final reconciliation evidence.

## P3 Closeout Checklist

Completed for bookkeeping closeout:

1. Wrote `history/reflections/2026-07-14-codex.md`.
2. Reconciled `README.md`, `ops/manifest.json`, and this plan with the shipped
   implementation.
3. Assigned final P2 evidence to the portfolio-consolidation PR's verify lane;
   the external driver owns the lifecycle/status flip after that proof.

## Verification Commands

```sh
test "$(wc -m < goals/lint-advisory-hardening/GOAL.md)" -le 4000
jq . goals/lint-advisory-hardening/ops/manifest.json
git diff --check -- goals/lint-advisory-hardening
bun run beep laws terse-effect --check
bun run beep laws native-runtime --check
bun run beep lint reflection-artifacts
bun run beep lint schema-first
bun run beep lint policy
bun run lint
bun run beep yeet verify
```
