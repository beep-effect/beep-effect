# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-11-07

Operator, mid-incident: "I'm thinking that for compute intensive jobs in beep-effect that agents
working on those boxes should not run those & instead defer to CI to handle such checks. How do
we do this & what changes to documentation, skills or tooling do we need to make in order to make
development on my boxes more feasible."

### Trigger incident (dankserver, 2026-11-07 ~22:00Z)

- T3 Code hub: Settings → Devices showed `dankserver … Offline`
  (`assets/2026-11-07-t3-devices-dankserver-offline.png`). Tailscale peer active, `tailscale serve`
  8448 → 127.0.0.1:3773 intact, `t3 serve` process alive (user `worker`, uid 1001).
- Host: 8 cores, 15.0 GiB installed, rebooted ~1 h earlier. Load average 42 with CPU idle;
  `/proc/pressure/io` full avg10 ≈ 91 %; `workingset_refault_file` ≈ 42 M; sda (rotational)
  reading 55–80 MB/s continuously; swap untouched. Every worker process in `D` state, including
  `t3 serve`, both T3 claude threads, vite, a bun server, a QA probe and four headless-chrome
  processes. `curl http://127.0.0.1:3773/` timed out at 8 s.
- Cgroup: `/sys/fs/cgroup/user.slice/user-1001.slice` memory.high 7.0 GiB, memory.max 8 GiB,
  memory.current 7.0 GiB (pinned at high → kernel throttling + page-cache eviction). The worker
  home is a loop file (`/dev/loop0` ← `/var/lib/dankserver-worker/home.ext4`, DIO off), so evicted
  pages re-read through loop0 → sda. The cap comes from the dankserver repo's ansible role
  `development_worker`.
- The elephant: pid 39445, `bun run packages/tooling/tool/cli/src/bin.ts -- lint schema-catalog
  --write --stage <staged files>`, RSS 4.18 GB, 86 s CPU over 22 min. Parent scope
  `t3code-claude-38dd9020.scope` — i.e. a T3 thread's `git commit` fired the lefthook pre-commit
  hook. SIGTERM ignored; SIGKILL freed it. T3 serve answered 200 within 5 s; io full dropped to
  9 % in 30 s. Hub still needed a manual Reconnect.
- `/proc/<pid>/io` of worker processes is unreadable to `elpresidank`; diagnosis used RSS,
  cgroup `memory.current`, `/proc/pressure/*`, `/proc/vmstat` and `/proc/diskstats` instead.
- Memory note written: `~/.claude/memory/beep-effect/dankserver-t3-offline-worker-slice-thrash.md`.

### What the repo already has (verified in source tonight)

- `lefthook.yml` pre-commit `schema-catalog` and `instrumentation-catalog` hooks run
  `beep lint schema-catalog --write --stage {files}` on every commit staging `{apps,packages,infra}/**/*.{ts,tsx}`.
  The comment says "scoped so a commit costs seconds" — true on a 125 GiB workstation, false in a
  7 GiB slice. They exist because hosted Repo Sanity caught stale shards too late in #2522, #2526,
  #2540 (2026-11-02). Removing them without a replacement reintroduces that red.
- `commands/Lint/SchemaCatalog.ts` `generateSchemaCatalogDocument`: `new Project({ skipAddingFilesFromTsConfig: true, tsConfigFilePath })`
  then `addSourceFileAtPath` per included file. `skipFileDependencyResolution` is NOT set, so the
  import graph is pulled in transitively — that is the 4 GB scoped / 12.6 GiB full (per
  `.claude/skills/yeet/references/gates-and-proof.md`: "a full scan needs roughly 12.6 GiB RSS and
  24 seconds … use a 16 GiB runner envelope"). The file has one type-level call (`getType(`/
  `getSymbol(`-class) — if the collector can be made purely syntactic, the writer gets cheap.
- `internal/repo-run/QualityScheduler*.ts`: admission tokens = 5 GiB, capacity
  `min(10, floor((MemAvailableGiB − 10) / 5))`, hard floor 15 GiB. `floorAttainable = totalGib ≥ 15 + 5`.
  dankserver (15.0 GiB) fails that, so the scheduler logs "installed memory is below the scheduling
  envelope; coordinating … through the origin gate only" and BYPASSES admission. Inversion: the
  smallest host gets no admission control. `MemoryStats` reads `/proc/meminfo` MemAvailable,
  never the cgroup `memory.high`/`memory.max` of the calling slice.
- `commands/Ci/HeavyAdmission.ts`: hosted heavy matrix admitted by the `ready-for-heavy` label
  only (ruling 51); same verdict in `check.yml` and `yeet monitor`.
