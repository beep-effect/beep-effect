# AI Metrics Stack Handoffs

This directory holds agent-operable handoff material for the AI metrics stack
initiative.

## Handoffs

- [HANDOFF_P0-P6.md](./HANDOFF_P0-P6.md) - full initiative execution handoff
- [HANDOFF_FRESH_REVIEW.md](./HANDOFF_FRESH_REVIEW.md) - fresh-eyes review
  prompt before continuing P6
- [HANDOFF_P7E_CLOSEOUT.md](./HANDOFF_P7E_CLOSEOUT.md) - verified 2026-08-10
  live-state takeover for the final V1 closeout

## Operating Rule

Every implementation session should read `../manifest.json`, `../../SPEC.md`,
and `../../PLAN.md` first. Phase outputs belong under `history/outputs/`; do
not let generated notes accumulate at the initiative root.

For the P7e closeout, the dated handoff intentionally outranks the pre-closeout
manifest snapshot it identifies as stale. The closeout PR reconciles the
manifest back to live truth.
