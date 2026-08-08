# Fleet Mirror — friction ledger

Receipts recorded at the moment of friction (repo law: never saved for closeout).

## 2026-08-06 — `dormant` is unreachable on this machine, by the spec's own law

First live scan of the finished derivation: **1285 of 1816 `/proc` entries were
unreadable** (root-owned daemons refuse the `cwd` readlink), so
`processScanComplete` is false fleet-wide and `classifyFleetLiveness` can never
return `dormant` — an unreadable process *could* be inside a checkout, and the
binding law says unreadable ⇒ `unknown`, never `dormant`. Liveness on a machine
with resident root daemons is effectively `live | unknown`.

- Evidence: `bun run beep worktree fleet` coverage line —
  `processes: 1816 scanned, 1285 unreadable`.
- This is SPEC-mandated behavior (acceptance: "an unreadable `/proc` entry yields
  `unknown`, never `dormant`"), not a defect. The mtime/transcript probes still
  produce `live` correctly; only the negative case degrades.
- What would have prevented the surprise: T5 §2.6 waved this off as
  "single-user machine ⇒ non-issue" without counting root daemons; a ten-second
  live count during research would have caught it. Any future refinement needs a
  *measurement* that bounds where unreadable processes can be — none is known
  (another uid's cwd is unknowable by design), so this likely stays.

## 2026-08-06 — P0's schema-home decision collided with the module graph

P0 §5 sited the fleet schemas as sibling classes **inside `Worktree.command.ts`**.
Registering the fleet subcommand from that same file while the service imports
the schemas back out of it forms an ESM cycle that is TDZ-fatal in practice —
hit live on the first run: `ReferenceError: Cannot access 'worktreeFleetCommand'
before initialization` (barrel entered through `Fleet.command.ts` first).

- Resolution: the Goals-family leaf pattern (`Worktree.schemas.ts`) — which is
  what T5 §8 originally proposed before P0 narrowed it. Public surface unchanged
  via the package barrel; doctor's row schema untouched.
- What would have prevented it: schema-home decisions should check the *import
  direction* of the consuming command family (who registers whom), not only file
  size and extension-vs-sibling shape.

## 2026-08-06 — local `bun run check` in `@beep/repo-cli` is pre-noised

Typechecking the CLI package locally surfaces dozens of pre-existing TS2353
errors in upstream packages (`'message' does not exist in type 'Option<unknown>'`
across `@beep/schema` sources, `uspto`, `ai-metrics`, …) that are unrelated to
the branch. Attribution work (introduced vs inherited) has to be redone by every
session that runs the local profile.

- Evidence: `cd packages/tooling/tool/cli && bun run check` on
  `feat/fleet-mirror-p1-derivation` (branch touches only `commands/Worktree/**`).
- Prevention: align the local check profile with the hosted lane set, or record a
  known-red baseline the way coverage ratchets do.

## 2026-08-06 — harness Write materialized literal NUL bytes

Authoring `Fleet.service.ts` with `"\0"` escape sequences inside string literals
via the agent harness Write tool produced **real NUL bytes** in the source file —
ripgrep flipped to "binary file matches" and the file was unparseable. Recovered
with a perl transliteration back to two-character escapes.

- Prevention: after writing any file that contains escape sequences, verify with
  `perl -ne '$n++ while /\x00/g; END{print $n+0}'` (ripgrep and `grep -q` both
  fail into silence on NUL — see the `completion-checks-that-fail-into-silence`
  memory).

## 2026-08-07 — this PR became its own Mode B specimen mid-publish

While the branch was in flight, `main` advanced 11 PRs (2162ebdc8a → f45948aaa7)
and moved onto the measured policy surface — `.github/workflows/**`,
`.github/actions/**`, `.claude/settings.json`, `AGENTS.md` — plus `goals/INDEX.md`,
which tripped yeet's stale-base publish guard. Signal 3 pointed at this exact
window in the first live scan hours earlier. Fourth real specimen of the arc;
resolved by fast-forward (no local commits yet) + INDEX regeneration.
