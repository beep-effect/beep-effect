# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## 2026-11-10 — first sweep

Method: shallow clone of `anomalyco/textjs` at `f4ef6c9` (branch `dev`,
"release: 1.6.1 (#102)", 2026-11-06) read directly; GitHub and npm registry
metadata read the same day; one offscreen smoke test run under Bun 1.4.4;
targeted ripgrep over this repo. Upstream paths below are relative to that
clone. Ledger: [`research/SOURCES.md`](./research/SOURCES.md).

## External Landscape

### What Text.js is

A React 19 framework whose host is a cell grid, not the DOM. One component
tree renders to three targets:

| Target | Entry | Output |
| --- | --- | --- |
| DevTools console | `text dev` / `text build`, `createConsoleRoot` (`packages/react/src/root.tsx:322`) | one `console.log` of run-length-encoded `%c` spans per changed frame |
| Terminal | `text run`, `renderToTerminal` (`packages/react/src/terminal.tsx:328`) | truecolor ANSI, row-diffed, synchronized-output markers |
| Offscreen | `render` (`packages/react/src/testing.tsx:126`), `text mcp` | plain text frame, per-cell `{ char, fg, bg, attrs }` |

Pipeline (upstream `ARCHITECTURE.md`): React 19 custom reconciler
(`react-reconciler`) → Yoga flexbox in WASM snapped to integer cells →
`CellBuffer` of typed arrays → per-row FNV-1a hash gate → RLE → sink. A frame
with no changed cell allocates nothing and writes nothing.

Packages at 1.6.1: `@textjs/core` (cell buffer, Yoga, drivers; only
dependency `yoga-layout`), `@textjs/react` (reconciler, component kit, hooks;
depends on core, `react-reconciler`, `scheduler`), `@textjs/app` (App Router,
CLI, MCP, server rendering; pulls in Vite, `@modelcontextprotocol/sdk`, zod),
plus `@textjs/font`, `eslint-plugin-textjs`, a DevTools extension and a VS
Code extension.

