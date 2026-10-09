# Opportunities — friction receipts

## 2026-08-27 — Exact-snapshot Yeet refresh could not queue behind a sibling proof

- **What happened:** the first full semantic-foundation proof spent an extended
  period waiting for the repository-wide coordinator. After that proof passed
  and a documentation-status advisory was repaired, the required exact-snapshot
  refresh exited because a sibling checkout had acquired the coordinator. When
  owners released it, successive waiting siblings won the handoffs before this
  checkout could claim the lock.
- **Evidence:** `bun run beep yeet verify` reported `Another Yeet full proof for
  this repository is active` and identified the live owner checkout as
  a sibling beep-effect checkout. The owner process was still running, so
  deleting the shared lock would have been unsafe.
- **What would have prevented it:** a supported Yeet queue or `--wait` mode that
  retains the requesting command, emits periodic owner heartbeats, and starts
  verification when the coordinator becomes available.
- **Disposition:** repo-quality operator improvement; wait for the live owner
  and retry without bypassing the coordinator.

## 2026-08-27 — Staged-only proof hid the required package changeset

- **What happened:** full Yeet verification passed while the implementation was
  staged, and `changeset-status` reported no changed product workspaces. After
  staged-only publication created the commit, the post-commit proof correctly
  identified `@beep/ontology` as changed and required a new changeset.
- **Evidence:** the staged run reported `product_workspaces=0`; the post-commit
  run reported `product_workspaces=1` and named `@beep/ontology` as missing an
  in-range changeset. The older M1 changeset is already part of `origin/main`,
  so it cannot satisfy this delivery range.
- **What would have prevented it:** make staged-only verification evaluate the
  index as the candidate commit for changeset attribution, or have staged-only
  publication create its temporary commit before spending the full proof.
- **Disposition:** add the required patch changeset and amend the reviewed
  commit; candidate for a Yeet staged-only regression test.

## 2026-08-27 — Restored residue invalidated reuse of a successful proof

- **What happened:** the exact amended commit passed all 25 Yeet lanes, but the
  proof workflow restored unrelated `.codex` edits before returning. Parking
  those edits again made the worktree clean for publication, while also changing
  the recorded diff fingerprint, so `publish --reuse-verified` refused the
  otherwise exact-head proof.
- **Evidence:** `bun run beep yeet status` reported `verify success` for commit
  `d6476b6703` with only `.codex` residue present; after a path-scoped stash,
  publication exited with `stale proof state: diff fingerprint changed`.
- **What would have prevented it:** bind reusable proof identity to the verified
  candidate snapshot and preserve unrelated residue outside that snapshot, or
  provide a first-class clean-candidate worktree for verify and publish.
- **Disposition:** retain the residue in a named stash, amend this receipt, and
  verify the clean candidate snapshot before publication.

## 2026-08-27 — Hosted coverage found debt omitted by the local full proof

- **What happened:** the clean candidate passed all 25 local Yeet lanes, but the
  hosted coverage-regression check found one new uncovered loader error path.
  The loader refactor also reduced the number of branch sites, which lowered the
  branch percentage even though the absolute uncovered-branch count stayed at
  the `origin/main` value.
- **Evidence:** before the follow-up test, `@beep/ontology` had 48 uncovered
  lines, 49 statements, 37 branches, and 34 functions. A focused comparison to
  `origin/main` showed baseline debts of 47, 48, 37, and 33 respectively. The
  added malformed-slice test restored the candidate to exactly 47, 48, 37, and
  33; 68 ontology tests now pass.
- **What would have prevented it:** include the affected coverage-regression
  lane in the canonical local pre-publication proof, or surface an explicit
  advisory that the full local lane set does not cover this hosted gate.
- **Disposition:** cover the fail-closed parse-error path and retain the existing
  baseline; the comparator correctly ignores a percentage-only denominator
  change when uncovered debt does not increase.

## 2026-10-09 — XML repair brief carries stale publication metadata

The schema-xml-text-node brief requested a patch changeset for `@beep/schema`,
calling it published. On current main `4e82f6d942`, its manifest and the CLI
consumer manifest both have `private: true`. After staging the requested
changeset, `bun run beep quality changeset-graph` exited 1 with
`private workspace changesets are forbidden`. Removed the changeset under
the brief's private-workspace exemption; no release policy was changed.
Generate package publication facts from the lane's refreshed base when
writing briefs so workers do not prepare release notes the gate rejects.

## 2026-10-09 — XML builder declarations disagree with runtime exports

The XML round-trip regression initially used `XMLBuilder` from
`fast-xml-parser`; the schema audit's Biome gate rejected its deprecated
re-export. The maintained `fast-xml-builder@1.3.1` declarations expose a
named `Builder` export, but its ESM source exports only the default
constructor. The focused test and schema package audit exposed
`undefined is not a constructor`; using the default import repaired it.
Prefer the runtime-supported default import and verify runtime exports when
following this package's declarations. Adding the explicit test dependency
also made bounded docgen require the canonical full proof because the root
catalog and lockfile changed.

## 2026-10-09 — Scoped CLI coverage reports unrelated baseline drops

`bun run beep ci lane coverage --filter @beep/repo-cli` passed 291 files
and 5,834 tests (5 skipped), then failed committed coverage floors on
`Accounts.command.ts` (branches 75 < 100), `EffectImports.ts`
(functions 89.34 < 90.17, lines 92.36 < 92.52, statements 92.02 < 92.13),
and `Yeet/internal/TurboQuery.ts` (functions 73.91 < 78.26,
lines/statements 86.66 < 88.33). All three files are unchanged by this lane
relative to its base `4e82f6d942`; the baseline is also unchanged on current
main. This lane does not lower their floors or repair their unrelated code.
Main advanced during the proof, including global inputs. Integrate the newer
base and replay with PR-base framing before attributing the final-head gate.

## 2026-10-09 — New main inherits cheap-gate reds that block XML publication

After integrating `cb64e0484f` and re-running both package verifiers green,
`bun run beep yeet publish --message "fix(schema): use a reserved text-node key in the XML reader"`
created local commit `0b96e712b7` but exited 1 before any push.
`lint:schema-first` reported three missing inventory entries: exported
`AccountsSecretField` and `AccountsSecretsItem` structs, plus the
`ci-runner-security.test.ts` schema-codec advisory. `lint:effect-vitest`
reported 13 new findings across seven upstream files. None of these files
is changed by this lane relative to integrated base `cb64e0484f`.
The root packet identifies `schema-first-policy`; the full cheap-gate log
contains both red lanes. Fix these once on main and merge that fix into the
dependent lanes, as the Quality Operator law requires. This lane does not
refresh unrelated baselines, waive gates, or copy upstream repairs.
The remaining owned parity batch was stopped after the hard publication
blocker was attributed; its partial full-docgen replay is not a green proof.
