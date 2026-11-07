# Research

## 2026-11-07 — Measurements (workstation, 125 GiB, bun 1.4.4)

Scoped and full runs of `beep lint schema-catalog` (check mode; the `--write --stage` hook path builds
the same `Project`). `/usr/bin/time -v`, max RSS. Experiments were applied to
`packages/tooling/tool/cli/src/commands/Lint/SchemaCatalog.ts` and reverted; entry counts and the
"is current" verdict were identical in every variant.

| Variant | Scope | Max RSS | Wall | Entries |
| --- | --- | --- | --- | --- |
| as shipped | 5 staged files → 3 packages (`@beep/repo-cli` 2455 files, `@beep/epistemic-server` 78, `@beep/editor` 96) | 5.31 GB | 15.3 s | 2844 |
| `skipFileDependencyResolution: true` | same | 5.23 GB | 9.7 s | 2844 |
| syntactic same-file lookup instead of `identifier.getSymbol()` | same | 5.05 GB | 9.6 s | 2844 |
| as shipped | full repo (177 shards) | 16.9 GB | 31 s | 10235 |
| syntactic lookup | full repo | 13.4 GB | 24 s | 10235 |
| as shipped | 1 file → `@beep/alchemy-postgres` (5 files) | 1.00 GB | 3.0 s | 17 |
| `--help` (bun + CLI baseline) | — | 0.35 GB | 0.7 s | — |

Conclusions:

- The cost is not the type checker and not transitive import resolution. It is ts-morph wrapping
  every source file of each owning package, because a shard is per package and the scoped writer
  regenerates whole shards (`resolveShardScope` / `shardScopeIncludes` in `@beep/repo-cli-kit`).
  Touching one `@beep/repo-cli` file costs the whole package: roughly 1.7 GB per 1000 files on top
  of a 1 GB floor.
- On dankserver the same run held 4.18 GB RSS inside a 7 GiB `memory.high` slice shared with
  `t3 serve`, two Claude threads, vite, a bun server and a QA probe (see CAPTURE.md). It cannot be
  made safe there by flags; only an incremental per-file shard update (parse the staged files
  only, splice their entries into the existing shard) or not running it would fit.
- `skipFileDependencyResolution` is still worth keeping for the wall-time win (15 s → 10 s) once
  the symbol lookup is syntactic; alone it changes nothing material.

## 2026-11-07 — In-repo capability inventory

| Need | Found | Where | Notes |
| --- | --- | --- | --- |
| Memory-aware admission | yes | `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts`, `QualityScheduler.schemas.ts` (`AdmissionConfig`: slot 5 GiB, reserve 10 GiB, hard floor 15 GiB, cap 10 tokens) | `MemoryStats` reads `/proc/meminfo` `MemAvailable` and `MemTotal` only. A host with `totalGib < hardFloor + slot` (20 GiB) takes the `bypassAdmission` branch ("installed memory is below the scheduling envelope; coordinating … through the origin gate only") — the small host is the one with no admission control. |
| Environment posture vocabulary | yes | `ProofEnvProfile = LiteralKit(["local", "pr-posture", "hosted"])`, `ProofStage = LiteralKit(["repair-loop", "pre-push", "merged-preview", "hosted"])` in `QualityScheduler.schemas.ts` | A compute profile must compose with these, not duplicate `hosted`. |
| Hosted heavy admission | yes | `commands/Ci/HeavyAdmission.ts` (`ready-for-heavy` label, ruling 51), `CiAdmission.ts`, `CiLane.ts` | Same verdict in `check.yml` and `yeet monitor`. |
| Push without local proof | yes | `yeet open --body-file` (AGENTS.md Quality Operator, constrained-compute ruling 2026-10-24) | Time-triggered (10 min wait) and agent-discretionary; no host-class trigger. |
| Hosted-only gate skips with receipt | yes | `yeet final-check --skip <gate>=<reason>`; `yeet ready` prints skips for the PR body (`.claude/skills/yeet/references/gates-and-proof.md`) | Reason string is free text; no profile-derived default. |
| Gate catalogue and hosted contexts | yes | `gates-and-proof.md` gate table (`expectation-rewrite`, `cheap-gates`, `lint-policy`, `lint`, `repo-sanity`, `check`, `docgen`, `fallow`, `coverage`) | Schema catalog documented at "roughly 12.6 GiB RSS … use a 16 GiB runner envelope" (measured 16.9 GB today). |
| Pre-commit hooks | yes | `lefthook.yml` `schema-catalog`, `instrumentation-catalog` (`--write --stage {files}`), `biome check` over the diff | Motivated by #2522, #2526, #2540 (stale shards reaching main). No `lefthook-local.yml`, not gitignored. |
| ts-morph `Project` builders that could hit a worker | yes | `Lint/SchemaCatalog.ts`, `Lint/IdentityRegistry.ts`, `Lint/OpaqueRoundtrips.ts`, `Observability.service.ts`, `Docgen/internal/JsDocAnalysis.ts`, `Docgen/internal/quality/Quality.subjects.ts`, `Knowledge.command-surface.ts`, `DeletePackage/.../RegistrationGeometry.probes.ts`, `AgentEffectiveness/internal/EvalFixture.ts` | Unmeasured; the instrumentation-catalog hook is the second pre-commit writer. |
| Host pressure telemetry | yes | `commands/Palantiri/Palantiri.service.ts` host-pressure parcel (`/proc/pressure/*` + `MemoryStats`) | Workstation-only today; no per-host profile field. |
| Cgroup ceiling reader | NOT FOUND | `rg '/sys/fs/cgroup' packages/tooling/tool/cli/src` → none | Net-new, but the runtimes already expose it (below). |
| Host compute table in docs | NOT FOUND | `docs/runbooks/agent-pools.md` has pools, meters, seat map, lane recipes; `.claude/skills/remote-development-agents/SKILL.md` has routes and receipts | Neither says which gates a worker lane may run. |
| Worker provisioning | out of repo | dankserver repo `ansible/roles/development_worker` (worker slice `MemoryHigh` 7 GiB / `MemoryMax` 8 GiB; `t3 serve` inside the slice; home on `/dev/loop0` ← `home.ext4`, DIO off, rotational `sda`) | YubiKey-gated converge (`dankserver-ops-gotchas`). |

