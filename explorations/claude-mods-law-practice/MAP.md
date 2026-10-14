# Map

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `practice-claude-mod` (promised now) | Ship one Claude Code plugin for the attorney's sessions: plain-language practice-kg tool rows, Right/Wrong verdict capture, a current-matter band with a visible timer, and five ported firm skills, dogfooded on the operator's machine and delivered to the attorney's PC through a directory marketplace. | none (the timer's entry model is gated, see below) | practice-kg tools `packages/law-practice/use-cases/src/PracticeKg.tools.ts` (`kg_matter_lookup` and siblings, reuse via `$.mcp.call`); MCP host `apps/practice-kg-mcp` (reuse, registration on the operator machine); matter schema `@beep/law-practice-domain/entities/Matter` (reuse); package scaffold `bun run beep create-package` (reuse); Effect + Schema bundle in the mod runtime (proven, RESEARCH 2026-10-14 spike); the mod hooks module, verdict row schema, tool-phrase table and build/release script are **NET-NEW**; ported skills are **NET-NEW** from `anthropics/knowledge-work-plugins` `legal` (Apache-2.0). |
| `practice-claude-mod-time-entries` (gated) | Turn the mod's raw timer intervals into the spine's candidate time entries once `law-time-capture-spine` P0 freezes the entry model. | `law-time-capture-spine` P0 | `goals/law-time-capture-spine` SPEC (reuse its schema, never a competing one) |

Not a candidate: mods for the operator's own repo sessions. Per D1 the
operator's machine is the test bed for the attorney's plugin, not a product
target; a separate exploration opens if that changes.

## Sequencing

1. **`practice-claude-mod`** is the only promised-now goal (D12, one week).
   Inside it: bundle-load proof on both machines → tool rows + verdict
   capture (first vertical slice) → matter band + visible timer surface →
   ported skills. Skills may slip to a follow-up without blocking the mod.
2. **`practice-claude-mod-time-entries`** reopens this packet at
   `decompose` when the spine's P0 entry schema lands (graduation contract:
   gated candidates do not hold the packet open).

## First Vertical Slice

On the operator's machine, with the practice-kg MCP registered against the
current bundle and the plugin loaded from `dist/plugin` through
`CLAUDE_CODE_PLUGIN_DIRS`:

1. A practice-kg question in Claude Code shows each tool call as a plain
   sentence ("Looking up matter 43505.10003"), and ctrl+o still shows the raw
   call.
2. Pressing **Wrong** on the answer (or typing `/wrong missed the 2019
   continuation`) appends one schema-valid row to the mod's verdict log, and
   a toast confirms it.
3. `claude plugin validate dist/plugin` lists only the D9 envelope calls, and
   `claude plugin test` passes for the terminal and desktop surfaces.
4. The same `dist/plugin` copied into the attorney PC's directory
   marketplace installs at user scope and repeats steps 1–2 there (Windows
   parity).

Verification: `claude plugin test` suites in the app, `bun run beep quality
package-verify @beep/practice-claude-mod`, and a screenshot or transcript
excerpt from each machine for steps 1–2 (redacted).

## Open Risks Inherited From The Brief

- Windows parity is unproven (spike ran on Linux 2.1.299).
- Bundle growth from `@beep/law-practice-*` imports; import domain subpaths
  only and track size.
- `ToolUse` row props are an early-access API; pin the minimum Claude Code
  version and fall back to `next(e)`.
- Hooks fail open; verdict writes must surface failures, never drop.
- The operator's machine needs a bundle-backed practice-kg registration for
  realistic testing.
- Timer rows stay raw until the spine's entry schema exists.
- practice-kg matter-lookup defects (DF-1..DF-8): the picker shows ambiguity
  rather than guessing.
