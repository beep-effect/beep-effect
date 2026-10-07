# Practice Document Identification

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Identify the client and docket of unplaced practice documents from the attorney own filing, contacts, public USPTO records and extracted content, with measured precision per evidence tier and no guessing

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/practice-document-identification/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P3 Yeet: PR to mergeable — the `DocumentIdentification` slice, adapters, and `apps/practice-identify` are implemented and verified; the draft PR is being driven to mergeable. P4 Close follows.

## Latest Evidence

- [`history/2026-10-06-held-out-evaluation.md`](./history/2026-10-06-held-out-evaluation.md) — held-out precision per tier on the private data, counts only.
- Package verify green for `@beep/law-practice-use-cases`, `@beep/law-practice-server`, `@beep/practice-identify` (2026-10-06).

## Notes

- Private inputs and outputs live outside the repository; every stage takes explicit paths and refuses to overwrite an existing output.
- Decisions taken while the tooling landed are D11–D16 in `SPEC.md`.
