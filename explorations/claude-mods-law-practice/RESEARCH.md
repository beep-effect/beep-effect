# Research

## 2026-10-14 — What a mod is, and where it runs

Sources: the public mods overview and admin pages (R1, R2 in
[`research/SOURCES.md`](./research/SOURCES.md)) and the `plugin-authoring`
skill's reference bundled with Claude Code 2.1.295 (R3).

### Definition

A mod is a Claude Code plugin whose code is a hooks module: one TypeScript or
JavaScript file exporting `register(on, options)`. Claude Code calls each hook
in its own process when an event happens, and the hook can observe, rewrite,
or answer the event (R1 "What a hook can do with an event"). Every effect
outside the module goes through the `$` engine interface; the module has no
DOM and no Node (R3 "What a plugin of function hooks is").

It is not a skill, a subagent, a settings hook or an MCP server, and it does
not replace them. The overview's comparison table (R1 "Compare mods, settings
hooks, skills, and MCP servers") puts it plainly:

| | Mod | Settings hook | Skill | MCP server |
| --- | --- | --- | --- | --- |
| Runs | inside Claude Code | as a script on an event | as text Claude reads | as an external process |
| Can change | tool calls, prompts, commands, turns, the interface | allow/block, args, results, added context | what Claude knows | which tools exist |
| Can draw | yes | no | no | no |

A plugin can ship all four together, so a firm plugin can carry a skill, an
MCP server registration and a mod side by side (R1).

### What a mod can do (the capability menu)

| Capability | API (R3) | Law-practice reading |
| --- | --- | --- |
| Pane beside the transcript | `$.ui.open` + `ui.render` `Pane` | matter dashboard, deadline list |
| Band above the prompt | `ui.render` `AbovePrompt` | "current matter" strip, next deadline |
| Status line text, toasts, native notifications | `$.ui.status`, `$.ui.toast`, `$.ui.notify` | quiet reminders |
| Redraw Claude Code's own rows | `ui.render` on `ToolUse`, `Spinner`, `UserMessage`, `AskUserQuestion` | replace `mcp__practice-kg__kg_search {…}` with plain words |
| Guard or rewrite a tool call | `tool.call`, `tool.check` (`{ deny }`, `next({...e})`) | hold a send, fence a folder |
| Rewrite a prompt / system prompt | `prompt.submit`, `prompt.compose` | firm guidance without a per-folder `CLAUDE.md` |
| Rewrite stored rows | `session.append` | redaction before storage |
| Slash command with no model turn | `$.command.register` + `command.run` | `/matter`, `/wrong`, `/time` |
| Model-callable tool | `$.tool.register` (`mcp__<plugin>__<name>`) | thin wrappers, rarely needed (the MCP server already serves tools) |
| Call MCP tools itself | `$.mcp.call` | read the practice KG for a band |
| Model calls | `$.model.complete`, `$.model.fork` | summarise a turn into a time-entry narrative |
| Files, processes, network, timers, store | `$.fs`, `$.process`, `$.http.fetch`, `$.clock`, `$.store` | local logs, periodic refresh |

### Where mods run (R1 "Where mods run")

| Surface | Hooks run | Drawing shows |
| --- | --- | --- |
| `claude` in a terminal (incl. JetBrains, editor terminals) | yes | yes |
| Desktop app **Code tab** | yes | yes (terminal-only elements excepted) |
| VS Code chat panel, `claude -p`, Agent SDK | yes | no |
| Remote Control from claude.ai/mobile | yes, on the machine | in that machine's terminal |
| Cloud session | if the plugin reaches it | no |
| Claude Desktop **chat** (and MCPB desktop extensions) | not a Claude Code surface: NOT COVERED | — |

Version floor: terminal v2.1.287+, Desktop Code tab v2.1.286+; mods are on by
default (R1 "Turn mods on or off"). `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` is
ignored from v2.1.287.

### Trust and control (R1 "Decide whether to trust a mod", R2)

- Mods are **not sandboxed**. A mod runs with the user's permissions: files,
  processes, network, environment and settings (secrets), every prompt and
  tool call; it can approve a tool call before a prompt would appear and can
  spend model usage.
- A mod cannot change the **permission prompt** itself.
- `claude plugin validate <dir>` lists a mod's `hooks:` and `calls:` without
  running it; that is the review step before install (R2 "Review what a mod
  can do").
- The built-in guard `cc-plugin-sec-default` loads where the machine has
  managed settings or the user is signed in on a Team/Enterprise plan; it
  protects managed hooks, managed `CLAUDE.md`, the system prompt and managed
  MCP servers from user mods, and keeps deny rules above a mod's approval
  (R2 "Know what happens by default").
- Deny rules do **not** cover a mod's own `$.fs` / `$.process` calls (R2).
- Org controls: `allowManagedModsOnly`, `allowManagedHooksOnly`,
  `disableAllHooks`, `disableSideloadFlags`, `prependPlugins` /
  `appendPlugins`. An org mod counts as the org's only when managed settings
  enable it from a **directory marketplace on the machine** listed by relative
  path; anything copied from GitHub/git/URL/npm counts as a user's (R2
  "Install your organization's mods and set the order").
