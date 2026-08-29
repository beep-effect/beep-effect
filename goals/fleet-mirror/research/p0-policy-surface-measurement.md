# P0 — Policy-surface measurement and schema home

**Date:** 2026-08-06
**Window:** `be6c67e959..9d2b12cc67`, **300 first-parent commits**, 2026-07-01 → 2026-08-06.
**Binding law (SPEC):** no path enters the policy surface unmeasured.

Reproduce — **both ends are pinned SHAs on purpose**:

```sh
BASE=be6c67e959fa2d1406a606f668c02cbf1237a1f3   # 2026-07-01
TIP=9d2b12cc67fbcd9787040c0c14cf6dbded17c311    # 2026-08-06, main at measurement time
git rev-list --first-parent --count "$BASE".."$TIP" -- <pathspec>
```

⚠ **Do not float either end against `origin/main`.** The first version of this recipe derived
both ends from the live ref, so re-running it after main advanced silently measured a
*different* window and could not reproduce the figures below — a recorded measurement that
quietly changes meaning as the base moves. Verified: the pinned range reproduces every number
in §1 and §2 exactly. To measure a *new* window, pin new SHAs and record them; do not reuse
this section's numbers with a different range.

⚠ **Measurement pitfall, hit and corrected during this pass.** `git log -n 300 -- <path>`
applies `-n` **after** path filtering, so it returns "the most recent 300 commits that
touched X", not "of the last 300 commits, how many touched X". That reads 100% for any
path with ≥300 lifetime commits. Every number below uses an explicit `BASE..HEAD` range.

## 1. Per-path frequency

| Path | Hits/300 | % | Verdict |
|---|---:|---:|---|
| `.changeset/config.json` | 1 | 0.3% | candidate |
| `lefthook.yml` | 1 | 0.3% | candidate |
| `.oxlintrc.json` | 1 | 0.3% | candidate |
| `CLAUDE.md` | 1 | 0.3% | candidate |
| `.patterns/**` | 2 | 0.7% | candidate |
| `commitlint.config.*` | 3 | 1.0% | candidate |
| `.claude/hooks/**` | 3 | 1.0% | candidate |
| `.gitleaks.toml` | 4 | 1.3% | candidate |
| `biome.json*` | 5 | 1.7% | candidate |
| `.claude/settings.json` | 11 | 3.7% | candidate |
| `turbo.json` | 11 | 3.7% | candidate |
| `vitest*` | 12 | 4.0% | borderline |
| `AGENTS.md` | 14 | 4.7% | candidate |
| `.claude/skills/**` | 20 | 6.7% | candidate |
| `packages/tooling/tool/cli/src/commands/Yeet/**` | 20 | 6.7% | candidate |
| `.github/workflows/**` | 22 | 7.3% | borderline |
| `apps/*/package.json` | 27 | 9.0% | reject |
| `packages/*/*/*/package.json` | 38 | 12.7% | reject |
| `tsconfig*.json` | 48 | 16.0% | reject |
| `package.json` (root) | 57 | 19.0% | reject |
| `packages/tooling/tool/cli/src/commands/**` | 77 | 25.7% | reject |
| `packages/tooling/tool/cli/**` | 82 | 27.3% | reject |
| `bun.lock` | 87 | 29.0% | reject |
| `packages/tooling/**` | 98 | 32.7% | reject |
| `standards/**` | 119 | 39.7% | reject |
| `.github/actions/**` | 0 | 0.0% | candidate (exists, stable) |

**Excluded as not-measurable, not as safe** — a 0.0% reading is meaningless when the path
does not exist or is untracked:

| Path | Why excluded |
|---|---|
| `knip.json` | **Does not exist** in the repo |
| `docgen.json` | **Does not exist** in the repo |
| `.beep/**` | Exists but **0 tracked files** — gitignored, carries no laws |
| `oxlint.json`, `rust-toolchain.toml` | Do not exist (`.oxlintrc.json` is the real path) |

## 2. Union firing rates — the number that decides the surface

Per-path frequency is not the cost; the **union** is, because any one path firing produces
one bulletin.

| Surface | Composition | Hits/300 | % | ≈ firings/day @ 8 merges/day |
|---|---|---:|---:|---:|
| **A** | core config only | 24 | 8.0% | 0.6 |
| **B** | A + CI workflows/actions | 37 | 12.3% | 1.0 |
| **C** | B + root tsconfigs | 72 | 24.0% | 1.9 |
| **D** | the research's rejected 14-path shape | 145 | **48.3%** | 3.9 |
| **E** | B + shared-behavior surfaces | 71 | 23.7% | 1.9 |
| **F** | A + shared-behavior surfaces | 60 | 20.0% | 1.6 |

**Surface D reproduces the research's rejection independently** — 48.3% here against 52.6%
measured on a different window on 2026-08-04. Same verdict, different data.

