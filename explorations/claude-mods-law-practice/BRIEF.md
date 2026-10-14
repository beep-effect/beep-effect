# Brief

## Problem

The attorney already works in Claude Code with the firm's knowledge graph
(practice-kg), but the session is still an engineer's tool:

- Tool calls show as `mcp__practice-kg__kg_search {…}` rows, which breaks the
  2026-10-09 rule that attorney-facing text is plain lawyer language.
- Judging whether an answer was right happens later, in a separate sitting
  web app, with evidence pulled from transcripts over SSH. The attorney's
  verdict is not captured where the answer appears.
- Nothing in the session knows which matter he is working on, so nothing can
  attribute verdicts or time to a matter.
- Time capture (law-time-capture-spine) needs a visible explicit timer
  surface, and Claude Code is where he already sits.
- Anthropic's `legal` plugin has useful prompt structure, but it targets
  in-house counsel and brings connectors the firm does not use.

Claude Code mods (2.1.287+) can redraw rows, add bands, commands and
controls, and run Effect code (spike, RESEARCH 2026-10-14). The attorney's
Claude Code already supports them.

## Appetite

One goal packet, about one week (D12). One plugin, one release path, built
and dogfooded on the operator's machine first, then copied to the attorney's
PC (D1, D7). Scope bends to fit the week: the ported skills go last and can
slip to a follow-up without blocking the mod.

## Solution Sketch

One plugin, `practice-claude-mod`, built from `apps/practice-claude-mod/**`
(Effect-first TypeScript bundled by bun into one hooks module, D6), holding a
mod and the firm skills:

```text
apps/practice-claude-mod
  src/            Effect + Schema hooks module (bundled to dist/plugin/hooks/register.js)
  skills/         ported firm skills (D11), Apache-2.0 attribution
  dist/plugin/    .claude-plugin/plugin.json, hooks/, skills/  (the shipped plugin)
  dist/marketplace/.claude-plugin/marketplace.json (directory marketplace, relative source)
```

1. **Plain-language tool rows.** A `ui.render` hook on the `ToolUse` row for
   `mcp__practice-kg__*` tools draws a lawyer sentence built from the call's
   input ("Looking up matter 43505.10003", "Searching the firm's files for
   'claim 1 amendment'"); `next(e)` while the row is expanded (ctrl+o), so
   the raw call stays inspectable. A table maps each practice-kg tool to its
   phrase. Unknown tools fall through untouched.
2. **Right/Wrong verdict capture.** Each assistant answer row gets Right /
   Wrong / Note controls; `/wrong [note]` marks the last answer. Each verdict
   is one schema-validated JSONL row (session, turn id, question, matter,
   verdict, note, time) in the mod's local state file (D8, D10). Collection
   reuses the existing evidence route.
3. **Current-matter band.** `/matter <number or name>` resolves through
   `kg_matter_lookup` via `$.mcp.call`, with a picker when ambiguous; the
   working-folder name may pre-fill a suggestion (D4). A band above the
   prompt shows the matter and, when running, the timer.
4. **Visible timer.** `/time start|stop` with a running clock in the band;
   explicit intervals only, stored as raw interval rows until the
   law-time-capture-spine P0 freezes its entry schema (D5).
5. **Firm skills.** review-contract (IP agreements), triage-nda,
   legal-risk-assessment (prosecution risk), brief + meeting-briefing
   (practice-kg wired), ported with attribution (D11).

Release check for every build: `claude plugin validate` must list only the
D9 envelope (`$.ui`, `$.command`, `$.state`/`$.store`, `$.clock`,
`$.mcp.call` on practice-kg read tools, `$.fs` in the mod's state dir) and
`claude plugin test` must pass on the terminal and desktop surfaces.

## Rabbit Holes

- **Windows parity.** Spike proved Linux 2.1.299 only. The attorney's PC is
  Windows on 2.1.295; prove load, rows and band there in the first slice
  before adding features.
- **Bundle growth.** `@beep/law-practice-*` imports may drag server-side
  code into the bundle; import domain/schema subpaths only and track bundle
  size in the release check.
- **Row redraw contract.** `ToolUse` row props are the engine's own and move
  between releases (early-access API); pin the minimum Claude Code version in
  the plugin README and keep a fallback to `next(e)` on any unexpected shape.
- **Hook failure is silent fail-open.** A hook that throws is skipped; the
  plain-language row falls back to the engine's row (acceptable). Verdict
  writes must surface failures with a toast, never drop silently.
- **Testing needs practice-kg on the operator's machine.** Register the same
  bundle-backed practice-kg MCP locally so rows, matter and verdict features
  see real calls (D1 consequence).
- **Time schema dependency.** Timer intervals stay raw until the spine's P0
  freezes the entry model; do not invent a competing time-entry schema.
- **Matter resolution quality.** Practice-kg has known matter-lookup defects
  (practice-kg-mcp DF-1..DF-8); the picker must show ambiguity rather than
  guess.

## No-Gos

- No passive or invisible time capture, no silent content capture, no
  candidate time entries or narratives (spine doctrine, D5).
- No `$.process`, `$.http.fetch`, `$.env`, `$.prompt.submit` or `$.model`
  calls in slice 1 (D9).
- No changes to Claude Desktop chat or the practice-kg MCPB extension; mods
  run only in Claude Code.
- No managed settings, org policy mods, or GitHub-hosted marketplace (D7).
- No sending, filing or calendar actions from the mod; read-only practice-kg
  tools only.
- No client text in the repo, fixtures or logs: tests use redacted
  fixtures; verdict rows stay on the machine that produced them.
- Not installing the stock `legal` plugin or its connectors (D2).
