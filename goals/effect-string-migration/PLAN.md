# effect/String migration Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | complete | Migrate the census sites wave by wave, then arm the rule. | Acceptance criteria are met. |
| P2 Verify | complete | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | in-progress | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | complete | Write the closeout reflection and propose closure. | Evidence and reflection are current; the typed proposal retains active lifecycle until completion evidence verifies. |

## Waves

Each wave is one PR that migrates whole packages and changes no pin. The last
wave moves `@effect/tsgo` to 0.55+ and arms `preferEffectString` at `error`.

| Wave | Packages | Sites | State |
| --- | --- | ---: | --- |
| 1 | libpff, box-provisioning, qa-capture, ontology-use-cases, brand, agents-domain, freshbooks, repo-docgen, ontology-server, tika, nlp, hubspot, workspace-domain | 193 | merged (#1968) |
| 2 | technical-drawing, epistemic-server, epistemic-domain, law-practice-use-cases, law-practice-domain, epistemic-ui, documents-domain, m365, occt, openclaw, db-admin, practice-identify, documents-server, html, todox, agents-server, m365-mcp, uspto, epistemic-tables, file-processing, law-practice-tables, shared-use-cases, repo-configs, fc-runs | 145 | merged (#1976) |
| 3 | effect-drizzle, repo-ai-metrics, pdf-tools, nlp-processing, law-practice-server, semantica, identity, infra, ciops, mcp-kit, ui, oip-web, wink, test-runner, practice-gateway, ontology, box, ai-sync, windows-secrets, rdf, practice-setup, openai-compat, nlp-mcp, mcpb-kit | 237 | merged (#1983) |
| 4a | acp, test-utils (ai-provider-cli had no sites left) | 47 | merged (#1987) |
| 4b | the non-effected remainder: repo-cli's last files, the root vitest files, professional-desktop, editor, lint-rules, runtime-env, practice-claude-mod, langextract, shared-domain, observability, public-site, storybook, duckdb | 166 | merged (#2015) |
| 5a | repo-cli: the 58 files no open PR or lane touched on 2026-10-21 | 202 | merged (#1993) |
| 5b | repo-cli: 49 of the remaining files (commands, internal, tests) | 224 | merged (#2008) |
| 5c | repo-cli: 50 further files plus `scripts/CreateKnowledgeMintApp.ts` and `scripts/CreateReviewerApp.ts` | 213 | merged (#2001) |
| 4c | schema, utils, repo-utils and the repo-cli and walker files that effected-promotion wave 2c edits | 43 | merged (#2026) |
| 6a | effected modeling: managed-section, jsonc, github-references, github-commands, tsconfig, spdx, npm-spec, schema-org, semver, jsonl, walker | 297 | merged (#2012) |
| 6b | effected drivers: git, github, commands | 279 | merged (#2011) |
| 6c | effected memfs and toml | 266 | merged (#2013) |
| 6d | effected glob | 185 | merged (#2018) |
| 6e | effected yaml sources | 286 | merged (#2014) |
| 6f | effected yaml tests | 208 | merged (#2010) |
| 7 | the last site (`epistemics/test/Claim.test.ts`), then the pin moves to 0.55.0 and the rule is armed at error | 1 | merged (#2027); completion requalification open |

Wave proof, per package: the package's tests, `package-verify --quick`, and a
temporary local `@effect/tsgo` 0.55.0 install with `preferEffectString` armed,
running `bun run beep quality effect-diagnostics --filter <pkg>`; the package's
own files must report zero `preferEffectString` and zero other findings. The
temporary install is reverted before commit. Coverage is compared per changed
source file against main's version on the same machine (lcov uncovered counts).
From wave 2 on, the site list is regenerated on the lane's own base with the
temporary install rather than read from the 2026-10-21 census.
A package joins a wave when none of its sites lies within three lines of a
hunk that an open PR or lane changes, measured against each lane's merge
base. Callback replacers use `replaceWith`/`replaceAllWith` from
`@beep/utils/Str`, except in packages `@beep/utils` depends on (such as
`@beep/identity`), which rewrite the call without it.

## Current requalification

The 2026-10-28 completion refresh rejects the historical #2027 proposal. Keep
its failed merge-time evidence intact. The `chore/effect-string-closeout` lane
must:

1. Full Check and the root configuration program passed most recently at
   `bf0990a3c1`: 337
   successful Turbo tasks, including 187 package Check tasks, and zero
   `preferEffectString` findings. The full graph had no affected-file filter.
2. `quality tsgo-rules`, packet checks and reflection validation passed; rerun
   the cheap packet validators after the evidence update.
3. The audit and reflection are published in #2324, now named by
   `proposedCloseout.finalPullRequest`; operative lifecycle stays active.
4. Pass content-final checks and capture a head-bound `--until-ready` Yeet
   verdict; merge only after required checks pass and review gates hold.
5. Run completion refresh against the new final PR and require `verified`
   before claiming completion. Retire the lane after preserving its readiness
   evidence in the clone ledger.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses and a typed `proposedCloseout` with status `completed-retained`
   and finalPullRequest. Keep `initiative.status` operative until completion
   evidence verifies; do not close the external execution/session ledger from a proposal.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/effect-string-migration/GOAL.md)" -le 4000
jq . goals/effect-string-migration/ops/manifest.json
rg -n "effect-string-migration|GOAL.md|agentLaunchers|packetAnchorDocument" goals/effect-string-migration
git diff --check -- goals/effect-string-migration
```
