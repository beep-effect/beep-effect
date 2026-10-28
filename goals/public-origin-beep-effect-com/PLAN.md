# Single public origin beep-effect.com Plan

## Status

Status: `active`. Implementation shipped in #1946. The 2026-10-28 audit found its completion
gate unsatisfied; a fresh closeout PR must prove readiness and merge evidence.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Packet and decisions | complete | Record the operator brief, the D1 to D6 decisions and the I1 to I18 rulings; land the doctrine entries. | Brief recorded in `history/`; SPEC Decision Log complete; architecture DECISIONS, GLOSSARY, ARCHITECTURE principle 8, the identity-as-iri supersession entry and the knowledge-endgame trail note written. |
| P1 `@beep/public-site` | complete | Ship `PublicOrigin`, `SiteRoute`, `hostedUrl` and `labRoute` (D4, I10). | Drift test proves `hostedUrl("ns") + "/"` equals the identity authority; `package-verify` green. |
| P2 Authority move and residue | complete | Move the authority (I1), fold the drift authorities (D5, I2, I3, I11), rewrite seeds and every remaining retired-host literal (D6, I15, I16). | Retired hosts appear only under `**/history/**` and the root `research/` tree; `package-verify` green for every affected package. |
| P3 Law and lane | complete | Add `bun run beep laws retired-iri-authorities` and its `lint:retired-iri-authorities` lane (I5, I6, I13). | `--check` green on the tree; a seeded scratch violation turns it red; lane registration tests green. |
| P4 Closeout | in-progress | Publish through Yeet, declare the closeout, write the reflection (I17). | `proposedCloseout` and gating `yeet-verdict` evidence in the manifest; reflection lint green; PR mergeable at the gate. |

## Closeout Checklist

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. After `yeet publish` opens the PR, add `proposedCloseout`
   (`completed-retained`, the final PR number) and a gating `yeet-verdict`
   entry in `completionGate.acceptanceEvidence` to `ops/manifest.json`. Keep
   `initiative.status` at `active`; set P1 to P3 `complete` and leave P4
   `in-progress`.
4. After merge, run
   `bun run beep goals completion refresh --slug public-origin-beep-effect-com`
   and retire the lane with `bun run beep yeet sweep --retire`.

## Execution Notes

- Work packages own disjoint files; the orchestrator holds the file map.
- Write retired hosts defanged outside `history/` (I7).
- Heavy commands go through `beep-heavy`.

## Verification Commands

```sh
bun run beep laws retired-iri-authorities --check
bun run beep goals doctor
bun run beep lint reflection-artifacts
bun run beep quality changeset-graph
test "$(wc -m < goals/public-origin-beep-effect-com/GOAL.md)" -le 4000
jq . goals/public-origin-beep-effect-com/ops/manifest.json
git diff --check -- goals/public-origin-beep-effect-com
```

## Closeout recovery

The original completion receipt is retained in
`history/2026-10-28-original-completion-receipt.json`. Recheck the current
implementation, bind the fresh final delivery PR and its Yeet verdict, retain
its readiness evidence before merge, then run completion refresh and retire the
closeout lane. Do not infer readiness from #1946 being merged.
