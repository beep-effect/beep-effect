# GOAL: deliver the Effect-native citation extraction engine

Repo root is the current `beep-effect` checkout. Use repo-relative paths.

Outcome: a pinned, attributed eyecite parity corpus proves an Effect-native
pipeline that emits the existing law-practice citation values for full, short,
Id., supra, 35 U.S.C., and 37 C.F.R. forms with exact verified spans and stable
versioned court/reporter identities.

Read first:

- `goals/citation-extraction-engine/README.md`
- `goals/citation-extraction-engine/SPEC.md`
- `goals/citation-extraction-engine/PLAN.md`
- `goals/citation-extraction-engine/ops/manifest.json`
- `AGENTS.md`, `CLAUDE.md`, dependency contracts, and named standards

Blocked by:

- `goals/citation-verified-span-substrate`
- `goals/court-reporter-vocabulary`

P0 provenance/parity/regex research may proceed, but do not freeze contracts or
start P1 until both public dependency surfaces are available and compatible.

Scope:

- In: pinned eyecite code/fixture corpus; stage-level parity harness; pure
  Effect extraction over existing law-practice values; 35 U.S.C./37 C.F.R.
  fixtures; branded UnitInterval confidence repair; stable artifact-version/ID
  and verified-anchor integration; regex-safety evidence; notice metadata.
- Out: `eyecite-js`, MPEP patterns, raw vocabulary imports, court resolver,
  guard orchestration, claim lifecycle changes, wall enforcement, hosted truth,
  citator/good-law, editor annotation, unrelated packages, and `goals/INDEX.md`.

Workflow:

1. Inspect both prerequisites, the exploration, existing citation values, live
   worktree, and source/barrels before adding symbols.
2. Execute P0: pin source/corpus, inventory licensing, fill the root notice,
   define per-stage parity, and scan all patterns for compatibility/timing.
3. Stop at the P1 gate unless both dependencies expose compatible public
   contracts; never consume raw generated files.
4. Port the smallest schema-first/Effect-first pipeline into the existing
   taxonomy. Do not create a second hierarchy or add `eyecite-js`.
5. Decode `CitationBase.confidence` as branded `@beep/schema/UnitInterval`.
6. Prove full/short/Id./supra and 35 U.S.C./37 C.F.R. outputs, canonical
   half-open UTF-16 spans, and verified-anchor fidelity on Bun.
7. Preserve unrelated changes and update packet state only from evidence.
8. At P3, write a reflection and run reflection lint.

Acceptance:

- [ ] Every `SPEC.md` criterion passes.
- [ ] Both blockers are cleared before P1.
- [ ] Parity is stage-attributable and span fidelity passes on Bun.
- [ ] Regex strategy and BSD-2 attribution are complete.
- [ ] Required package/repo/Yeet proof passes with no unrelated churn.

Verification:

```sh
test "$(wc -m < goals/citation-extraction-engine/GOAL.md)" -le 4000
jq . goals/citation-extraction-engine/ops/manifest.json
git diff --check -- goals/citation-extraction-engine THIRD_PARTY_NOTICES.md
```

Done only when all acceptance passes and the PR is mergeable through Yeet; if a
blocker remains, report it with file/command evidence without weakening scope.