Lowercase DOM elements throw TX003 (`packages/react/src/reconciler.ts:72`).
Components are `<Box>`, `<Text>`, `<ScrollBox>`, `<Table>`, `<Tree>`,
`<LineChart>`, `<Markdown>`, `<Diff>`, `<Input>`, `<Select>`, `<Tabs>` and
similar (https://textjs.org/llms.txt).

### The agent surface

`text mcp` runs the `app/` directory headless in-process and serves 14 tools
over stdio (`packages/app/src/mcp/server.ts:246-560`): `list_routes`,
`navigate`, `read_frame`, `press`, `type`, `paste`, `scroll`, `resize`,
`inspect_tree`, `find`, `wait_for`, `logs`, `fetch`, `reload`. Resources
`text://frame` and `text://routes`. Embeddable with `createTextMcpServer`
(`packages/app/src/mcp/server.ts:205`). Source: https://textjs.org/docs/mcp.

Three protocol details are worth more than the tool list:

- **A defined idle.** A read waits until no frame is scheduled, no `fetch` is
  in flight, and no commit or frame happened for 50 ms. It gives up after
  1.5 s, flushes the latest frame and marks it `busy`.
- **Input returns the next frame.** `press` and `type` answer with the settled
  frame, so an agent spends one call per interaction, not two.
- **Logs are a side channel.** App `console.*` output and React errors go to a
  numbered `logs` buffer with a `since` cursor; the frame header says when new
  errors exist.

Limits the docs state: the app runs in Bun with no `window` or `document`; one
app and one grid per server; it cannot attach to a browser tab under
`text dev`.

### Testing surface

`@textjs/react/testing` exports `render`, `cleanup`, `renderToString`
(`packages/react/src/testing.tsx:126,299,304`). A `RenderResult` has
`lastFrame()`, `lines()`, `frames`, `toAnsi()`, `cell(x, y)`, `locate(text)`,
`press`, `type`, `paste`, `wheel`, `resize`, `wait`, `waitForText`, `waitFor`.
Every input call runs inside `act()` and flushes. Timers are real, not faked.
Source: https://textjs.org/docs/testing.

### Smoke test (run here, 2026-11-10)

`bun add --ignore-scripts @textjs/react@1.6.1 react@19` installed 7 packages.
A three-row selectable list, two `down` presses, assert on the frame:

```text
╭──────────────────────────────────────────────────────────────────────╮
│                                                                      │
│ Live lanes (3)                                                       │
│   yeet-async-merge       open     slice A package proof              │
│   github-budget-ledger   open     final-check running                │
│ > eloquent-moore         blocked  stood down by orchestrator         │
│                                                                      │
╰──────────────────────────────────────────────────────────────────────╯
```

`1 pass`, 205 ms wall for the whole `bun test` run. The 72×8 frame is 583
characters as text and 1,429 as truecolor ANSI. Not tested: Vitest under
Node, `text mcp`, `text run`, the DevTools console target.

### Other things in the box

- **curl gets a frame.** Requests from `curl/`, `Wget/`, `HTTPie/`, `xh/`
  that do not accept `text/html` receive the page's first frame as ANSI
  `text/plain` with `Vary: User-Agent, Accept`. Helpers `wantsAnsi` and
  `ansiResponse` are exported from `@textjs/app/ansi`
  (https://textjs.org/docs/curl; added after the 2026-11-03 capture).
- **Embedding (experimental).** `text build --embed` produces an `embed.js` of
  about 3 kB gzip that logs a prerendered first frame and loads the runtime
  (112.8 kB JS + 29.0 kB WASM gzip) only on "console intent": DevTools docked,
  a DevTools shortcut, or a click on an engage element
  (upstream `CHANGELOG.md`, 1.6.0).
- **Server rendering.** `runtime = "server"` routes stream row-level cell
  deltas over SSE to a ~21 kB frame player with no React or Yoga on the client
  (upstream `ARCHITECTURE.md`).
- **Error catalog.** TX001 to TX032, each with a stable URL.

### Maturity

Read from the GitHub API and npm registry on 2026-11-10:

| Fact | Value |
| --- | --- |
| Repo created | 2026-11-02 |
| Contributors | 1 (`adamdotdevin`, 1,007 commits) |
| Stars / forks / open issues | 173 / 4 / 4 |
| GitHub releases | none (npm only) |
| `@textjs/app` on npm | 12 versions, first 2026-11-01, latest 1.6.1 on 2026-11-06 |
| `@textjs/app` downloads, 2026-11-02..08 | 9,515 |
| Source size | about 80k lines of TS across `packages/`, 160 test files |
| License | MIT, "Copyright (c) 2026 Anomaly" |

Six minor releases in five days. The support policy promises semver over the
public exports of `@textjs/app`, `@textjs/react` and `@textjs/core` and a
12-month LTS after 2.0 (https://textjs.org/docs/support-policy), which is a
claim about intent from a project eight days old. The branding parodies
Next.js and Vercel ("Inverted Architecture™", the `▼` mark, a `merch/`
directory); the engineering under it is real. Whether the author maintains it
past the launch is unknown.

A third-party listing mentions an enterprise tier with an SLA
(https://www.everydev.ai/tools/textjs). Not verified against textjs.org.

### Comparables

GitHub API, 2026-11-10:

| Project | Stars | Target | Notes |
| --- | --- | --- | --- |
| [Ink](https://github.com/vadimdemedes/ink) | 40,252 | terminal | React renderer for CLIs, MIT, active. The incumbent. |
| [OpenTUI](https://github.com/anomalyco/opentui) | 13,773 | terminal | Same organisation as Text.js, MIT, active. The production TUI library behind OpenCode. |
| [Textual](https://github.com/Textualize/textual) | 37,621 | terminal + browser | Python. The closest prior art for "one app, terminal and web". |
| [Bubble Tea](https://github.com/charmbracelet/bubbletea) | 45,661 | terminal | Go, Elm architecture. |
| [react-blessed](https://github.com/Yomguithereal/react-blessed) | 4,489 | terminal | Last push 2021. Dead. |

Agents driving terminal programs is an active small-project niche, all built
on a PTY or tmux and reading a screen buffer:
[aiterm-mcp](https://socket.dev/npm/package/aiterm-mcp),
[MCP TUIKit](https://mcpservers.org/servers/dragoscirjan/mcp-tuikit),
[tui-mcp](https://glama.ai/mcp/servers/nvms/tui-mcp),
[terminal-mcp](https://mcpservers.org/servers/elleryfamilia/terminal-mcp).
Those scrape an opaque process from outside. Text.js differs in kind: the
agent surface is in-process, so it knows the component tree (`inspect_tree`),
which element has focus, and when the app is idle.

### What is actually new

Stripped of the console gimmick, three ideas:

1. **The frame is the contract.** A UI state that serializes to a few hundred
   characters of text is assertable in a unit test, readable by an agent and
   viewable by a person, with no second representation to keep in sync.
2. **An in-process driving protocol with a definition of idle.** The 14 tools
   plus the settle rule are a specification for "an agent uses a UI" that
   does not depend on pixels.
3. **Content negotiation down to the terminal.** The same route answers a
   browser with HTML and `curl` with a frame.

Rendering in the DevTools console is the least transferable part. It needs a
human with DevTools docked, it cannot be observed by the page (ARCHITECTURE,
"Not observable from the page"), and it paces at about 15 fps to fit
Chromium's console throttler.

## In-Repo Capability Inventory

| Need | Brick | Path |
| --- | --- | --- |
| React 19 | root catalog pins `react` 19.3.1, the version the smoke test resolved | `package.json` |
| Bun runtime (`text run`, `text mcp`) | repo toolchain is Bun | `package.json` |
| Terminal presentation layer | `@beep/cli-kit`: `CliAudience` (`--human` / `--agent` / `--ci`), `CliTheme`, `CliColor`, `Render`, `Doc`, `Status`, `Glyphs`, `CliPrompt`, `TestTerminal` | `packages/foundation/capability/cli-kit/src/` |
| CLI command tree | `effect/cli` (`Command`, `Flag`, `Prompt`, `TerminalCapabilities`) and `effect/Terminal` | `.repos/effect/packages/effect/src/cli/`, `.repos/effect/packages/effect/src/Terminal.ts` |
| Operator and fleet state as text | `@beep/repo-cli` commands `Session`, `Palantiri` (`renderHotText`, `printHotParcels`), `Accounts`, `Yeet`, `Observability`, `HarnessLedger` | `packages/tooling/tool/cli/src/commands/` |
| MCP servers | Effect-native, `effect/ai/McpServer` with `layerStdio` | `packages/drivers/uspto-mcp/src/Server.ts`, `packages/drivers/m365-mcp/`, `apps/practice-gateway/src/Server.ts`, `apps/practice-kg-mcp/` |
| UI QA evidence | `@beep/qa-capture` and `beep qa record / extract`: Playwright video, witness event log, frame strips, vision judge | `packages/tooling/library/qa-capture/`, `packages/tooling/tool/cli/src/commands/Qa/` |
| React apps | `@beep/todox` (Next), `@beep/beep-effect-web` (TanStack Start), `@beep/professional-desktop` (Tauri), `apps/storybook` | `apps/` |
| Frontend state | `effect/reactivity` and `@effect/atom-react` (atom-reactivity-specialist skill) | skill + app sources |
| Cell-grid React renderer (Ink, OpenTUI, blessed, Text.js, Yoga, `react-reconciler`) | NOT FOUND in any workspace manifest | — |
| Full-screen terminal UI of any kind | NOT FOUND. Every operator surface is line-oriented CLI output. | — |
| In-process UI driving protocol for agents | NOT FOUND. Agents reach UI through Playwright or the browser MCPs. | — |

Adjacent packets, all graduated, none covering a rendered operator surface:
`explorations/observability-palantiri` (→ `goals/palantiri-parcels`,
completed-retained), `explorations/agent-observability-rebuild`,
`explorations/fleet-coordination`, `explorations/agent-fleet-layout`,
`explorations/t3code-fleet-driver`.

## Constraints Discovered

- **No `@beep/ui` reuse.** Text.js rejects DOM host elements, and `@beep/ui`
  is shadcn on the DOM. A Text.js surface shares hooks, atoms, schemas and
  services with a web app, never components or Tailwind classes. Its
  `className` utilities are a separate cell-grid vocabulary.
- **Bun only for the CLI paths.** `text run` and `text mcp` throw TX019 on
  Node (`packages/app/src/cli/index.ts:168`). The offscreen `render` is
  documented for Vitest and Jest; unverified here under Node, and the repo
  rule is that `@beep/repo-cli` tests pass on Node and Bun.
- **Not Effect-native.** `@textjs/app` brings its own router, cache, middleware
  and an MCP server on `@modelcontextprotocol/sdk` with zod. The repo's MCP
  servers are `effect/ai/McpServer` and its schemas are `effect/Schema`. Using
  `@textjs/app` whole means a second, parallel stack; using `@textjs/react`
  alone (7 packages, no Vite, no zod) keeps Effect in charge of everything
  but the renderer.
- **Age.** Eight days old, one author, six minors in five days. Any dependency
  needs an exact pin and a small blast radius; anything mined from it should
  be ported, with MIT attribution, so it survives the project going quiet.
- **Agents do not need a rendered frame.** For a machine-only consumer,
  structured output (`--agent` in `CliAudience`) is cheaper and more exact
  than a box-drawn frame. A rendered surface earns its place only where a
  person and an agent look at the same thing, or where the rendering itself
  is under test.
- **The console target needs a human at DevTools.** It cannot serve an
  unattended or mobile audience, and upstream disables it on touch devices.

## Use-Case Candidates For Align

Unranked inputs to the grilling round, not decisions.

- **A. Operator cockpit.** One full-screen terminal surface over the session
  ledger, Palantiri parcels, the Yeet inbox and the merge gate, which the
  operator watches and an orchestrator agent reads through the same frames.
  Composes the `@beep/repo-cli` services above. NET-NEW: the renderer.
- **B. Text-frame UI test tier.** Borrow the frame contract and the idle rule
  to test interaction logic (focus, keymaps, state machines, atoms) in
  milliseconds, below the browser QA loop that costs a recorded session and a
  vision judge. Open question: whether logic tested on a cell grid says
  anything about the DOM app.
- **C. Console companion.** A dev-only DevTools panel for the web apps (atom
  registry, runtime layers, feature flags), or a public easter egg on
  `beep-effect.com` at about 3 kB.
- **D. Pattern port, no dependency.** Take the three ideas under "What is
  actually new" into Effect-native form: a driving protocol with a defined
  idle for the QA harness, `wantsAnsi`-style negotiation for status
  endpoints, the error-code catalog.
- **E. Park.** Record the ideas, set a re-entry gate (a concrete terminal
  surface is wanted, or upstream is still maintained in three months).
