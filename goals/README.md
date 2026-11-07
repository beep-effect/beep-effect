# Goals

This directory holds durable goal packets for repo initiatives, research, and
agent execution.

A goal packet is a docs-as-code contract: it gives humans and coding agents a
persistent objective, source hierarchy, decisions, verification surface, stop
conditions, and evidence trail. Execution-capable packets must be directly
runnable through a compact `/goal` launcher.

Packets may be born from a graduated exploration in
[`explorations/`](../explorations/README.md) — the repo's fuzzy front end for
brainstorming, research, alignment, and decomposition. Such packets keep a
back-link to their source exploration in `ops/manifest.json`.

## Packet Standard

New execution-capable packets must start from [`_template`](./_template).
Reference-only or research-only packets may use a lighter shape only when both
their `README.md` and manifest explicitly mark them non-executable.

```text
goals/<slug>/
  README.md
  SPEC.md
  PLAN.md
  GOAL.md
  ops/manifest.json
  research/
  history/
```

A packet has at most three concurrently open pull requests (operator ruling
2026-11-05, [`agent-pool-doctrine/history/2026-11-05-base-conflict-merge-main.md`](./agent-pool-doctrine/history/2026-11-05-base-conflict-merge-main.md)).
Every merge forces each other open sibling into a catch-up merge on the
packet's shared files, so a fourth change is sequenced behind one of the three
in the same lane or stacked on it; `bun run beep yeet siblings <pr>` lists a
PR's open packet siblings and their predicted conflicts.

### File Roles

| Path | Role |
| --- | --- |
| `README.md` | Orientation: status, mission, next action, launcher, reading order, evidence pointers. |
| `SPEC.md` | Normative reference: scope, non-goals, constraints, decisions, acceptance, stop conditions. |
| `PLAN.md` | Mutable execution plan: phases, sequencing, verification lane, current blockers. Its `## Checkpoints` block is generated from `decisions/` (`kind: checkpoint`). |
| `decisions/` | One file per decision or checkpoint, `<YYYY-MM-DD>-<topic>.md` with `GoalDecisionFrontmatter` (title, date, reversal, optional lane/pullRequest/kind). Lane-owned and conflict-free; `bun run beep goals decisions write` projects them into `SPEC.md`'s Decision log and `PLAN.md`'s Checkpoints blocks. |
| `GOAL.md` | Compact `/goal` launcher for execution agents. It delegates to `SPEC.md` and must not become the normative spec. |
| `ops/manifest.json` | Machine-readable routing: lifecycle, anchor document, launchers, phases, checks, assets. |
| `research/` | Source-backed exploration, tradeoffs, inventories, and freshness-dated notes. |
| `research/SOURCES.md` | Provenance ledger: mined sources, upstream licenses, external citations, in-repo bricks, and source-exploration cross-links (inherited at graduate; listed in `currentSourceOfTruth[]` by hand, while `researchReports[]` is generated from `research/` by `bun run beep goals manifest --write`). |
| `history/` | Archived outputs, closeouts, reflection logs, verification notes, and evidence. |
| `history/reflections/` | Per-session agent reflections written at P3 Close (and on demand via `/reflect`). One immutable file per run, named `<YYYY-MM-DD>-<agent>.md`, with schema-validated YAML frontmatter (`ReflectionFrontmatter`); enforced by `bun run beep lint reflection-artifacts` for packets with `reflectionRequired: true`. Start from `_template/history/reflections/_TEMPLATE.md`. |
| `ops/handoffs/` | Optional phase-specific handoffs or secondary execution packets. |
| `ops/prompts/` | Optional reusable prompts or prompt assets. |

### Decision Files

A decision is never appended to a shared tail. Each lane writes its own file,
`goals/<slug>/decisions/<YYYY-MM-DD>-<topic>.md`, through
`bun run beep goals decisions add <slug> --title "..." --reversal "..."
[--body "..."] [--lane <branch>] [--pr <n>] [--kind checkpoint]`, which also
regenerates the packet's blocks. The file is YAML frontmatter
(`title`, `date`, `reversal`, optional `kind`, `lane`, `pullRequest`) over a
Markdown body; the file-name date must equal the frontmatter date.