## 3. The finding that matters: back-testing against real specimens

Three Mode B events were observed on this workstation between 2026-08-04 and 2026-08-06.
Testing candidate surfaces against them rather than against intuition:

| Specimen | What broke | Paths touched | Fires under B? | Under E? |
|---|---|---|---|---|
| #551 `aee2664b91` | every `yeet publish` without `--monitor` exited 1 | `packages/tooling/tool/cli/src/commands/Yeet/**`, `bun.lock` | **no** | **yes** |
| #569 `b4a06cefa3` | rotted in-flight claims in another clone | `.../commands/Yeet/**`, `.claude/skills/yeet`, `.changeset/**` | **no** | **yes** |
| #576 `39945d95ef` | INDEX drift; required gate red on `main` | `goals/INDEX.md`, `.patterns/jsdoc-documentation.md` | **no** | **yes** |

**Surface B — the config-only surface the design assumed — would have fired on zero of
three.** Every observed specimen was a change to shared *behavior* (the operator command
every agent runs, the skills that drive it, the patterns that govern authoring), not to a
lint or CI config file.

This does not mean config paths are wrong to include: a biome rule or a new required check
genuinely does break in-flight PRs, and that class simply did not occur in this three-event
sample. It means the config-only framing was **incomplete**, and the incompleteness was
invisible until the surface was tested against events instead of reasoned about.

Caveat, stated plainly: **n = 3, and the sample is biased** — these are the specimens that
happened to be noticed, which selects for events that produced a visible failure. Absence of
a config-path specimen is weak evidence, not proof.

## 4. Recommendation

**Adopt surface E (23.7%, ≈1.9 bulletins/day)** — core config + CI + a narrow, measured
shared-behavior set:

```
biome.json*  turbo.json  .gitleaks.toml  commitlint.config.*  lefthook.yml
.oxlintrc.json  .changeset/config.json
.github/workflows/**  .github/actions/**
packages/tooling/tool/cli/src/commands/Yeet/**
.claude/hooks/**  .claude/skills/**  .claude/settings.json
CLAUDE.md  AGENTS.md  .patterns/**
```

Every entry is individually ≤7.3% and is there because a change to it alters behavior for
checkouts that never touched the file — the definition of Mode B.

**Why 23.7% is acceptable here and 48.3% was not.** The research's K6 rejection was of a
**hard-fail publish guard**, where 53% meant blocking half of all publishes. Signal 3 is a
**bulletin** (D3/D4): it says "main moved onto something that governs your work; consider
rebasing at your next checkpoint." Roughly two epoch-stamped bulletins a day, silent when
the epoch is unchanged, is a different cost curve entirely. **This surface must not become a
gate without being re-measured against the gate's cost function.**

Explicitly rejected and why: `tsconfig*.json` (16.0%) and root `package.json` (19.0%) are
genuine policy but too frequent — dependency and config churn dominates their commits;
`standards/**` (39.7%) and `packages/tooling/**` (32.7%) are whole subsystems, not policy
surfaces.

## 5. Schema home for `FleetCheckout`

`packages/tooling/tool/cli/src/commands/Worktree/Worktree.command.ts` already carries the
schema family, all `S.Class` with `$I` identity composers and `$I.annote` descriptions:

- `WorktreeDoctorEntry` (`:238`) — per-worktree row: `path`, `branch`, `detached`, `locked`,
  `prunable`, `clean`, `changeCount`, `hasEnv`, `hasNodeModules`.
- `WorktreeDoctorReport` (`:272`) — `mainCheckout`, `worktreesRoot`, `entries[]`,
  `pruneDryRun[]`.

**Decision: `FleetCheckout` is a sibling class in the same file, not an extension of
`WorktreeDoctorEntry`.** They answer different questions — `doctor` asks "is *this* checkout
healthy" (single-clone, all fields locally knowable), the mirror asks "what is the *fleet*
doing" (cross-clone, every derived field must be expressible as `unknown`). `SPEC.md`
forbids changing `doctor`'s row schema, and widening it with three-state fields would do
exactly that.

The file is 881 lines with 16 exports; adding one class plus a snapshot wrapper is within
its existing shape. Revisit splitting only if the mirror's derivation service lands here too.

## 6. Open items for P1

- The bar itself is **not** a fixed percentage. What was measured is the union cost; the
  admission rule is "individually low-frequency **and** governs behavior for checkouts that
  never touched it." Any future addition re-runs §1 and §2.
- Re-run this measurement when the window has moved materially; every number here is a
  point-in-time fact about the pinned `be6c67e959..9d2b12cc67` window, not a constant. A
  re-run **records new pinned SHAs alongside its numbers** rather than overwriting these —
  otherwise the artifact loses the ability to say which window produced which figure.
- `vitest*` (4.0%) is a defensible addition and was left out only because no specimen
  implicated it; add it if a test-config change ever produces one.
