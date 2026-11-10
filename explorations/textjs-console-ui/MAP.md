# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `lane-cockpit-spike` | In one day, build a read-only live lanes board as a lab app and let a day of operator use decide keep or kill. | none | Data: `bun run beep session open --json` and `SessionLedgerRow` (`packages/tooling/tool/cli/src/commands/Session/Session.schemas.ts`). Home: lab apps (`apps/labs/README.md`, `standards/architecture/15-lab-apps.md`, `bun run beep create-package`). Tests: `@effect/vitest`. Runtime: Bun, React 19.3.1 (root `package.json`). NET-NEW: a cell-grid React renderer, taken as the pinned dependency `@textjs/react@1.6.1`; the `LanesBoard` component. |

Gated candidates. None is scaffolded now. Each reopens this packet at
`decompose` when its gate fires.

| Candidate | Mission | Gate | Capabilities cited |
| --- | --- | --- | --- |
| `operator-cockpit` | Promote the board out of labs and add the reds, merge gate and fleet panels. | `lane-cockpit-spike` closes with the keep test passed. | `@beep/repo-cli` commands `Palantiri` (`renderHotText`, `printHotParcels`), `Yeet`, `Accounts`; `@beep/cli-kit` (`CliAudience`, `CliTheme`). NET-NEW: a public export for the session and parcel services. |
| `cockpit-actions` | Keys that act: message a session, write a ledger note, retire a lane. | `operator-cockpit` ships and the operator asks for writes. | T3 Code MCP tools (`t3_thread_send`), `bun run beep session note`, `bun run beep worktree remove`. NET-NEW: confirmation and ownership guards in a TUI. |
| `agent-frame-protocol` | Port the Text.js driving protocol (frame read, key input, a defined idle, a log side channel) to an Effect-native MCP server. | A surface exists that a person and an agent both need to look at. | `effect/ai/McpServer` (`packages/drivers/uspto-mcp/src/Server.ts`), `@beep/qa-capture`. NET-NEW: the protocol; port with MIT attribution from `anomalyco/textjs` `packages/app/src/mcp/server.ts`. |
| `terminal-content-negotiation` | Status routes answer `curl` with a text frame and browsers with HTML. | A hosted status endpoint exists that operators query from a terminal. | `effect/http` routes in the web apps. NET-NEW: `wantsAnsi`-style negotiation. |

Not candidates: the text-frame UI test tier and the DevTools-console
companion ([`DECISIONS.md`](./DECISIONS.md), Q1).

## Sequencing

`lane-cockpit-spike` is the only bet. It is cheap, it runs on data that
already has machine output, and its result decides whether anything else here
is worth mapping in detail. If the keep test fails, the goal closes with the
lab deleted and this packet's gated candidates lapse except
`agent-frame-protocol` and `terminal-content-negotiation`, which do not
depend on the cockpit.

## First Vertical Slice

`bun run` the lab in a Ghostty pane and see the live lanes of this repository,
blocked first, with ages; move with the arrow keys, filter with `/`, expand a
lane, copy its checkout path. Verified by frame tests over fixture rows
(ordering, selection, filter, empty ledger, corrupt rows) and by one manual
run against the real ledger. The keep test follows: one working day of
operator use.

## Open Risks Inherited From The Brief

- `render` from `@textjs/react/testing` is unproven under the repo's Vitest;
  the first hour settles it and the circuit breaker covers a failure.
- `lint:shadcn` may read Text.js cell utilities as Tailwind; style with typed
  props.
- `@effect/atom-react` on a foreign reconciler is untested; the board is
  props-in and atoms get one hour at most.
- Upstream is eight days old; exact pin, no upgrade during the spike.
- Session services have no public export; the spike reads the `--json`
  output and changes no export.
- Ledger rows go stale; the board shows age and never hides it.
