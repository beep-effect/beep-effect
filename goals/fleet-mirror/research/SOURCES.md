# Fleet Mirror — Sources & Provenance

- **Source exploration:** `explorations/fleet-coordination` — primary ledger:
  [`explorations/fleet-coordination/research/SOURCES.md`](../../../explorations/fleet-coordination/research/SOURCES.md).
- **Provenance:** five research tracks with adversarial verification (11 agents,
  ~1.39M tokens, 2026-08-04), synthesized in
  [`SYNTHESIS.md`](../../../explorations/fleet-coordination/research/SYNTHESIS.md);
  distilled in
  [`RESEARCH.md`](../../../explorations/fleet-coordination/RESEARCH.md).
  Graduated 2026-08-06 (PRs #562, #567).

Back-links, not copies — the exploration's ledger stays the primary. Reproduced
below only where an implementing agent needs the fact at hand.

## 1. Mined source corpus

The corpus is prior-art *evaluation*, and every candidate was rejected. Nothing
is ported. The full verdict table is
[`T1-prior-art.md`](../../../explorations/fleet-coordination/research/T1-prior-art.md).

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `T1` | Prior-art sweep — ~14 queries, 24 GitHub maturity checks, 10 README fetches | n/a | `explorations/fleet-coordination/research/T1-prior-art.md` | landscape | **reference only** — nothing adopted |
| `T2` | Blackboard / Linda tuple-space / lease theory | n/a | `.../T2-theory.md` | theory | reference |
| `T3` | Hook delivery-vector feasibility | n/a | `.../T3-delivery-vector.md` | delivery | reference (rung 2) |
| `T4` | Merge-queue cost model | n/a | `.../T4-merge-queue.md` | mechanical immunity | reference — deferred behind a named flip condition |
| `T5` | In-repo derivation surface | n/a | `.../T5-derivation.md` | derivation | **the build's basis** |
| `buzz` | `block/buzz` — Nostr-relay agent workspace | `github.com/block/buzz` | `.../T1-prior-art.md` addendum | message board | **reference only**, rejected — see below |

**How these inform implementation:** T5 is the only track the build follows
directly — it supplies the measured cost of every probe (`merge-tree` ~50–65 ms,
`/proc` 6.8 ms in Bun) and the corrections that became `SPEC.md` constraints. T1
establishes that nothing exists to buy. T3 is dormant until rung 2. T4 is a
deferral, not an input.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `block/buzz` | Apache-2.0 | **reference-only** | Two ideas, no code: identity-scoped agent membership, and the fact/ignorance distinction from `docs/welcome-kickoff-silent-failures.md` that produced this packet's `unknown` liveness state. |

No code is vendored or ported from any surveyed project. Nothing else in the
corpus reached a port decision, so no copyleft exposure exists.

## 3. External research sources

Full list with verification status:
[`explorations/fleet-coordination/research/SOURCES.md`](../../../explorations/fleet-coordination/research/SOURCES.md).

Load-bearing for implementation:

- Claude Code hooks reference — `code.claude.com/docs/en/hooks`. Relevant to
  rung 2 only; the injection channel is `hookSpecificOutput.additionalContext`,
  never plain stdout outside `UserPromptSubmit` / `UserPromptExpansion` /
  `SessionStart`.
- `git merge-tree`, `git ls-remote`, `git worktree` — verified against local
  `--help` and live behavior, not from memory. The `--force` flag on
  `worktree add` is why the PR→checkout join is one-to-many.
- **Citation-integrity note:** T1 originally attributed *"No broadcast by
  design"* to the MCP Agent Mail README. Verification found the phrase absent;
  both sites are marked refuted in place. Do not reuse the stronger claim.

## 4. In-repo capability references

Verified against `main` at `b4a06cefa3` by source search, **not assumed**.
Re-verified 2026-08-06 after PR-E landed as #569; the three rung-2 capabilities
below were still absent, so the rung split holds. **Re-run this check before
starting P1** — it is a claim about another session's unmerged work, and it rots
without warning.

| Capability | Path | Disposition |
|---|---|---|
| `beep worktree doctor` | `packages/tooling/tool/cli/src/commands/Worktree/Worktree.command.ts` — row schema `:216`/`:251`, report schema `:256`/`:281`, builder `:586` | **extend** — widen enumeration to all checkouts sharing the origin URL; leave the single-clone row schema unchanged |
| `git merge-tree --write-tree --name-only` | git plumbing | **reuse** — needs the target *object*, not just its SHA |
| `/proc/<pid>/cwd` scan | kernel | **reuse** — not universally readable; `EACCES` ⇒ `unknown` |
| `FleetCheckout` schema | — | **NET-NEW** (one schema row) |
| `beep worktree fleet` | — | **NET-NEW** (one subcommand) |
| Scanner object database | — | **NET-NEW** (one cache directory) |
| `AgentBrief` / `.fleet` | — | ⚠ **absent from `main`** — zero source references. Rung 2, ships in speed-loop PR-I. |
| `OwnershipClaim` | — | ⚠ **absent from `main`**. Rung 2; **wrap, never rebuild** (decision 37). |
| `beep agent report list` | — | ⚠ **absent from `main`**. Rung 2, optional enrichment. |

Net-new surface for the whole packet: **one widened enumeration, one schema row,
one subcommand, one cache directory.**

## 5. Cross-links & provenance

- Exploration packet:
  [`explorations/fleet-coordination/README.md`](../../../explorations/fleet-coordination/README.md)
  — `links.goals` points back here.
- Shaped pitch:
  [`BRIEF.md`](../../../explorations/fleet-coordination/BRIEF.md) — seeded this
  packet's non-goals (no-gos) and constraints (rabbit holes).
- Decomposition:
  [`MAP.md`](../../../explorations/fleet-coordination/MAP.md) — the rung split
  and the capability check reproduced in §4.
- Decision log:
  [`DECISIONS.md`](../../../explorations/fleet-coordination/DECISIONS.md) — D1–D5
  plus the D4/D5 amendments that produced the measured-or-`unknown` law, and the
  2026-08-06 rung-1 ruling.
- Cross-session handoffs:
  [`HANDOFF-2`](../../../explorations/fleet-coordination/research/HANDOFF-2-pre-push-and-guard.md)
  (what speed-loop owns) and
  [`AMENDMENTS`](../../../explorations/fleet-coordination/research/AMENDMENTS-from-beep-effect3.md)
  A6–A10 (their rulings back).
- Origin specimen: the #551 regression, recorded in
  [`CAPTURE.md`](../../../explorations/fleet-coordination/CAPTURE.md) — the live
  Mode B case this packet's proof test reconstructs.
