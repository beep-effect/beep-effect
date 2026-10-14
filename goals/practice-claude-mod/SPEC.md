# Practice Claude Code Mod Spec

## Objective

Ship one Claude Code plugin, built from `apps/practice-claude-mod/**`, that turns
the attorney's Claude Code sessions into a lawyer-facing surface over the
firm's practice knowledge graph:

1. **Plain-language tool rows**: practice-kg tool calls draw as lawyer
   sentences; the raw call stays visible when the row is expanded.
2. **Right/Wrong verdict capture**: Right / Wrong / Note controls on each
   answer and a `/wrong [note]` command, each verdict one schema-validated
   JSONL row in the mod's local state file.
3. **Current-matter band**: `/matter <number or name>` resolves through
   `kg_matter_lookup` (picker on ambiguity) and a band above the prompt shows
   the matter.
4. **Visible timer**: `/time start|stop` with a running clock in the band;
   explicit intervals only, stored as raw interval rows.
5. **Firm skills**: review-contract (IP agreements), triage-nda,
   legal-risk-assessment (prosecution risk), brief + meeting-briefing
   (practice-kg wired), ported from Anthropic's `legal` plugin with
   Apache-2.0 attribution.

The operator's machine is the test bed; the attorney's Windows PC receives
the same build through a local directory marketplace.

Shaped in [`explorations/claude-mods-law-practice`](../../explorations/claude-mods-law-practice/README.md):
[`BRIEF.md`](../../explorations/claude-mods-law-practice/BRIEF.md),
[`DECISIONS.md`](../../explorations/claude-mods-law-practice/DECISIONS.md) (D1–D12),
[`MAP.md`](../../explorations/claude-mods-law-practice/MAP.md).

## Non-Goals

- Passive or invisible time capture, silent content capture, candidate time
  entries or narratives (law-time-capture-spine doctrine; exploration D5).
  Candidate entries are the gated follow-on `practice-claude-mod-time-entries`.
- Any mods API call outside the D9 envelope: no `$.process`, `$.http.fetch`,
  `$.env`, `$.prompt.submit` or `$.model` (exploration D9).
- Changes to Claude Desktop chat or the practice-kg MCPB desktop extension.
- Managed settings, org policy mods, or a GitHub-hosted marketplace (D7).
- Sending mail, filing documents or creating calendar entries from the mod;
  only practice-kg read tools.
- Installing the stock `legal` plugin or its connectors (D2).
- Mods for the operator's own repo workflow (D1: that machine is a test bed).

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `apps/practice-claude-mod/**` (new; create with `bun run beep create-package`):
  Effect-first hooks module source, verdict/timer row schemas (app-local,
  D10), tool-phrase table, ported skills, bun bundle + release script, plugin
  tests, README with install and update steps.
- Build output (git-ignored): `dist/plugin/` (`.claude-plugin/plugin.json`,
  `hooks/hooks.json`, `hooks/register.js`, `skills/`) and
  `dist/marketplace/.claude-plugin/marketplace.json` (relative source).
- `docs/runbooks/` page for loading the plugin on the operator machine and
  delivering it to the attorney's PC (no machine names, addresses or private
  paths in the public repo).
- This packet and `explorations/claude-mods-law-practice` state.

## Constraints

- Effect-first, schema-first TypeScript per AGENTS.md; the bundle is
  `bun build --target=browser --format=esm` into one hooks module with no
  `import()` (proven: exploration RESEARCH 2026-10-14 spike).
- Import `@beep/law-practice-*` domain/schema subpaths only; record bundle
  size per release and fail the release check above a recorded ceiling.
- `ToolUse` row props are an early-access engine API: pin the minimum Claude
  Code version in the plugin README; any unexpected props shape falls back to
  `next(e)`.
- Hooks fail open. Verdict and timer writes surface failure with a toast and
  never drop a row silently.
- Matter selection is explicit (`/matter`); a folder name may pre-fill a
  suggestion but never sets the matter (D4). Ambiguous lookups show a picker.
