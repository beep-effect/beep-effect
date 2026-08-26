# Packet Control-Plane Core

Lifecycle: `completed-retained`

The D8 single packet-core: versioned CAS events, deterministic fold, derived
lifecycle, and guarded writers for the exploration/goal packet system —
colocated in the existing Goals CLI, self-hosted in advisory mode first.

## Outcome

Closed 2026-08-26. All six phases complete: the P1 slice (event fold, guarded
writer, explore check, trace projection) shipped 2026-08-17, P2 self-hosted
this packet's own stream in advisory mode, P3 landed the risk-tier override,
the full trace projection, the fork-repair plan surface, and the rung-4
pre-close hardening (#848: raw-canonical digests, `packet-mismatch`,
`packet-status-drift`, idempotent skip with trace self-heal and CAS
revalidation, schema-decoded writer requests, digest-keyed fork findings).
This stream carries the live close: event 4 is the `completed-retained`
transition, written through the guarded writer it proves. Closeout reflection:
[`history/reflections/2026-08-26-claude.md`](history/reflections/2026-08-26-claude.md).
The fired candidate-2/3 gates reopen the parent exploration at `decompose`;
the fleet convention-migration campaign (this PLAN's P5 paragraph) is
chartered there, not here.

## Launcher

```text
/goal follow the instructions in goals/packet-control-plane-core/GOAL.md
```

## Reading order

1. [`SPEC.md`](SPEC.md) — mission, D5 symbol ledger, binding constraints,
   the ratified first-slice acceptance, stop conditions.
2. [`PLAN.md`](PLAN.md) — phase sequencing.
3. [`GOAL.md`](GOAL.md) — compact execution launcher.
4. [`research/SOURCES.md`](research/SOURCES.md) — provenance ledger.

## Provenance

Graduated 2026-08-17 from
[`explorations/packet-system-redesign`](../../explorations/packet-system-redesign/README.md)
as the only promised-now candidate of its ratified five-candidate MAP.
Candidates 2–4 are gated re-entry candidates of that MAP (gates named in its
ratification amendments); the React viewer stays gated on KSA static-v1
daily-use evidence.
