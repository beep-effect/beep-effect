# Inline Schema Compiler Hard Error Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Reproduce and classify the 2,931-finding opening baseline. | Every finding has an ownership family and migration shape; drift is explained. |
| P1 Implement | pending | Hoist compilers family by family and update generators before outputs. | All governed findings are removed without semantic changes. |
| P2 Verify | pending | Promote the rule to error and run local proof. | Rule tests, affected package checks, docgen, and canonical verification are green. |
| P3 Yeet: PR to mergeable | pending | Publish through Yeet and close checks and review threads. | `bun run beep yeet monitor` reports `merge-ready: yes`. |
| P4 Close | pending | Write the reflection and flip packet state. | Packet status and evidence are synchronized; reflection validates. |

## P0 — Research

1. Reproduce the predecessor census against current HEAD.
2. Classify by compiler name, package, authored/generated ownership, and safe
   migration form.
3. Locate and update generator owners before generated output.
4. Establish per-family no-growth baselines and a zero target.

## P1 — Implement

1. Hoist native compiler results to module scope when a sibling constant is
   clearest.
2. Reuse selective schema statics only where they form the schema's evidenced
   public surface.
3. Preserve invocation-time parse options and Effect requirements.
4. Land families with shrinking, reproducible counts.

## P2 — Verify

1. Reach zero findings before changing severity.
2. Promote `beep(no-inline-schema-compile)` from warning to error.
3. Extend rule tests for every accepted and rejected compiler shape.
4. Run required package verification, docgen, and canonical Yeet verification.

## Closeout Checklist

Before marking the packet closed:

1. Drive the PR to `merge-ready: yes` through Yeet.
2. Write a closeout reflection via `/reflect` to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`.
3. Run `bun run beep lint reflection-artifacts`.
4. Update README evidence, phase statuses, and manifest lifecycle in the same
   PR.

## Verification Commands

```sh
test "$(wc -m < goals/inline-schema-compile-hard-error/GOAL.md)" -le 4000
jq . goals/inline-schema-compile-hard-error/ops/manifest.json
rg -n "inline-schema-compile-hard-error|GOAL.md|agentLaunchers|packetAnchorDocument" goals/inline-schema-compile-hard-error
git diff --check -- goals/inline-schema-compile-hard-error
bun run beep goals doctor
bun run beep goals index --write
bun run beep goals index --check
```
