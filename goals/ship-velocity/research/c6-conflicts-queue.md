# C6 — merge-conflict hotspots and PR queue design

Analysis window: 2026-07-23 through local `origin/main` at `df6460b29e40` (2026-08-13). No network state was consulted.

## Concrete findings

### 1. The merge treadmill is measurable and concentrated

Method: `git log --all --since=2026-07-23` for all-ref churn; `--no-merges` to separate authored/fix-forward commits from merge propagation; `git log origin/main --first-parent` for changes that reached main. For branch contention, I selected the 134 commits whose subject is exactly `Merge remote-tracking branch 'origin/main' into ...`, diffed each merge result against its second parent (main), and de-duplicated `(branch,path)`. This gives 66 distinct branch names and intentionally excludes branches that never merged main.

| Surface | all-ref commits | non-merge commits | merge commits | main first-parent commits |
| --- | ---: | ---: | ---: | ---: |
| `goals/INDEX.md` | 165 | 142 | 23 | 80 |
| `explorations/ATLAS.md` | 76 | 73 | 3 | 41 |
| exact `standards/*.json` | 5 | 5 | 0 | 1 |
| intended `standards/*.json*` (includes JSONC) | 208 | 184 | 24 | 75 |

The JSONC distinction matters: nearly all hot standards snapshots end in `.jsonc`, so an exact `*.json` measurement hides the problem.