`SPEC.md`'s `## Decision log` and `PLAN.md`'s `## Checkpoints` each hold one
marker-delimited block (`<!-- beep:decisions:begin -->` ... `<!-- beep:decisions:end -->`)
rendered oldest-first from the directory. The block is a pure projection:
`bun run beep goals decisions check` and `bun run beep goals doctor` block on
`decision-log-drift` (block differs from the files) and `decision-file-invalid`
(name grammar, frontmatter, or date mismatch); `bun run beep goals decisions
write [--slug <slug>]` regenerates. Packets with no `decisions/` directory and
no marker are untouched: hand-written Decision Log tables written before this
convention stay frozen above the block (forward-only migration, see
`goals/goal-packet-conflict-free-appends/`). A sibling lane merging its own
decision files never conflicts with yours; after merging `main`, run `write`
once so the block covers both.

### Ops Script Registry

`ops/manifest.json` may declare an optional `opsScripts` list, one
`{ "path": "ops/<file>.ts", "purpose": "<one line>" }` entry per script. Once a
packet declares it, `bun run beep goals doctor` blocks on `ops-script-missing`
(a listed path that does not exist), `ops-script-unregistered` (an `ops/**/*.ts`
file with no entry), `ops-script-unregistrable` (an unlisted `*.ts` whose path
the entry pattern rejects, such as `ops/my probe.ts`; rename it) and
`ops-script-duplicate` (a path listed twice). Files under a dot-leading segment
(`ops/.scratch/`) are hidden scratch space and are not checked. Register a new
ops script in the same PR that adds it. Packets without the key are not
checked.

Every `goals/*/ops/**/*.ts` file, registered or not, is type-checked by
`goals/tsconfig.ops.json` on the `repo-sanity:goals-ops-typecheck` lane
(`bunx tsrs -p goals/tsconfig.ops.json --noEmit`). The project runs the
compiler only, not the Effect style profile: ops scripts are frozen evidence,
not product code. Ambient module types a script needs go in
`goals/ops-ambient.d.ts`, never under `ops/`, which holds only registered
scripts.

### Launcher Rule

Every future execution-capable packet must include `GOAL.md`.

- `GOAL.md` is a launcher, not doctrine.
- `SPEC.md` remains `initiative.packetAnchorDocument` unless a packet has no
  spec.
- `GOAL.md` must reference the packet docs instead of duplicating the full
  contract.
- Target size: at most 3,500 characters.
- Hard maximum: 4,000 characters.
- Verify with `wc -m < goals/<slug>/GOAL.md`.
- The standard launch command is:

```text
/goal follow the instructions in goals/<slug>/GOAL.md
```

New manifests must index launchers near the agent asset metadata:

```json
{
  "initiative": {
    "packetAnchorDocument": "SPEC.md"
  },
  "agentLaunchers": [
    {
      "kind": "codex-goal",
      "path": "GOAL.md",
      "targetChars": 3500,
      "maxChars": 4000,
      "command": "/goal follow the instructions in goals/<slug>/GOAL.md"
    }
  ]
}
```

The fleet convention migration completed through PR #855 and its D27 recovery
closeout. All 160 tracked goal packets plus `_template` now use
`initiative-manifest/v2`; the retained apply report is
[`packet-convention-migration/history/fleet-migration-report.md`](./packet-convention-migration/history/fleet-migration-report.md).
Use `bun run beep explore --check` as the drift check; its fleet lint
reports duplicate ids, dependency cycles and dangling references. (`goals
migrate-conventions` was retired in beep-cli-composition W0.) Do not restore legacy wire
shapes or infer a convention from historical packet examples.

## Lifecycle