- AGENTS.md Quality Operator: constrained-compute ruling (operator 2026-10-24) — after a local
  gate waits 10 min, stop it, keep package-scoped checks, `yeet open --body-file`, hosted CI is the
  proof. Time-triggered and agent-discretionary; on a worker host nothing waits 10 min, it is
  admitted instantly and thrashes.
- `yeet final-check --skip <gate>=<reason>` records hosted-only gates; `yeet ready` prints them for
  the PR body. `yeet open` pushes + drafts + labels + monitors with no local gate.
- `docs/runbooks/agent-pools.md` has pool order, meters, seat map, lane recipes — no per-host
  compute table. `.claude/skills/remote-development-agents/SKILL.md` covers worker selection,
  routes, receipts — nothing on which gates a worker lane may run.
- Palantiri `host-pressure` parcel already samples cpu/memory/io/admission for the workstation
  (`bun run beep session open`).

### Design sketch (fat marker, from the chat answer)

1. `ComputeProfile = LiteralKit(["workstation", "worker", "hosted"])` — resolution order:
   `BEEP_COMPUTE_PROFILE` env (written by the host's provisioning: dankserver ansible role,
   beep-worker bootstrap) → cgroup probe (walk up from `/proc/self/cgroup`, first non-`max`
   `memory.max`/`memory.high`) → `MemTotal`. Effective ceiling < scheduler envelope (20 GiB) ⇒ `worker`.
   One `Context.Service` in `internal/repo-run` beside `MemoryStats`; `MemoryStats` reports the
   cgroup ceiling as the available figure.
2. Profile-keyed gate routing table (one typed table, not scattered `if`s): worker profile keeps
   package-scoped lint+check of touched packages (`package-verify --quick` subset); schema-catalog,
   instrumentation-catalog, final-check, verify, docgen, coverage become hosted-only, auto-skipped
   with reason `compute-profile=worker` named in the PR body. Scheduler refuses hosted-only gates on
   worker hosts (pointing at `yeet open`) instead of bypassing admission.
3. Publish verbs follow the profile: on `worker`, `yeet publish` ≡ `yeet open` (push, draft,
   `ready-for-heavy`, monitor, no local proof); `yeet ready` accepts hosted cheap-tier green in
   place of the local final-check receipt. Verdict-head rules unchanged.
4. Hooks defer: interim — `LEFTHOOK_EXCLUDE=schema-catalog,instrumentation-catalog` in the worker
   accounts' environment (lefthook built-in, zero repo change). Durable — lefthook `skip` condition
   on the compute profile so the policy lives in the repo (lefthook pinned 2.2.2; verify `skip`
   syntax supports a command/env condition).
5. CI regenerates what the hooks used to: a hosted step runs the catalog writers on the PR head and
   pushes the shards as a commit — BEFORE the ready flip, because a bot push moves the review
   window and the verdict head (memory: `goal-closeout-ready-push-moves-verdict-head`).
6. Make the writer cheap regardless: `skipFileDependencyResolution: true` if the collector is
   syntactic; measure RSS before/after on the workstation. Highest-leverage single change; may
   shrink the problem before routing lands.

### Docs / skills / host changes

- AGENTS.md Quality Operator: 10-minute rule is for workstation hosts; worker-profile hosts never
  run hosted-only gates locally and always publish through `yeet open`.
- `docs/runbooks/agent-pools.md`: per-host compute table (DankStation 125 GiB; dankserver 15 GiB /
  7 GiB slice; beep-worker ?; tom-pc-1-wsl ?) with profile and allowed gates. beep-worker refused
  the SSH host key and tom-pc-1-wsl refused port 22 from the workstation tonight — rows need a
  working route (`remote-development-agents` skill).
- `remote-development-agents` skill: "what a worker lane may run" section. `yeet` skill
  `references/gates-and-proof.md`: profile column.
- dankserver repo (`ansible/roles/development_worker`): T3 serve shares the 7 GiB slice with every
  job; move `t3 serve` to its own slice so a runaway job cannot take the control plane down, or
  raise the cap. YubiKey-gated converge (`dankserver-ops-gotchas`).

### Open questions / things I am not sure about

- Does any gate on a worker host still need the full ts-morph program (e.g. `lint schema-first`,
  `effect-diagnostics`)? Inventory which `beep lint *` commands build a ts-morph `Project`.
- Should the profile be a host fact (env from provisioning) or a live measurement (cgroup probe)?
  Both? Which wins on disagreement?
- Hosted shard regeneration vs. "fix where found": a bot commit on the PR branch vs. a red that the
  owner fixes from a workstation. Which matches the push-first doctrine (D1–D11)?
- Is `hosted` a real profile (CI runners also run `beep` commands) or just the absence of local
  gating?
- Palantiri `host-pressure` could carry the profile per host for the orchestrator's lane routing.