There were **134** explicit main-into-branch merge commits across **66** branches in 22 days. The worst repeaters were `@chore/7-30-26` and `housekeeping/platform-hygiene` (9 each), `codex/document-modeling-hardening` (8), and `codex/csf-013-invoke-arn` (5). Six merge-message commits themselves landed on main as PRs: `7b7edd15a0` (#694), `81f5461c9c` (#675), `4857be45cb` (#658), `b099b3e7d9` (#656), `1415bafbc2` (#645), and `91c80edbc1` (#646). Five of those six touched at least one named hotspot: #694 touched both INDEX and ATLAS; #658 and #646 touched INDEX; #656 and #645 touched ATLAS. Only #675 touched neither.

The repository has already recorded the consequence: PR #576 made the required gate red on `main` because of INDEX drift (`goals/fleet-mirror/research/p0-policy-surface-measurement.md:90-99`). A later retrospective says all three observed INDEX auto-merges were wrong; HEAD and main each had a different wrong packet count, and regeneration was the deterministic repair (`goals/speed-loop/research/OPPORTUNITIES.md:1557-1563`).

There are no commits whose subject starts with `Revert` for the three named surfaces in the window. There is explicit fix-forward churn instead:

- `e9a1fadb98` and `f0a1e4088b`: “regenerate the goals index after rebase”;
- `5a52be91ca`: “regenerate index after main merge”;
- `b6bf57e300`: repair packet state and INDEX after it broke Lint Policy;
- `4a59c76e35`: regenerate derived configs after rebase, touching INDEX and `standards/jsdoc-documentation.inventory.jsonc`.

That is at least **five directly attributable repair commits**, in addition to merge commits and ordinary refresh commits.

### 2. Top 15 contended paths

`branches` is the number of distinct branch identities whose post-main-merge delta still contained the path. `non-merge commits` is all-ref churn and therefore includes branch-local copies/cherry-picks; it is a churn measure, not a count of merged PRs.

| rank | path | branches | non-merge commits | character |
| ---: | --- | ---: | ---: | --- |
| 1 | `goals/INDEX.md` | 18 | 142 | pure generated projection; sorted/grouped |
| 2 | `package.json` | 17 | 95 | hand-authored manifest; structured but arbitrary |
| 3 | `bun.lock` | 15 | 127 | tool-generated lock graph; not safe to textual-merge |
| 4 | `standards/schema-first.inventory.jsonc` | 11 | 70 | generated ratchet merged with prior inventory |
| 5 | `tsconfig.json` | 11 | 60 | hand-authored shell with generated canonical alias block |
| 6 | `explorations/ATLAS.md` | 9 | 73 | currently hand-authored navigation; arbitrary Markdown |
| 7 | `packages/tooling/tool/cli/test/quality-tasks.test.ts` | 9 | 44 | hand-authored tests |
| 8 | `standards/fallow.boundaries.generated.jsonc` | 8 | 52 | pure generated projection; deterministic JSONC |
| 9 | `packages/foundation/modeling/identity/src/packages.ts` | 6 | 25 | hand-authored, conventionally ordered exports |
| 10 | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` | 6 | 40 | hand-authored task registry |
| 11 | `syncpack.config.ts` | 6 | 25 | hand-authored shell with generated sorted sources |
| 12 | `.fallowrc.jsonc` | 5 | 23 | hand-authored policy |
| 13 | `apps/professional-desktop/src/runtime/Migrations.gen.ts` | 5 | 27 | pure generated migration bundle |
| 14 | `infra/test/OpenClaw.test.ts` | 5 | 17 | hand-authored tests |
| 15 | `packages/foundation/modeling/html/src/Html.attributes.ts` | 5 | 20 | explicitly hand-authored overlay (`Html.attributes.ts:1-15`) |

This ranking explains why a “three special files” patch is insufficient. The same publish serialization should treat `package.json`/`bun.lock` as a dependency family, root config projections as a workspace-topology family, and CLI task source/tests as one jointly owned family.

### 3. Hotspot ownership and diff shape

#### Goals INDEX

`goals/INDEX.md` is unambiguously derived. `bun run beep goals index --write` reads `goals/<slug>/ops/manifest.json`; check mode fails drift; conflicts are explicitly resolved by rerunning the writer (`packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts:2-9`). Rendering sorts all rows by slug, then emits complete status sections and tables (`PortfolioIndex.ts:123-166`); the writer overwrites the file (`PortfolioIndex.ts:243-251`). It is **whole-file, deterministic, sorted output**, not append-only. `merge=union`, ours, or theirs can all create a plausible but false index.

#### Exploration ATLAS

`explorations/ATLAS.md` is **not generated today**. No current repo CLI command writes it. The workflow calls it a living map synchronized at every stage/status transition (`explorations/README.md:65-69`), and graduation explicitly requires updating it (`explorations/README.md:160-167`). It contains hand-edited prose, trees, grouped lists, and epitaphs: arbitrary structure, not append-only and not union-safe.

There is, however, already a ratified structural direction: packet-system redesign decision D6 says to generate ATLAS wholesale from manifests because ATLAS is navigation, never doctrine (`explorations/packet-system-redesign/DECISIONS.md:122-139`), matching the current convention (`explorations/README.md:169-179`). Until that generator lands, ATLAS must remain a serialized hand-authored hotspot.

#### Standards JSON/JSONC

Per-file churn in the window:

| file | all-ref | non-merge | main | ownership / regenerator |
| --- | ---: | ---: | ---: | --- |
| `coverage.regression-baseline.jsonc` | 49 | 47 | 21 | generated acceptance baseline; `bun run coverage:baseline:write` (`package.json:374`; file lines 1-8) |
| `effect-laws.allowlist.jsonc` | 9 | 9 | 2 | **hand-authored** exception records; policy confirms this (`standards/generated-artifacts.policy.md:15-16`) |
| `fallow.boundaries.generated.jsonc` | 59 | 52 | 25 | pure projection from workspace dependency metadata; `bun run beep fallow boundaries --write` (`Fallow.command.ts:460-495`) |
| `fallow.boundaries.provenance.jsonc` | 6 | 6 | 2 | hybrid/hand-maintained provenance, including doctrine-pinned records; no current CLI writer for this path |
| `fallow.dead-code.regression-baseline.jsonc` | 5 | 5 | 2 | generated acceptance baseline; `bun run fallow:dead-code:baseline:write` (`package.json:388`) |
| `fallow.health.regression-baseline.jsonc` | 7 | 7 | 3 | generated acceptance baseline; `bun run fallow:health:baseline:write` (`package.json:392`) |
| `fallow.pilot.inventory.jsonc` | 3 | 3 | 0 | hand-authored dated experiment/decision snapshot (`standards/fallow.pilot.inventory.jsonc:1-15`) |
| `jsdoc-documentation.inventory.jsonc` | 44 | 40 | 16 | whole-repo generated inventory; `bun run beep quality jsdoc-inventory` writes it (`JSDocDocumentationInventory.ts:199`, `:1535-1554`) |
| `jsdoc-totals.regression-baseline.jsonc` | 33 | 32 | 15 | generated acceptance baseline after inventory; command documented at file lines 1-10 |
| `knip.regression-baseline.jsonc` | 11 | 11 | 4 | generated acceptance baseline; command documented at file lines 1-8 |
| `schema-catalog.generated.jsonc` | 17 | 16 | 6 | whole-repo pure snapshot; `bun run beep lint schema-catalog --write` (`standards/generated-artifacts.policy.md:9-12`) |
| `schema-crispening.policy.jsonc` | 3 | 3 | 0 | hand-authored blocking policy (`standards/schema-crispening.policy.jsonc:1-15`) |
| `schema-first.inventory.jsonc` | 77 | 70 | 31 | generated ratchet, but writer merges live scan with existing document (`SchemaFirstScan.ts:461-478`); `bun run beep lint schema-first --write` (`SchemaFirst.ts:380-388`) |
| `test-typecheck.blindspot-baseline.jsonc` | 8 | 8 | 3 | generated shrink-only baseline with preserved hand notes; command and semantics at file lines 1-10 |
| `changesets.retired-packages.json` | 5 | 5 | 1 | hand-authored retired-package exceptions (`standards/changesets.retired-packages.json:1-27`) |
| `effect-laws.allowlist.schema.json` | 3 | 3 | 0 | hand-authored schema |
| `fallow.boundaries.provenance.schema.json` | 3 | 3 | 0 | hand-authored schema |

Generated inventories/baselines use deterministic JSON object/array ordering, but are **not append-only**. More importantly, a baseline is an approval boundary: blindly regenerating one means accepting new debt. The existing standards policy requires whole-repo schema-catalog and JSDoc inventory refreshes to land only in dedicated chore PRs, because feature-branch regen absorbs unrelated drift (`standards/generated-artifacts.policy.md:3-27`); one measured regen produced ~27,790 JSDoc lines and ~2,246 schema-catalog lines, mostly unrelated, and both had to be reverted (`:29-37`).

The laws nuance is two-part: `effect-laws.allowlist.jsonc` itself is hand-authored, but it feeds a generated TypeScript snapshot. The package declares `codegen` as `GenerateEffectLawsAllowlistSnapshot.ts` (`packages/tooling/policy-pack/repo-configs/package.json:9`), and the allowlist check compares the expected module to the generated file and tells the operator to run package codegen when stale (`packages/tooling/tool/cli/src/commands/Laws/AllowlistCheck.ts:260-279`). A merge system must preserve the human exception records, then regenerate their companion; it must never regenerate the allowlist from violations.

## Ranked recommendations

### 1. Ship a hot-path-aware workstation publish admission queue

**Impact: very high. Effort: medium. Risk: low-medium.** This prevents redundant merges, local re-verifies, pushes, and hosted waves before they happen, while allowing disjoint PRs to proceed.

The repository already computes the needed input: `buildContestedIndex` maps paths to checkouts and retains paths claimed by two or more checkouts (`packages/tooling/tool/cli/src/commands/Worktree/Fleet.service.ts:342-402`). Reuse that service in Yeet rather than inventing another fleet scan.

Implementation sketch:

1. Define contention families, not only literal paths: `goal-portfolio` (`goals/*/ops/manifest.json`, `goals/INDEX.md`); `exploration-atlas` (`explorations/**/ops/manifest.json`, ATLAS); `workspace-topology` (`package.json`, `bun.lock`, root tsconfigs, syncpack, identity packages); `quality-policy` (`standards/*.json*`, `.fallowrc.jsonc`); `quality-cli` (`Quality/Tasks.ts` and its test).
2. Store machine-local state under `${XDG_RUNTIME_DIR}/beep-effect-publish/<hash-of-origin>/`, outside every checkout. Acquire a short metadata mutex with atomic `mkdir`; enqueue an immutable JSON request containing checkout, branch, PID/start-time, HEAD/base SHA, PR (if any), contention families, and timestamps.
3. Admit requests concurrently when their family sets are disjoint. Admit only one request per intersecting family. A small daemon is optional: Yeet can perform FIFO admission with a heartbeat and bounded polling.
4. Hold the claim across fresh-base merge/derived regeneration, merged verification, push, and successful admission to the final integration mechanism. Without GitHub merge queue, keep one hot PR in the merge-ready slot until it merges/closes or the operator explicitly releases it; do not block unrelated PRs. Use a lease plus PID/start-time and remote-head checks for stale-claim recovery; never delete a live claim just because its wall-clock age is high.
5. Surface backpressure directly: `waiting: goal-portfolio claimed by PR #N / branch X at SHA Y`; on release, wake the next request. Record queue wait separately from verification time.

This is the first thing I would ship because it attacks the 134-merge upstream cause without changing Git semantics or accepting policy state.

### 2. Add Yeet derived-only conflict auto-heal, with a strict allowlist

**Impact: high. Effort: medium-high. Risk: medium.** Yeet already parses exact conflict paths and currently refuses, telling the operator to merge main manually (`packages/tooling/tool/cli/src/commands/Yeet/internal/MergedPreview.ts:274-307`, `:499-529`). Insert a classifier between `git merge-tree` conflict parsing and refusal.

Safe auto-heal set now:

- `goals/INDEX.md` → `bun run beep goals index --write`;
- `standards/fallow.boundaries.generated.jsonc` → `bun run beep fallow boundaries --write`;
- `tsconfig.json`, `tsconfig.packages.json`, `syncpack.config.ts` → one `bun run beep tsconfig-sync` family regeneration (root aliases/references/sources are canonicalized; see `TsconfigSync.plan.ts:447-473`, `:606-660`, `:680-699`);
- `apps/professional-desktop/src/runtime/Migrations.gen.ts` → `bun run --cwd apps/professional-desktop codegen` (the file declares its source and command at lines 1-4).

Only auto-heal when **every conflicted path** is in that set and all of each generator's source files merged cleanly. Materialize a temporary merge worktree, seed conflicted outputs with either side only to make the tree readable, run the generator, require zero conflict markers, then rerun `git diff --check` and the generator's check mode. Emit the regenerated diff and generator receipt into the Yeet artifact. Any mixed conflict falls back to the existing refusal.

Explicitly excluded from auto-heal:

- ATLAS until its generator exists;
- all regression baselines, because regeneration changes the accepted-debt floor;
- `schema-first.inventory.jsonc`, because its merge uses the previous inventory and can preserve human justification/state;
- JSDoc inventory and schema catalog on feature PRs, because the dedicated-chore policy forbids absorbing global drift;
- `effect-laws.allowlist.jsonc`, provenance files, policy/schema files, `package.json`, and all source/tests;
- `bun.lock`, because lock resolution is not a pure textual projection and can require dependency resolution.

### 3. Use `.gitattributes` as a semantic tripwire, not `merge=union`

**Impact: medium-high. Effort: low for tripwire, medium for installed driver. Risk: low if fail-loud; high if it silently chooses a side.**

Exactly **none of the top 15** qualifies for `merge=union`. INDEX is sorted whole-file output; ATLAS is arbitrary Markdown; JSON/JSONC union can produce duplicate keys or invalid syntax; source, tests, manifests, and lockfiles all need semantic merging. `merge=union` is appropriate only for genuinely append-only text such as `explorations/*/CAPTURE.md` (the repo explicitly says CAPTURE is append-only at `explorations/README.md:169-173`), and even there same-line appends and provenance ordering deserve a validator. Do not apply it to ATLAS, INDEX, JSON, or JSONL event chains.

Add exact `.gitattributes` entries with `merge=regenerate` for the four safe generator families above. The driver should fail with a machine-readable `REGENERATE:<family>` result unless invoked through Yeet's temporary merged-tree coordinator. A `.gitattributes` name alone does not install a driver; clone bootstrap must install the matching repo-owned driver config, and CI must verify it. This fail-loud posture matches the existing retrospective recommendation (`goals/speed-loop/research/OPPORTUNITIES.md:1557-1563`) and avoids silently falling back to Git's text merge on machines missing config.

### 4. Remove structural hotspot ownership

**Impact: very high long-term. Effort: medium-high. Risk: medium.**

1. Implement the already-decided wholesale ATLAS generator from per-packet manifests. Keep any truly authored narrative in a separate cold file linked from the generated atlas. This turns nine-branch arbitrary contention into pure projection conflict.
2. Stop treating INDEX/ATLAS as authored PR payload. Best compatibility path: keep them tracked for GitHub navigation but have Yeet regenerate them only in the synthetic merged tree/final hot-path admission. Stronger end state: do not track them; publish CI artifacts and make repo tooling render on demand. The tradeoff is degraded GitHub browsing and existing deep links.
3. Shard acceptance baselines per package/owner (`standards/baselines/<gate>/<owner>.jsonc`) and compose them at runtime. That localizes conflicts and review of accepted debt. Do not use one append-only ledger as the primary gate unless entries have stable IDs and tombstones; deletion/resolution is a first-class baseline operation.
4. Convert hand-authored allowlist arrays into one immutable file per exception ID under `standards/effect-laws.allowlist.d/`, then generate the aggregate JSONC and TypeScript snapshot. This makes independent exceptions conflict-free and preserves reviewable ownership/expiry.

### 5. Adopt GitHub merge queue only after merge-group compatibility, and batch conservatively

**Impact: high correctness, uncertain speed until batched. Effort: high. Risk: medium-high operational/cost.**

The current workflow is not merge-queue-ready: it triggers only on `pull_request` and `push`, not `merge_group` (`.github/workflows/check.yml:1-7`). Nine places branch on `github.event_name == 'pull_request'`, and commitlint directly reads `github.event.pull_request.base.sha` (`check.yml:615-629`). Dependency review is also PR-event-only (`:800-805`). Merely enabling the GitHub setting would either omit required queue checks or run them with wrong base/range semantics.

The local descriptor currently freezes **16** required context names, not 17 (`packages/tooling/tool/cli/test/ci-lane.test.ts:38-55`); repo research says live ruleset 10240248 likewise had 16 and JSDoc Ratchet was visible but not required (`goals/ci-lane-economics/research/placement-decision.md:17-20`). Reconcile that drift before queue enablement, because required-context identity is the queue's contract.

The prompt's Blacksmith+EC2 premise is also stale relative to this checkout. Current `check.yml` places light matrix lanes on `ubuntu-24.04` and five PR verification lanes on `beep-ec2-heavy` (`.github/workflows/check.yml:46-115`); the recorded operator decision was a full Blacksmith exit after its invoice, followed by direct cutover of the five heavy lanes to EC2 (`goals/speed-loop/research/o6-execution-plan.md:181-193`). The queue design below therefore uses the current hosted-ubuntu + self-managed-EC2 economics. If an organization-level runner redirection exists outside the repository, local history cannot prove it.

Cost is material. Five PR lanes currently request `beep-ec2-heavy`; their measured p50s sum to about **39.1 fleet job-minutes per suite** (Lint Policy 10.5, Check 9.4, Integration 2.7, Docgen 2.9, Coverage 13.6), and coverage's p95 is 29.5 minutes (`goals/ci-lane-economics/research/cache-warm-lane-census.md:40-54`). The fleet caps at 14 one-job VMs and was sized for an overlapping push and PR wave (`infra/src/CiFleetController.ts:510-521`). A queue wave per PR therefore adds another near-full proof and can compete with ordinary PR waves; it does not make compute disappear.

What merge queue *does* eliminate is agents repeatedly merging newer main and republishing merely to get a current synthetic merge: GitHub owns the tested base+ordered-head group, removes a failing entry, and rebuilds later groups. It moves final-integration churn out of each checkout. It does **not** eliminate initial PR checks, review-triggered pushes, or rebuilds after a failed member. With one PR per group it adds a suite; with two compatible PRs per group it can amortize the final suite across both, but one failure can force group reconstruction.

Rollout:

1. Add `merge_group` and normalize a `base_sha/head_sha/change_kind` event adapter used by lane gating, commitlint, gitleaks, SAST, docgen affected mode, and dependency review. Add a local fixture test for every required context on merge-group payloads.
2. Start with one concurrent merge group and max batch size 2; batch only PRs that are already green and review-complete. Keep hot-family serialization so the batch does not contain two PRs that both mutate an unresolved hand-authored hotspot.
3. Measure `queue wait`, `groups rebuilt`, `fleet job-minutes per merged PR`, and `PR-head suites avoided`. Increase batch/concurrency only if merged-PR cost falls and the 14-runner cap is not producing pickup queues.
4. Fix the workflow concurrency key first: the repo already records an obsolete retry cancelling every current-head job (`goals/ci-lane-economics/research/OPPORTUNITIES.md:110-122`). Key by event kind plus exact head/group SHA so a stale diagnostic rerun cannot cancel the merge group or current PR head.

Merge queue is worth adopting for deterministic final integration, but it should be the **last** of the first wave, not the first response to hot files.

## Recommended shipping combination

Ship in this order:

1. **Machine publish admission queue + existing fleet contention scan.** It immediately prevents overlapping hot PRs from creating repeated local/hosted work.
2. **Yeet strict derived-only auto-heal** for INDEX, generated Fallow boundaries, root topology projections, and the desktop migration bundle. Everything else remains fail-loud.
3. **Wholesale generated ATLAS**, following the already-ratified D6 design, then add it to the safe auto-heal set.
4. **Merge-group-compatible CI and a batch-2 GitHub merge queue pilot**, after required-context drift and concurrency cancellation are fixed.
5. **Shard quality baselines/allowlists** as the longer-term removal of global ownership bottlenecks.

This combination prevents waste at the workstation boundary, makes pure projections self-healing, preserves human/policy review boundaries, and uses GitHub's queue only for the final ordering problem it is good at. It does not pretend that moving 16 required contexts into a queue makes their hosted/EC2 cost vanish.