- `$.fs` writes only under the mod's own state directory, checked through
  `$.fs.stat(path, { resolve: true }).realPath`.
- Release check: `claude plugin validate dist/plugin` reports only the D9
  calls; `claude plugin test` passes on `terminal` and `desktop` surfaces.
- No client text in the repo, fixtures, logs or evidence: redacted fixtures
  only; verdict rows stay on the machine that produced them.
- Prove Windows parity (the attorney's PC, Claude Code ≥ 2.1.287) before
  adding features beyond the first slice.
- Ported skills keep Apache-2.0 attribution (NOTICE + per-skill source line);
  playbook text is rewritten for a solo patent practice, not copied wholesale.
- Timer rows stay raw until `law-time-capture-spine` P0 freezes its entry
  model; never define a competing time-entry schema.

## Acceptance Criteria

- [ ] `apps/practice-claude-mod/**` exists via `create-package` and passes
      `bun run beep quality package-verify @beep/practice-claude-mod`.
- [ ] On the operator machine (plugin loaded from `dist/plugin` via
      `CLAUDE_CODE_PLUGIN_DIRS`, practice-kg registered against the current
      bundle): a practice-kg question shows plain-language rows, and ctrl+o
      shows the raw call.
- [ ] Pressing Wrong (or `/wrong <note>`) appends one schema-valid verdict
      row and shows a confirmation toast; a forced write failure shows an
      error toast.
- [ ] `/matter` resolves a unique matter into the band, and shows a picker
      for an ambiguous lookup.
- [ ] `/time start` and `/time stop` show a running clock in the band and
      write one raw interval row.
- [ ] The five ported skills load from the plugin with attribution.
- [ ] `claude plugin validate dist/plugin` lists only D9-envelope calls, and
      `claude plugin test` passes on terminal and desktop surfaces.
- [ ] The same build, copied into the attorney PC's directory marketplace and
      installed at user scope, repeats the tool-row and verdict checks there
      (redacted evidence in `history/`).
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/practice-claude-mod/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/practice-claude-mod/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/practice-claude-mod` | Passes |
| Package gates | `bun run beep quality package-verify @beep/practice-claude-mod` | Passes |
| Plugin contract | `claude plugin validate apps/practice-claude-mod/dist/plugin` | Only D9 calls listed |
| Plugin tests | `claude plugin test apps/practice-claude-mod/dist/plugin` | All pass |
| Operator-machine proof | redacted transcript/screenshot in `history/` | Rows, verdict, band, timer shown |
| Attorney-PC proof | redacted transcript/screenshot in `history/` | Rows and verdict shown on Windows |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

Seeded from the exploration's `DECISIONS.md` (full rationale there).

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-14 | D1 Target the attorney's Claude Code; operator machine tests first | Attorney already lives in Claude Code ≥ 2.1.287; safe test bed | Retarget in a new exploration |
| 2026-10-14 | D2/D11 Port five `legal` plugin skills, do not install it | In-house-counsel personas; reuse prompt structure | Drop `skills/` from the plugin |
| 2026-10-14 | D4 Explicit `/matter`; folder name only suggests | practice-kg acts only on unique resolution | Allow folder inference once proven unique |
| 2026-10-14 | D5 Visible explicit timer, raw intervals | Spine doctrine forbids invisible timers | Gated follow-on adopts spine schema |
| 2026-10-14 | D6 `apps/practice-claude-mod/**`, Effect bundle | Product host adapter; keeps repo laws; spike passed | Move to `.claude/` plain JS |
| 2026-10-14 | D7 Directory marketplaces on both machines | Read in place, no reinstall per update | Publish a GitHub marketplace |
| 2026-10-14 | D8/D10 Local schema'd JSONL verdicts, app-local schema | No network; one consumer | Promote schema to law-practice when evals read it |
| 2026-10-14 | D9 Mods API envelope | Mods are unsandboxed; reviewable release check | Log a decision per added call |
| 2026-10-14 | D12 One goal, about one week | One plugin, one release path | Split skills into a follow-up |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