Directory names do not encode lifecycle state. Lifecycle is declared once per
packet: `initiative.status` in `ops/manifest.json` is canonical, the README
`Lifecycle:` line mirrors it, and both tracked surfaces (plus the local
generated index) are written together by
`bun run beep goals set-status <slug> <status>`. The vocabulary is closed —
validated by the `GoalManifest` schema and enforced by
`bun run beep goals doctor`:

| State | Meaning |
| --- | --- |
| `active` | Execution is open and the packet must include `GOAL.md`. |
| `paused` | Execution is intentionally stopped, including authored-but-not-started packets; resume conditions must be explicit. |
| `completed-retained` | Implementation or proof is complete, but the packet remains as evidence or precedent. |
| `superseded` | Replaced by a successor; record `supersededBy` (slug) and `supersededNote` in the manifest. |
| `reference` | Retained as design/research precedent; not directly executable unless it has `GOAL.md`. |

Legacy tokens (`complete`, `pending`, `DONE`, bespoke progress strings, ...)
are no longer valid declarations; the 2026-07 migration preserved each
packet's original token in `statusNote`.

## Archive

Archiving is an operation, not a status. `bun run beep goals archive` moves a
terminal packet (`completed-retained`, `superseded`) to the public
`beep-effect/beep-effect-goals-archive` repo at the same path, then leaves a
tombstone on `main`. It is the default closeout step once the adoption PR merges:

1. `bun run beep goals archive --kind goals --slug <slug> --plan` prints the plan
   (files kept and moved, HEAD tree hash, inbound links) and its `planId`.
2. `bun run beep goals archive --kind goals --slug <slug> --write --expect <planId>`
   recomputes the plan, refuses a stale id, commits the mirrored tree to the
   local archive checkout (`--archive-dir`), verifies its tree hash, and only
   then rewrites `main`. The command never pushes.
3. Push the archive checkout (`git -C .repos/goals-archive push`) and confirm
   `git ls-remote` shows the archive commit before opening the packet-state PR,
   so no deletion reaches `main` ahead of its archived copy.

The tombstone keeps `ops/manifest.json`, a generated stub `README.md`
(lifecycle, mission, closeout, `provides`, headline finding, archive URL),
`history/reflections/` and `research/OPPORTUNITIES.md`; everything else moves.
The manifest gains an `archive` block: `repo`, `path`, `commit`, `contentHash`
(the verified git tree hash), `archivedAt`, `sourceCommit`. Links into moved
files are rewritten to the archive repo's `blob/main` URLs. The archive checkout
is provisioned by `beep refs` once the archive repo exists.

A terminal packet that must keep its full evidence on `main` declares
`retentionReason` instead. `bun run beep goals doctor` reports a terminal packet
with neither as the advisory `archive-decision-missing`.

`bun run beep goals harvest [--kind goals|explorations|all] [--check]` writes the
provenance ledger of reflection findings and todos, friction receipts, unchecked
plan items, status notes, stop conditions, decision titles and open questions,
each row citing file, line and commit; `--check` fails when it drifts.

## Completion gate

A goal is **achieved** only after exact-head hosted readiness and merge evidence
verify its final delivery PR. Local proof, a proposed lifecycle, and GitHub's
structural mergeability field do not establish achievement.

Ship the lifecycle intent and reflection in the final implementation PR. Keep
`initiative.status`, `lifecycle` (when present), the README `Lifecycle:` line,
and any external execution/session ledger operative (`active` or `paused`).
Declare the prospective closeout separately in `ops/manifest.json`:

```json
"proposedCloseout": {
  "status": "completed-retained",
  "finalPullRequest": 1582
}
```

The PR number identifies the final delivery PR, not this documentation's issue.
If `completionGate.pullRequests` declares a final PR, it must match the proposal.
`completionGate.acceptanceEvidence` must include a gating `yeet-verdict` reference
to the retained final-head verdict. Its `resolvedHeadSha` must match the accepted
head and `mergeReady.ready` must be true; missing or failed review/window/readiness
proof blocks promotion even when required hosted checks passed.
The reflection is required in this same PR even while the operative status stays
active. Phase entries may record completed implementation work; phase completion
and a proposal are neither hosted readiness nor merge evidence.

