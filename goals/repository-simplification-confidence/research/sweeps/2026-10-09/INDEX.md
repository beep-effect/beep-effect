## A-retire
Location: `research/sweeps/2026-10-09/A-retire.md`
- Counts, tracked removals: tools/skillopt 54 files, plugins/* 135, Impeccable payloads 154 + 149 (about 7 MB), .ai 1 empty file. Knip live refs are spread across about 60 non-history files (8 config/CI, about 25 repo-cli src, 18 tests plus fixtures, 8 standards/docs). History kept: Knip 408 goal files and 2257 exploration files.
- "Knip" is a required status check on the main ruleset (gh api). Remove the check.yml job and the ruleset context together (workstream E), or every PR blocks.
- The 41 known Knip findings are already in standards/knip.regression-baseline.jsonc (32 exports, 5 files, 2 types, 1 devDep, 1 unresolved). Transfer them before deletion.
- SkillOpt: the `agent-effectiveness evals score` scorer (`SkillOptTaskManifest`) is reused by docs/runbooks/agent-convention-comparisons.md. Keep it and remove only the Python trainer and its runbook. Compact record: goals/harness-evidence-ledger/history/p4-rerun/ plus ledger rows hl-20260929-* and hl-20261001-{f181b84d,500b0523}. Rows are immutable; add new rows, never edit.
- Impeccable is live: .codex/hooks.json PostToolUse and Stop hooks reach it through the .agents/skills symlink. Removing it also drops 4 root deps (css-select, css-tree, domutils, htmlparser2) that nothing else uses, plus 2 skills-provenance tests, 1 knowledge-refs test and 8 Models.seed seats (the 4 home seats go to F).
- map.html exists only in beep-effect2 (4,949,263 B, Fallow viz), ignored by .gitignore:41.
- .serena is untracked in 13 clones with no unique records; the only memory file is byte-identical in 5 clones. The serena entry in .mcp.json is disabled by .claude/settings.json.
- SST has no dependency; residue is .gitignore:107-109, two ESLint `.sst/**` globs and local sst-env.d.ts files (3 in the primary clone, 10 in beep-effect2).
- .ai/mcp/mcp.json has no consumer; ai-metrics only walks `.ai` as a generic config root.
- Workstream F gets ~/.codex/config.toml:30,34, which point at beep-effect21's repo Impeccable SKILL.md and will dangle.

## A-patches
Location: `research/sweeps/2026-10-09/A-patches.md`

5 retained patches swept. The installed files show all 5 applied. 2 have focused regression tests (platform filesystem, ONNX), and 3 do not (effect, xstate, drizzle). None of this was run, so no test has been shown to fail unpatched.

- **Effect patch (JSC error keys):** no focused test. The only detector is the incidental, flaky equality test in effect-drizzle `test/unit.test.ts`; it builds both errors through `.make()`, so it usually passes unpatched. The fix has not landed upstream: the Effect reference checkout at head 66257d2922 still deletes only `stack`. The platform-node-shared write fix has not landed upstream either.
- **Drizzle and xstate patches:** both change type declarations only, and no current test would catch their absence. `tsconfig.base.json:39` sets `skipLibCheck: true`, so an unpatched drizzle `SqlError` import silently becomes `any`. The xstate TS4023 error needs declaration emit, but every check and test config sets `declaration: false`; whether any lane runs declaration emit over the exported desktop intake machines is still an open question.
- **ONNX override:** declared in `package.json:342-344` as `"onnxruntime-node@1.30.0": {"adm-zip": "npm:fflate@0.8.3"}` and mirrored in `bun.lock`. The catalog allows `^1.30.0`, but the override and patch keys are exact, so a 1.30.x bump would silently drop both. The 7 cases in face-detection `OnnxRuntimeInstall.test.ts` cover the 3 cases in `scripts/test-onnxruntime-installer-patch.mjs`, so the script can move into the package. The script is wired into `check.yml:1073-1076` and `runSecurityScan` in `Quality.command.ts:1282`.
- **Docs out of date:** the xstate runbook (item 1) still cites the alpha.5 import-rewrite patch. The CI step name mentions an "OSV exception" that the ONNX `.md` says does not exist.

## A-retained-tools
Location: `research/sweeps/2026-10-09/A-retained-tools.md`
Headline counts: 9 surfaces checked at e62411d63f. 6 pass their live checks: tsconfig-sync --check, Stately scan finds 2 of 2 machines, cache profile is current, typos has 0 findings, lint:shadcn exits 0, compiler hashes match. Semgrep was not run (needs Docker). The other two, the iml and harness-ledger, are the gaps listed below.
- Semgrep has no rule fixtures: no positive or negative tests exist for its 3 first-party rules. Its image is untagged, the 4 `p/*` packs are fetched online, it scans only changed files and skips when none changed, and `.semgrepignore` names a file that no longer exists (`apps/desktop/...`).
- `_typos.toml`:
  - 4 words appear in no file (Uncommited, Definely, pxat, colorts).
  - 3 excludes point at removed paths (outputs/agent-reliability, repo-exports.catalog.{jsonc,md}) and 2 are covered by broader excludes.
  - The `turbo.json` //#lint:typos inputs copy the stale list.
  - CI pins typos 1.44.0 but 1.50.3 runs locally. 33 more words are not flagged by 1.50.3 and still need checking against 1.44.0.
- `beep-effect.iml` (181 excludeFolder entries, no machine-specific paths):
  - 159 entries exclude individual goals/explorations folders; 140 of the 299 at head are not covered.
  - The skillopt/.venv, .impeccable and .serena entries go stale once Workstream A removes those.
  - `docs`, `.patterns` and `research` are excluded from indexing with no recorded reason.
- Compiler provenance holds: `tsgo` and `tsc` both report 7.0.2+effect-tsgo.0.47.2, and the patched binary's sha256 equals the artifact's. The comment at `tsgo.js:10` still says 0.39. It needs re-checking after `prune-tsgo-backups.mjs` is ported.
- `harness-ledger/` (32 KB, 19 rows): no always-loaded repo file references it, and no ignore file (.rgignore, .aiignore, .graftignore, iml) excludes it. "Reduce exposure" most plausibly means adding `rows/` to those ignore files.
- `biome.identity.jsonc` copies stale entries from `biome.jsonc` (Impeccable, repo-exports.catalog, `specs`). It must be regenerated with `beep cache profile --write` after the removals. The Stately runbook gives older versions (0.37.2/0.12.3) than the installed 0.37.4/0.12.5.

## B-standards
The sweep is written: 129 files classified. Counts come from the committed artifacts; this read-only sweep re-ran no scanners.

Location: `research/sweeps/2026-10-09/B-standards.md`

**Classification:** about 70 policy, 30 historical, 8 generated, 5 remediation inventories, 3 exception registries plus the mixed effect-vitest inventory, 4 coverage floors, 4 catalogs plus docs/graphs, 3 copied-upstream `.patterns` files. That is 56 under `standards/`, 6 under `.patterns/`, 67 under `docs/`.

**Inventories:**
- schema-first: 115 entries, all exceptions, backlog 0.
- effect-vitest: 1,879 findings, 741 open and 1,138 exceptions with templated reasons (one reason string repeats 62 times).
- JSDoc: generated 2026-10-05, before PR #1552, so its 3,110 no-root-package-import count is probably stale.
- knip baseline 41, coverage 138 rows / 40 follow-ups, schema catalog 6,211, fallow health 181, cache baseline 2,087 nodes.
- Each artifact's refresh command is in the file.

**Most important facts:**
1. `.patterns/error-handling.md` and `.patterns/effect-library-development.md` teach `S.TaggedErrorClass`, which installed effect 4.0.2 and `packages/**/src` don't have; the current helper is `S.TaggedError` (583 uses). They also name `catchAll`, `catchSome`, `tapErrorCause`, `orElse`, `fork`/`join` and two Schedule combinators, none of which 4.0.2 exports. `module-organization.md`, `testing-patterns.md` and `README.md` were copied from effect-smol, contain a bulk `.ts-morph` corruption, and recommend whole-repo `biome check . --write`.
2. `standards/effect-first-development.md` and `standards/schema-first-development-prompt.md` use `Config.int`/`Config.redacted`, `S.toArbitrary` and `S.isIncludes`, none of which 4.0.2 exports. The prompt file also still advises `@example`/`@remarks`. Twelve architecture-chapter code samples use `@remarks`, and the binding JSDoc law's own example uses a schema that doesn't exist.
3. `RegistrationGeometry.plan.ts` names the wrong writer for the fallow health and dead-code baselines, and claims `fallow.boundaries.provenance.jsonc` is generated when nothing writes or validates it (97 rules vs 152 zones). `generated-artifacts.policy.md` lists only 3 of the 9 generated surfaces. `docs/agent-memory-infra/00-recommendation.md` still names Cognee as the dev-memory incumbent in current tense, with no superseded banner.

## C-scripts
Location: `research/sweeps/2026-10-09/C-scripts.md`
Counts across 22 rows (21 checklist entries plus scripts/graft): 8 retain, 10 port or move, 3 retire or remove. scripts/graft is retained as a workstation adapter, but `patches/{0.16.0,0.18.0,0.19.0}` (40 files) can be pruned because only graft 0.21.1 is installed.
1. Pre-runtime boundary. All 6 `ci-change-profile.sh` callers (check.yml 196/376/489/602, heavy.yml:121, storybook.yml:54) run before `setup-monorepo-ci`. The export step that runs `ci-job-env.mjs` (action.yml:256-275) runs before install (:298), and the Turbo-cache restore step (:287) depends on it. A direct swap to `bun run beep ci ...` cannot work without reordering the steps or using admission-job outputs. heavy.yml also needs a fallback for older PR checkouts.
2. Dead or superseded code:
   - `yeet-inbox-grok-tail.sh` has zero callers.
   - `cloud-session-setup.sh` is referenced only by the active `goals/cloud-agent-readiness` manifest's verification commands.
   - The ONNX script's 3 tests are a subset of the 7 in `packages/drivers/face-detection/test/OnnxRuntimeInstall.test.ts`.
   - Refs already has `plan` and `linkInto` but nothing that clones. The 5 `enable-turbo-remote-reads` tests are in `setup-effect-ref.test.ts`.
3. Drift:
   - The knowledge rewrite dry-run at head prints "3 applied, 224 already-applied" and exits 1: rules #0-#2 would re-apply to the portless and shadcn skill files, and rule #34 targets the git-ignored, missing `explorations/ATLAS.md`. `knowledge refs --check` still shows 0 live gated observations.
   - The installed `agent-runs.slice` differs from `scripts/systemd/`: the active drop-in is `50-heavy-budget.conf`, which no repo file names.
   - The `merge.regenerate` driver is not set in any of the three local clones; only CI installs it.
4. The root-input gap is documented at `PackageVerify.ts` `changedPackageNamesForPaths` and `ProofShadow.ts:606-630`: a change under `scripts/` trips nothing outside the six root inputs the proof epoch covers.

## D-changesets
Location: `research/sweeps/2026-10-09/D-changesets.md`

- Counts:
  - Changesets: 941 tracked files, 939 pending notes. 784 name packages (4,566 refs: 4,277 patch, 279 minor, 10 major); 148 have `{}` frontmatter; 7 are empty. 151 packages are referenced.
  - By month added: 1 / 59 / 222 / 255 / 299 / 103 (May to October). The `.changeset` tree oid is d839776128.
  - Workspaces: all 152 are `private: true`; 127 also carry a leftover `publishConfig` with `access: public` from the create-package template. All 152 names return 404 on npm. There are no release tags (remote or `professional-desktop-v*`) and no GitHub releases.
- How the gate works: `beep quality changeset-status` (`ChangesetStatus.ts` `uncoveredImpl`) runs in hosted Repo Sanity, a required check, on pull requests only, and in the local and Yeet cheap-gates. It reads `git diff <since>...HEAD`, so only committed changes count and only notes added in the range satisfy it. It never reads `private`, so every changed non-lab workspace with a version needs a note unless it is one of the 3 on the ignore list. `changeset-graph` separately checks that every note names a live or retired package.
- The notes do nothing outside our own gate. Installed `@changesets/config` 4.0.1 defaults `privatePackages` to version false, so stock tooling already skips private packages. The npm release workflow was retired in #775 (2026-08-23), and `DECISIONS.md` already records that no version has ever reached an outside consumer.
- Desktop release is independent of changesets. `release-desktop.yml` takes the version from `apps/professional-desktop/package.json` (0.0.3, same as `tauri.conf.json`; `Cargo.toml` is still 0.0.0). Since #775 nothing bumps that version automatically, so bumps are manual. `version-sync` only syncs toolchain versions and never reads changesets.
- Proposed reset:
  - Filter out private packages via a decoded `private` field in `ChangesetStatus`, so a package flipped to `private: false` is gated again automatically.
  - Make `changeset-graph` reject notes that name private packages, so they stop accumulating.
  - Make `delete-package` stop writing `{}` notes for private packages.
  - Delete all notes in one commit, recording the parent SHA, tree oid and counts, with recovery via `git checkout <parent> -- .changeset`.
- Policy text to update in the same PR: `AGENTS.md:180`, yeet `SKILL.md:1008`, `IssueClassification.ts:337`, `14-ecosystem-packages.md:118`, `15-lab-apps.md:54`.
- Open: GitHub Packages couldn't be checked because the token lacks `read:packages`. `@beep/ontology` is still listed as retired but is a live workspace.

## E-github
Location: `research/sweeps/2026-10-09/E-github.md`
Findings: 33 (1 P0, 5 P1, 10 P2, 17 P3). Read 11 workflows plus the setup action and the hosted settings, and mapped all 27 lane descriptors to their producing jobs.
- P0 E-01: Check run 37518935952 on main has been "waiting" on the `turbo-cache-write` deployment since 2026-10-06T19:26Z and holds the `Check-refs/heads/main` group. 39 of the last 40 main-push Check runs were cancelled, so main has had no cache-writer run and no post-merge proof since 10-06 13:30Z. This likely explains the brief's zero remote hits. Unblock needs a hosted write: `gh run cancel 37518935952`, or force-cancel.
- P1 E-02/E-03: `TURBO_TOKEN` is also a repo-level secret, so the environment does not enforce the writer boundary. `property-laws-nightly.yml` and `data-sync.yml` read it without the environment and bypass `ci-job-env.mjs`. With no `TURBO_API` set, the token goes to Turbo's default Vercel endpoint, which returns 403 (seen in the 10-08 log).
- P1 E-04/E-05/E-06:
  - Required checks disagree three ways. The live ruleset dropped Heavy / Coverage Regression (09-11) and Heavy / Lint Policy (09-25) and added JSDoc Ratchet. `CI_LANE_DESCRIPTORS` still marks the two Heavy contexts required, and the test only compares against a stale 2026-08-27 snapshot.
  - Dependency review is skipped on every PR even though the dependency graph is on (fails open).
  - The "Knip" context must leave the ruleset in the same change that deletes the job, or every PR stays blocked.
- P2 E-07: the size labeler is the `pr-size` job at `check.yml:20-49`. It only adds labels, so 17 of the last 200 PRs carry two or more `size/*` labels.
- Other P2s:
  - Storybook cancels main pushes, and 3,360 `storybook-static` artifacts (about 38 GiB) are kept 90 days.
  - The `professional-desktop-release` environment does not exist and the signing secrets are missing.
  - data-sync and cache-warm have failed on every recent run.
  - `repo-law` is still registered as active with no workflow file.

## F-agent-config
Location: private operational receipt (orchestrator briefs directory, `F-agent-config.md`)

Counts:
- Repo: 37 skills, 7 agents, 21 Claude hook commands and 14 Codex hook commands. 11 servers in `.mcp.json`, of which 5 load for Claude. 96 `AGENTS.md` files, 20 of them with no `CLAUDE.md` link.
- Clients: 4 clients share the Docker gateway on 127.0.0.1:8811. The gateway is v0.44.1 with 2 servers and 46 live tools. Claude's default instruction load is about 78 KB, roughly 19k tokens (estimated as bytes/4).
- Cleanup: 8 install points for Impeccable and 4 copies of the ontology/sparql skills. About 17 broken skill links, including `~/.agents/skills/turborepo`, which points at itself.

Key facts:
1. **Docker discrepancy resolved.** The gateway's systemd unit runs in legacy `--servers` mode with a hand-synced list, not `--profile <workstation>`, so no profile or tool allowlist applies. `docker mcp tools count` reports 0 because it reads the empty legacy registry files. The 314 figure is the catalog size. Claude, Grok and Junie store the gateway bearer token as a plain-text header (value not read).
2. **Model defaults have drifted.** `beep models check --offline` found 12 drifts: Codex is on `gpt-6-sol` at `ultra`, Claude `settings.json` has model `fable`, Grok effort is `xhigh`. Both global instruction files say the Codex and Claude defaults were verified on 2026-10-01. `~/.junie/AGENTS.md` is an unmanaged byte-identical copy of `~/.claude/CLAUDE.md`.
3. **`ai-sync` is not the projection owner.** It validates 5 files and has no Cursor id. Codex skills projection is `beep skills update`, which `--check` reports as drifted (`closeout` and `orchestrate` missing). `.codex/agents`, `.codex/hooks`, `.grok/skills/graft` and `.github/skills` are hand-copied with no owner.

## G-storage
Location: private operational receipt (orchestrator briefs directory, `G-storage.md`) Nothing was deleted. It contains no absolute home paths.

- **Headline counts:** 192 of 277 checkouts have a `.beep`, totalling 6,706 MiB and 59,478 files; 80% of those bytes have not been written since before 2026-10-01. By class: QA 2.17 GiB, generated output 1.81 GiB (1.6 GiB of that is 85 copies of the regenerable `ci/` jsdoc inventory), qualification 1.53 GiB, research 0.69 GiB, `yeet` 0.48 GiB. `~/.cache/beep` is 167.5 GiB apparent but only 18.8 GiB exclusive on btrfs. Three research-library relocation copies (about 45 GiB each) share most of their extents, so dropping two frees about 2–4 GiB, not about 90 GiB.
- **Turbo:**
  - The shared cache is `~/.cache/beep/turbo` (2.37 GiB, 23,349 artifacts, all written 10-02 to 10-09). It comes only from the environment (`~/.zshenv`, systemd, `.envrc`) or the CLI fallback, never from `turbo.json`; a bare `turbo` run without that variable falls back to `.turbo/cache` in the checkout. Two clones still hold populated per-checkout caches (`beep-effect-private` 260 MiB, `beep-effect0` 17 MiB).
  - 112 checkouts have the complete `.env` setup pinned to read-only remote (`local:rw,remote:r`, token as an `op://` reference); 191 have no `.env`. Remote writes happen only in CI (`cache-warm.yml`).
- **Run summaries:** `beep-effect3/.turbo/runs` is empty because the reaper keeps summaries for one day. In `beep-effect2`'s last 30 runs: 60 tasks, 48 local hits, 0 remote hits, 12 misses. All 12 misses are on tasks set to never cache (`knip:check`, `goals:doctor`, and the two fallow checks), so the cacheable hit rate is 48/48. No summary anywhere records a remote hit, and summaries don't record which cache mode a run used.
- **Liveness:** only one lock is held (`beep-effect/.beep/inbox/hook-mutex.lock`, with 18 inbox-hook processes queued on it), and all 40 pid files are stale. There are 383 proof-job records, one still running: `beep-effect2`, PR #1558, with an active systemd unit.
- **Legacy ledgers:** 13 worktree-local proof ledgers predate clone sharing (#1321) and need merging or archiving.
- **Existing tool:** `beep quality residue-reap` has no class for checkout `.beep` content. The proposed plan extends it with new classes.

## H1-catalog
Location: `research/sweeps/2026-10-09/H1-catalog.md`

Of the 16 candidates, 6 have no consumer at all: ajv, gl-bench, mdast-util-find-and-replace, rehype-stringify, remark-gfm and typedoc. No manifest, import or generator uses them.

The other 10 are still declared as `catalog:` in `scratchpad/package.json` (lines 49-62). The census missed them because Knip `ignoreWorkspaces` and Fallow both skip scratchpad.
- **Retain 3** as scratchpad-only holds. `@google-cloud/pubsub`, `@google-cloud/storage` and `@xenova/transformers` are imported by `scratchpad/effect-ontology`, which is live and typechecked.
- **Remove 7** with their scratchpad declarations. `@zip.js/zip.js`, exifreader, file-type, gray-matter, mediabunny, music-metadata and officeparser are declared but never imported.
- **Remove `pdfjs-dist` too** (catalog line 212, override line 345). It is never imported, and its only lock parent is officeparser.

Net: 14 catalog removals and 3 retained holds. No scaffolder, VersionSync or syncpack rule names any candidate.

The `@opentelemetry/propagator-jaeger` override (line 327) does nothing: `bun.lock` lists it only under overrides and never installs it, so remove it. The cause of the build-up is `.fallowrc.jsonc` lines 605-608, which turn off `unused-catalog-entries`, so no gate catches unused catalog entries.

There are 41 overrides and 6 patches. About 13 overrides have advisory or OSV evidence in commit bodies; 11 have no recorded reason and need one. The onnxruntime adm-zip→fflate hold already has a full record (`patches/onnxruntime-node@1.30.0.md`) that the other holds can copy. Three OSV exceptions in `osv-scanner.toml` (braces, http-cache-semantics, sprintf-js) expire on 2026-10-16. After that the required Security check goes red unless they are renewed.

## H2-goal-completion
Location: `research/sweeps/2026-10-09/H2-goal-completion.md`
- **Doctor at e62411d63f:** 211 packets, 0 blocking, 4 advisories. The 3 known `completion-gate-unsatisfied` advisories are there. The 4th is `stale-active`, raised by the uncommitted `goals/repository-simplification-confidence/` packet.
- **Census:** 110 non-grandfathered completed-retained packets.
  - 73 pass on a slug in a merge subject.
  - 29 pass only on a raw `mergedPullRequest`.
  - 5 pass only on a substring in a non-merge subject.
  - 3 fail.
- **Heuristic flaws:**
  - The completion gate's `citedAnywhere` scans all `git log -n 4000` subjects with a substring match, which allows prefix false positives such as `#142` matching `#1427`.
  - It never reads commit bodies, although the #1429 body names the slug.
  - The 4000-commit window slides, so older citations will drop out.
  - `mergedPullRequest` is untyped; it is read from raw JSON.
- **GitHub state:** #1429, #1462 and #1427 are all MERGED (2026-10-06) as squash merges. Each accepted head is not an ancestor of main, so an ancestry check would wrongly fail all three. All required contexts are green at each accepted head. #1429 and #1427 each have two non-required red Heavy lanes (Coverage Regression, Lint Policy).
- **No local evidence:** none of the 31 clone `.beep/yeet` stores holds acceptance evidence at any of the three accepted heads. Proof-ledger facts also expire, so a receipt must be built from GitHub observations plus a typed `finalPullRequest` declaration.
- **Plan:** additive optional `pullRequests` and `acceptanceEvidence` fields on `GoalCompletionGate`. A derived `GoalCompletionReceipt` holding repository, packet, declaration digest, final PR, accepted head, merge result (method squash/merge/rebase) and verification time, with a `verified`/`unsatisfied`/`unknown` outcome. Receipts stored clone-scoped and written only by an explicit refresh. Reuse `WorktreeMergedPullRequestProbe` and the `MergeGateRead` shapes.

## H3-telemetry
Location: private operational receipt (orchestrator briefs directory, `H3-telemetry.md`)

- **Stamp coverage, hook-pulse rows from 09-25 to 10-09:**
  - Claude: 332 sessions, 187 stamped (165 of 170 since 10-02).
  - Codex: 527 sessions, 0 stamped.
  - Cursor: 10 sessions, 0 stamped.
  - Junie and Grok: no writer and no `HookPulseAgentKind` literal, so they count as unsupported, not unused.
- **Dry run in this lane:** `harness-ledger prune-proposals` saw 0 sessions under the current hash (75212f0dfb8b). It skipped 187 sessions under other or mixed hashes and 2,694 unstamped ones; 48 candidates. Claude went through 115 distinct hashes in 9 days.
- **Codex attribution gap:** `.codex/hooks/hook-pulse.sh` is a stale fork. It drops `SessionStart` (line 250) and has no harness-hash or surface code. `.codex/hooks.json:4-21` does not register it on `SessionStart` at all. Codex hook trust (`~/.codex/config.toml [hooks.state]`) has 0 entries for lane worktrees, so Codex hooks in lanes may be skipped silently (not proven).
- **What the fingerprint leaves out:**
  - `deriveHarnessHash` (`harness-ledger.ts:647-651`) has no model or effort.
  - Global config is not included.
  - `.mcp.json` is outside the snapshot roots, even though prune candidates come from it, so adding or removing an MCP server never resets the zero-use window.
  - The hash takes in ignored files under `.claude/`, so checkouts on the same head probably get different hashes.
- **Window logic:** the window (`PruneWindow.ts` `foldPulse`/`regimeOf`) ignores `agentKind`, has no activity floor, and does not exclude disarm windows. Since `.agents/skills` links to `.claude/skills`, a skill only Codex uses would look zero-touch.
- **Transcript and Phoenix side:** the transcript forwarder stamps `config_snapshot_id` when ingest runs, not when the session ran (`forwarder.ts:1052`). Native OTel attributes carry no config fingerprint and no skill or MCP names, so Phoenix cannot count skill use.

## H4-desktop-permissions
Location: private operational receipt (orchestrator briefs directory, `H4-desktop-permissions.md`)

Counts:
- 1 guidance location records the issue: `~/.codex/AGENTS.md:63-80`. The repo, `~/.claude/rules` and `~/.claude/CLAUDE.md` have 0 hits.
- Codex rollouts: 522 scanned, 0 whose effective policy changed partway through. Of these, 79 are Codex Desktop rollouts (34 user, 45 subagent) and all stayed full-access.
- Claude Desktop session records: 262 (164 `bypassPermissions`, 90 `auto`, 3 `default`, 3 `plan`, 1 unset).

Key facts:
1. The recorded defect is in ChatGPT Desktop (the Codex app), not Claude Desktop. Resuming an existing thread through the app's `send_message_to_thread` path can bring it back as `managed`/`workspace-write`/`on-request` while the composer still shows Full access. No reproducer artifact exists, and the GUI check was never run on any build. The installed `chatgpt-bin 26.1007` is unverified. The 45 subagent threads are the first evidence that native subagent follow-up keeps permissions.
2. Drift: `~/.codex/config.toml` has `default_permissions = ":danger-full-access"` (line 5) and the legacy `sandbox_mode` key (line 11) at the same time. OpenAI's docs say these do not compose, and the 2026-08-29 migration had removed `sandbox_mode`; it is back.
3. Claude side: the project `.claude/settings.json:94` `defaultMode: "default"` sets the app's default mode below the user's `auto`. Every bypass session therefore relies on a per-session choice stored in the app (`permissionMode`/`bypassChosenInApp`). Whether that choice survives a dormant resume is untested. The transcript records `permissionMode` sparsely (1 of 64 user rows), so a behavioural probe is needed alongside `get_session`. The file also has fixture designs for all four routes on both apps.

## V-vitest-canon
Location: `research/sweeps/2026-10-09/V-vitest-canon.md`

Counts: 6 lanes. Continuation (`e4c608f9c1`) contains every commit from the other five lanes. It holds 16 commits that never reached GitHub, and its remote branch is deleted. Measured from #1506's state, that unpublished delta is 53 files: 30 code files (+1,765/−543, including `RatchetDiff.ts`), 22 goal-packet files and the inventory. 31 of the 53 overlap main, almost all through #1552's import rewrite. The detector-resources lane also has 6 unstaged test files (+491/−455) that are in no commit; they cover 23 open findings on main.

Key facts:
1. PR #1506 is MERGED (2026-10-06T20:29Z, squash `705ab128c0`). Its branch name is continuation's, but it merged a separate head, `c921d9e11d`, made in a retired conflict-only lane from the first 7 commits plus a main merge. Continuation's staged notes, which call it the "PR #1506 consolidated" branch, are therefore false and must be rewritten.
2. The tree of `c921d9e11d` is identical to main's squash `705ab128c0`. So `git diff c921d9e11d e4c608f9c1`, applied three-way, cleanly transfers the delta onto a fresh lane from main. Do not `git merge` continuation: a merge would replay all of #1506 against the #1552 rewrite.
3. Main's inventory is now on Effect Vitest 4.0.2 with 1,879 findings (741 open, 634 in `@beep/repo-cli`); the lanes are on 4.0.1. #1552 shifted line-based finding IDs (1,332 vs 1,374 non-matching). Regenerate it with `bun run beep lint effect-vitest --write` instead of merging it.

Lane dispositions: baseline, property-values, resource-next and property-boundaries are superseded. Detector-resources is superseded except its working-tree changes, which must be saved as a patch first. Continuation is the source for the new integration lane, which then needs a fresh full package proof.

## Critic gaps (19) → follow-ups run: 19

- [A-knip-dispositions] 2.A Knip ("transfer findings into a one-time remediation list ... fix genuine issues and document legitimate cases"); 5 Stage 2 exit; 7 named unmatched candidates: A-retire lists the 41 baseline findings by kind and file but gives no per-finding disposition (genuine dead code to fix vs legitimate case to document, with the reason). The reproduction at e62411d63f
- [H1-syncpack-held-back] 2.H1 ("for retained overrides and holds, record consumer, failure evidence, owner, and exit condition; when an exit condition is met, run compatibility proof and remove or explicitly renew"): H1 covers catalog reservations, root overrides and patches, but not the compatibility-hold group in syncpack.config.ts updateGroups (label 'Held back — do not auto-update', about lines 128-195): types
- [H1-override-evidence] 2.H1 hold records (failure evidence, owner): H1 marks 11 overrides 'needs reason' with no failure evidence: @hono/node-server, browserslist, ip-address, detailed-xml-validator, minimatch, nanoid, postcss, protobufjs, uuid, @opentelemetry/exporte
- [B-detector-false-positives] 2.B items 2-4; 4 'Detector repairs' (paired false-positive and true-positive fixtures; individually reviewed exceptions): B classifies the inventories and counts exceptions, but no sweep identifies any concrete detector false-positive class, or the existing fixture and test files per detector to extend. Exception review
- [B-inline-suppressions] 2.B items 2-5 (honest zero debt; no relabelling ordinary debt as exceptions or broad exclusions): No sweep censuses inline suppressions and config-level exclusions, which carry debt invisible to the standards inventories: eslint-disable, oxlint-disable, biome-ignore, @ts-expect-error / @ts-ignore,
- [B-skills-stale-api] 2.B (replace stale copied guidance with tested examples or pointers; verify agent discovery; obsolete JSDoc tags, legacy error helpers, whole-repo formatting advice); 7 canonical authorities (applicable Effect/schema skills): B's API-name check covered only standards/, .patterns/ and docs/runbooks/. The repo skills that agents actually load (.claude/skills/effect-first-development, schema-first-development and its 4 refere
- [C-ownership-facts] 2.C (regenerate task-facing package scripts through their owner command; update callers) and 4 'Script ports' (updated callers): C left facts open that a read-only pass can settle. (a) Does `beep lint package-scripts` own the root package.json scripts (prepare, knowledge:refs-rewrite, knip, impeccable:detect) or only workspace
- [F-measured-baseline] 2.F 'Measure before and after' (default advertised tool count and schema/instruction size; measured token usage where available; representative workflow success, activation steps, latency, failures; actual cost only from a valid source): F gives byte/4 token estimates and a tool roster for one Claude desktop subagent only. No sweep measures: (1) actual first-turn context tokens per harness from local transcripts (Claude transcript usa
- [F-owned-fields-and-routes] 2.F items 2-3 (owned-field transformations with backup, drift detection, validation, rollback; preserve unowned native fields); 1 model assignments (restore defaults, preserve lightweight and research routes); 4 'Global configuration' acceptance: F recommends 'beep models apply' for home configs but no sweep establishes whether that writer edits only owned fields, preserves unknown native fields (for example the 494 projects and 311 hooks.stat
- [F-junie-grok-other-clients] 1 model assignments (verify Junie behavior without inventing a fallback chain); 2.F (cover Codex, Claude, Cursor, Junie, Grok and other discovered relevant clients; on-demand workflows across supported harnesses): F leaves open whether Junie reads repo AGENTS.md, ~/.junie/AGENTS.md, .junie/skills/adhd, or MCP, and whether Grok reads repo AGENTS.md, .claude/skills, .agents/skills or .mcp.json (compat layer scope
- [F-ledger-interview-link] 2.F item 7 (keep the harness ledger append-only via its supported writer; link the approved interview decisions to execution records): No sweep establishes where the approved 2026-10-09 interview decisions are recorded (Notion brief, ledger rows, packet) or how the harness-ledger schema can reference them (decision-chain fields, supe
- [G-remote-artifact] 2.G Turbo step 2 (cold remote-read fixture using an existing trusted remote artifact); 4 'Cache' acceptance (explicit remote hit): G finds no summary with remote hits, and E finds no trusted main writer has completed since 2026-10-06 (run 37518935952 stalled). No sweep identifies a candidate task hash that a trusted CI writer act
- [G-harness-cache-env] 2.G Turbo step 1 (verify effective local cache paths across the clone/worktree inventory): G shows that bare turbo without TURBO_CACHE_DIR falls back to .turbo/cache, and that two checkouts have populated per-checkout caches, but does not establish which agent launch routes run without the
- [G-retention-preconditions] 2.G (dry-run report with recovery destination; skip unverified terminal state; apply recoverable after interruption); 3 retention interface; 4 'Storage' acceptance (interrupted cleanup recoverable, evidence preserved): G proposes extending residue-reap but never examines whether its existing --apply path is interruption-safe: a journal or two-phase move to an archive vs rm, how a half-finished apply is detected and
- [H3-codex-lane-trust-and-drops] 2.H3 (distinguish disabled collection, dropped events, unsupported clients, mixed fingerprints, genuinely unused capabilities): H3 infers but does not prove that Codex hooks are untrusted, and silently skipped, in lane worktrees with no [hooks.state] entry. It does not measure dropped events: tool calls present in transcripts
- [H3-phoenix-read] 2.F evidence sources (detailed local agent history and Phoenix data on <metrics-host>); 2.H3 (validate current-configuration events and counters): H3 documents the Phoenix and Prometheus access route but ran no query. No sweep establishes what native OTel and forwarder data exist for 2026-10-01..10-09: span or metric counts per harness, presence
- [H2-timeline-and-inherited-reds] 2.H2 (reconcile the three doctor advisories individually against actual GitHub and acceptance evidence); 3 goal completion (unknown vs unsatisfied): H2 leaves open (a) whether GitHub timeline events (ready_for_review, converted_to_draft) for PR #1427 can satisfy push-first-publish's extra 'draft → yeet ready → merge-ready' statement, and (b) wheth
- [H4-codex-config-and-rollout] 2.H4 (inspect effective execution policy; repair available configuration controls): H4 leaves two read-only facts open. (a) What re-added legacy `sandbox_mode` to ~/.codex/config.toml after the 2026-08-29 profile migration? The 9 config.toml.bak* files were not diffed. (b) Does a Cod
- [V-other-worktrees-and-detector-delta] 1 existing work boundaries (preserve and reconcile effect-vitest-canon unpublished lanes and staged work); 2.B item 6: V reconciles the six named lanes but explicitly leaves 41 other effect-vitest-* worktrees under ~/YeeBois/projects/beep-effect2-worktrees/ unassessed. Any of them could hold unpublished or uncommitted
