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

### File Roles

| Path | Role |
| --- | --- |
| `README.md` | Orientation: status, mission, next action, launcher, reading order, evidence pointers. |
| `SPEC.md` | Normative reference: scope, non-goals, constraints, decisions, acceptance, stop conditions. |
| `PLAN.md` | Mutable execution plan: phases, sequencing, verification lane, current blockers. |
| `GOAL.md` | Compact `/goal` launcher for execution agents. It delegates to `SPEC.md` and must not become the normative spec. |
| `ops/manifest.json` | Machine-readable routing: lifecycle, anchor document, launchers, phases, checks, assets. |
| `research/` | Source-backed exploration, tradeoffs, inventories, and freshness-dated notes. |
| `research/SOURCES.md` | Provenance ledger: mined sources, upstream licenses, external citations, in-repo bricks, and source-exploration cross-links (inherited at graduate; registered in `researchReports[]` + `currentSourceOfTruth[]`). |
| `history/` | Archived outputs, closeouts, reflection logs, verification notes, and evidence. |
| `history/reflections/` | Per-session agent reflections written at P3 Close (and on demand via `/reflect`). One immutable file per run, named `<YYYY-MM-DD>-<agent>.md`, with schema-validated YAML frontmatter (`ReflectionFrontmatter`); enforced by `bun run beep lint reflection-artifacts` for packets with `reflectionRequired: true`. Start from `_template/history/reflections/_TEMPLATE.md`. |
| `ops/handoffs/` | Optional phase-specific handoffs or secondary execution packets. |
| `ops/prompts/` | Optional reusable prompts or prompt assets. |

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
packet's original token in `statusNote`. Removal from the working tree is an
archive *operation*, not a status — a removed packet's history lives in git,
and physical `goals/_archive/` moves are a follow-up packet.

Completed packets are not always removed. Retain a completed packet only when it
continues to serve as evidence, reference design, or launch context for follow-up
work.

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