After merge, `bun run beep goals completion refresh --slug <slug>` explicitly observes
GitHub and writes a clone-scoped receipt. Portfolio and capability views derive
`completed-retained` only from a matching declaration/packet/final-PR receipt
whose merge facts, accepted head, hosted gating evidence and complete merge-time
required-check inventory revalidate. Unknown reads, stale heads, failed gates and
unmerged PRs retain the operative status. The proposal remains in the merged
manifest; no second PR is required to rewrite it as achieved. New clones refresh
their own receipts. Session `done` records session work, and must never be used
as goal completion proof; keep goal execution open until this verification passes.
Launchers must resume the outstanding gate work when a proposal is present.

The gate is declared in every goal manifest as `completionGate` and binds
regardless of phase names. Legacy packets without a proposal retain their
declared lifecycle and continue to receive the doctor's structured completion
advisories. Goals shipped before 2026-06-30 with
`completionGate.grandfathered: true` are not reopened or rewritten.

## Source Hierarchy

For packet creation and execution:

1. User objective or issue that created the packet.
2. Repo instructions: `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Architecture and package standards that govern the target surface.
4. The packet's `SPEC.md`.
5. The packet's `PLAN.md`.
6. The packet's `GOAL.md` launcher.
7. Supporting `research/`, `ops/`, and `history/` files.

Architecture doctrine and repo instructions outrank packet-local prose when they
conflict.

## New Packet Checklist

1. Copy the template:

```sh
cp -R goals/_template goals/<slug>
```

2. Replace placeholders in all files.
3. Set `initiative.packetAnchorDocument` to `SPEC.md`.
4. Keep `GOAL.md` under the launcher size limit:

```sh
test "$(wc -m < goals/<slug>/GOAL.md)" -le 4000
```

5. Validate the manifest and packet references:

```sh
jq . goals/<slug>/ops/manifest.json
rg -n "<slug>|GOAL.md|agentLaunchers|packetAnchorDocument" goals/<slug>
git diff --check -- goals/<slug>
```

6. Record decisions as files, never as `SPEC.md` tail edits:

```sh
bun run beep goals decisions add <slug> --title "..." --reversal "..." --body "..."
bun run beep goals decisions check --slug <slug>
```

6. If the packet is non-executable, remove `GOAL.md` only after marking the
   packet `reference` or `paused` with an explicit non-executable rationale in
   `README.md` and `ops/manifest.json`.

## Local Index Policy

This README defines the packet standard. It does not maintain a hand-written
list of packets. `goals/INDEX.md` is an ignored local projection, grouped by
canonical status with one row per tracked packet manifest.

```sh
bun run beep goals index --write   # regenerate goals/INDEX.md
bun run beep goals index --check   # prove generation and check a local copy when present
```

Do not link `goals/INDEX.md` as tracked GitHub truth or stage it. Generate it
locally when a portfolio table is useful; edit packet manifests instead.
`bun run beep yeet repair` regenerates it as one of its last fixers, so a pull
that moves goal manifests never leaves a stale copy behind for
`goals:index-check`.

## Research Basis

This standard follows the local agent-governance packet contracts and external
agent/documentation guidance:

- [OpenAI Codex prompting](https://developers.openai.com/codex/prompting)
- [OpenAI Codex slash commands](https://developers.openai.com/codex/cli/slash-commands)
- [Anthropic Claude Code best practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [GitHub Copilot coding agent best practices](https://docs.github.com/en/copilot/using-github-copilot/using-copilot-coding-agent-to-work-on-issues/best-practices-for-using-copilot-to-work-on-tasks)
- [AGENTS.md](https://agents.md/)
- [Diataxis](https://diataxis.fr/)