- `--safe-mode` and three hooks-worker crashes unload installed mods, org
  ones included (R2) — a mod is never the *only* safeguard.

### Distribution (R1 "Install or update a mod", R3 "Sharing a mod")

A mod installs like any plugin: `/plugin install <mod>@<marketplace>` or
`claude plugin install …`. A repository becomes a marketplace with one
`.claude-plugin/marketplace.json`. A **directory** marketplace whose entry
is a relative path is read in place: edit the folder, `/reload-plugins`, no
reinstall (R3 "Developing one"). During development `--plugin-dir` or
`CLAUDE_CODE_PLUGIN_DIRS` loads a folder and hot-reloads it.

### Prior art worth reading before building

- Anthropic sample mods (R4): `token-weather` (band), `blast-radius` (holds a
  risky shell command and shows Proceed/Cancel — the closest pattern for a
  "hold the send" guard), `replay-theater` (`/replay` command).
- Built-in mods' source (R5): `diff` (pane), `agents-md` (`userConfig`),
  `sec-default` (policy mod), `telemetry` (a noun other mods call).

### The legal plugin already present ("claude-for-legal")

This session already carries Anthropic's `legal` plugin v1.3.0 (Apache-2.0),
synced from claude.ai, whose README names it a productivity plugin for
**in-house legal teams** and installs from
`anthropics/knowledge-work-plugins` (R6). It is **skills + MCP connectors
only** (brief, compliance-check, legal-response, legal-risk-assessment,
meeting-briefing, review-contract, signature-request, triage-nda,
vendor-check; connectors atlassian, box, docusign, egnyte, gmail, google
calendar, slack) — **no mod code**. Its personas (commercial, product,
privacy, litigation support counsel) do not include patent prosecution, so
it is at best a skill donor, not the mod answer. This is the most likely
referent of the "claude-for-legal" board item (UNVERIFIED: the X post itself
was not fetched).

## 2026-10-14 — The attorney's actual Claude surface

From operator notes (machine names and paths kept out of this public repo)
and the practice-kg-mcp goal packet (R7):

- The attorney works on a Windows PC that runs **Claude Code 2.1.295**
  (≥ 2.1.287, so mods are on), signed in to the firm account, with the
  `practice-kg` MCP server registered at user scope; plus Claude Desktop,
  whose chat uses the practice-kg **MCPB desktop extension**.
- Lawyer-facing review surfaces already route the attorney into **Claude
  Code, not chat** (`claude-cli://open?cwd=…&q=…` deep links), with firm
  guidance in a working-folder `CLAUDE.md`; sitting evidence is collected
  afterwards from the Claude Code session transcripts.
- Consequence: a mod reaches the attorney only in Claude Code (terminal or
  the Desktop Code tab). Chat in Claude Desktop stays the MCPB extension's
  territory.

## 2026-10-14 — In-repo capability inventory

See [`research/repo-inventory.md`](./research/repo-inventory.md) (Codex
lane, read-only) for the `.claude/` surface, the law-practice goals and
explorations, live MCP servers and CLI commands, and guardrail candidates.

## 2026-10-14 — Spike: Effect inside the mod runtime (D6 feasibility)

Question: the mod runtime has no Node and loads only the plugin's own ES
modules (no `import()`); can an Effect-first mod built from this repo run
there?

Probe (scratchpad, not committed): a `register.ts` importing `effect/Effect`
and `effect/Schema` (the repo's installed Effect v4), declaring an `S.Class`
with an `S.Literals` field and decoding it with `S.decodeUnknownEffect` inside
a `command.run` hook, bundled with
`bun build --target=browser --format=esm --minify` into one 79 KB
`hooks/register.js`.

Result on Claude Code 2.1.299:

- `claude plugin validate` passed (hooks `session.start`,
  `command.run{command=spike}`; calls `$.command.register`), with only the
  missing-`author` warning.
- `claude plugin test` ran a test that called `$.command.run({ command:
  'spike' })` and asserted the decoded text: **1 pass**.

Conclusion: an Effect + Schema bundle loads and runs in the mod engine;
`apps/practice-claude-mod/**` can stay Effect-first with a bun bundle step. Not
yet proven: bundle size once `@beep/law-practice-*` schemas are pulled in,
and Windows parity (the attorney's PC), which the first slice proves.