## 2026-11-07 — External landscape

- **Runtime cgroup awareness (measured here).** Inside a `systemd-run --user --scope -p MemoryMax=2G -p MemoryHigh=1536M`
  scope on this cgroup-v2 workstation, Bun 1.4.4 `process.constrainedMemory()` returned
  `memory.high` (1610612736) and Node `process.constrainedMemory()` returned `memory.max`
  (2147483648) with `process.availableMemory()` 2134917120. Unconstrained, Bun returns
  `os.totalmem()` and Node returns the 2^64 sentinel. So the profile probe needs no `/sys/fs/cgroup`
  parsing: `constrainedMemory()` with "≥ totalmem or sentinel ⇒ uncapped" is enough, and Bun's
  figure is the throttling threshold, which is the number that matters. Node documents the API as
  "memory available to the process based on OS limits, 0 when unknown"
  ([nodejs.cn mirror of process.constrainedMemory](https://nodejs.cn/api/process/process_constrainedmemory.html));
  it was wired from libuv `uv_get_constrained_memory` in
  [nodejs/node#27508](https://github.com/nodejs/node/pull/27508/commits). A crawler utility shows
  the manual fallback (`memory.max` v2 / `memory.limit_in_bytes` v1, then `os`)
  ([@crawlee/utils memory-info.js](https://app.unpkg.com/@crawlee/utils@3.16.0/files/internals/systemInfoV2/memory-info.js)).
- **lefthook conditional skips.** `skip` accepts `rebase`, `merge`, `merge-commit`, `ref: <branch>`
  and `run: <shell test>` where exit 0 means skip; it is valid per command as well as per hook
  ([lefthook.dev configuration/skip](https://lefthook.dev/configuration/skip/)). The documented
  env-driven form is a shell test, e.g. `- run: test "${NO_HOOK}" -eq 1`. `LEFTHOOK_EXCLUDE`
  takes a comma list of tags or command names and applies to commands, not scripts
  ([lefthook.dev LEFTHOOK_EXCLUDE](https://lefthook.dev/usage/envs/LEFTHOOK_EXCLUDE),
  [exclude_tags](https://lefthook.dev/configuration/exclude_tags/)). Version that introduced
  `skip.run` not stated on the page; the pinned lefthook is 2.2.2 and its bundled `schema.json`
  allows `skip` as boolean or array on Command, Hook, Job and Script.
- **Prior art for "skip locally, enforce in CI".** The Python pre-commit framework uses a `SKIP`
  env var (comma list of hook ids) because git passes environment but not flags to hooks
  ([adamj.eu: Git: how to skip hooks](https://adamj.eu/tech/2023/02/13/git-skip-hooks/),
  [pre-commit: various ways to run hooks](https://adamj.eu/tech/2022/10/20/pre-commit-various-ways-to-run-hooks/)).
  Projects such as binutils-gdb document making `SKIP` permanent in the developer's environment
  ([binutils-gdb .pre-commit-config.yaml](https://gnu.googlesource.com/binutils-gdb/+/b5e40fa57215854e567f5eb8895e893e47a06c8e/.pre-commit-config.yaml)).
  The pattern is identical to `LEFTHOOK_EXCLUDE`; the difference this packet needs is that the
  decision comes from a host profile, not a developer's taste.

## Constraints surfaced

- A hosted step that regenerates shards and pushes a commit moves the verdict head and the review
  window (`goal-closeout-ready-push-moves-verdict-head`, `review-window-starts-at-push-not-commit-date`);
  it must run before the ready flip and never after.
- `main` is PR-only and squash messages are commitlint input; a bot commit subject must stay ≤ 98 chars.
- `/proc/<pid>/io` of worker processes is unreadable to the admin user on dankserver; profile and
  pressure must be self-reported by the process, not observed from outside.
- Cursor and Junie lanes have their own sandboxes (D21); the profile probe must degrade to
  `workstation` where `constrainedMemory()` is unavailable rather than refusing work.

## Gaps for align

- beep-worker and tom-pc-1-wsl sizes and caps are unmeasured (SSH host key / port refused from
  the workstation tonight); the docs table needs rows from a working route.
- The instrumentation-catalog hook and the other ts-morph builders are unmeasured.
