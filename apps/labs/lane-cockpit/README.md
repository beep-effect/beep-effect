# @beep/lane-cockpit

Read-only full-screen terminal board of this repository's live session lanes.
A lab for the `lane-cockpit-spike` goal: it tests whether a cell-grid UI
([Text.js](https://github.com/anomalyco/textjs), `@textjs/react` pinned at
1.6.1) earns a place on the operator's screen.

## Run

From the repository root, in a terminal pane:

```bash
bun run --cwd apps/labs/lane-cockpit start
```

The board reads `bun run beep session open --json` for this checkout every
15 seconds (`LANE_COCKPIT_INTERVAL`, any Effect duration such as `30 seconds`)
and writes nothing.

| Key | Action |
| --- | --- |
| `↑` `↓` / `k` `j`, `PgUp` `PgDn` | Move the selection |
| `/` | Filter by text; `Enter` keeps it, `Esc` clears it |
| `Enter` | Expand or collapse the selected lane's detail |
| `y` | Copy the checkout path (`wl-copy`, else OSC 52) |
| `p` | Copy the PR link |
| `q`, `Ctrl+C` | Quit and restore the terminal |

Rows show blocked lanes first, then the newest note first. Every row shows
its age; stale rows are never hidden.

## Layout

- `src/Lanes.ts`: the decoded report schema. Rows decode one at a time, so a
  corrupt row is counted, not fatal.
- `src/LaneSource.ts`: the `LaneSource` service and its subprocess layer.
- `src/Board.ts`: pure view logic (order, filter, ages, columns, window).
- `src/LanesBoard.tsx`: the props-in board and the keyboard shell. No timers.
- `src/main.ts`: the Effect program that polls and re-renders.

## Development

```bash
bun run check
bun run test
bun run lint
```

Frame tests render offscreen with `@textjs/react/testing` and need no browser.
They run with `{ concurrent: false }` because Text.js keeps process-wide
renderer state.

## License

MIT
