# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-11-10 — capture closed by resumption

**Question:** Is the capture dump done, so research may start?

**Answer:** Treated as done. The operator resumed the packet a week after
opening it with no new material. `CAPTURE.md` stays append-only and open to
later additions.

**Rationale:** Agent call, not an operator answer. Research does not depend on
the dump being final, and stages may loop. Reversal: append to `CAPTURE.md`
and rerun the research sweep.

## 2026-11-10 — Q1 primary pull

**Question:** Which use-case family is this packet for?

**Answer:** The operator cockpit: one full-screen terminal surface over the
session ledger, Palantiri parcels, the Yeet inbox and the merge gate.

**Rationale:** Recommended and accepted. The reason to put it on a cell grid
is the verification loop: an agent can build and check the surface with
text-frame assertions at unit-test cost (RESEARCH "Smoke test", 205 ms), with
no recorded browser session and no vision judge. Rejected: the text-frame UI
test tier (logic proven on a cell grid says little about the DOM apps, since
`@beep/ui` cannot render there); pattern port only (kept as a by-product, not
the aim); park. The DevTools-console companion was left out of the options as
the weakest and was not asked back in.

## 2026-11-10 — Q2 appetite

**Question:** How much is this worth before it has to prove itself?

**Answer:** A one-day spike: one throwaway vertical slice on real repo data,
then a keep-or-kill call.

**Rationale:** Recommended and accepted. Upstream is eight days old and the
use case has not been felt in daily work. Rejected: a week-long goal with a
shipped surface; documentation only.

## 2026-11-10 — Q3 dependency stance

**Question:** May repo tooling depend on Text.js?

**Answer:** `@textjs/react` only, exact-pinned, in one leaf. Effect keeps the
services, schemas, CLI and any MCP server; Text.js only draws.

**Rationale:** Recommended and accepted. `@textjs/react@1.6.1` installs 7
packages with no Vite and no zod. Rejected: the full `@textjs/app` stack (a
second router, cache and MCP server beside `effect/cli` and
`effect/ai/McpServer`); ideas only.

## 2026-11-10 — spike home

**Question:** Where does a one-day spike live?

**Answer:** A lab app under `apps/labs/`, created with
`bun run beep create-package <name> --type app --app-kind service --lab`.

**Rationale:** Answered from doctrine, not asked.
`standards/architecture/15-lab-apps.md` and `apps/labs/README.md` make labs
the home for experiments: full code law, no docgen, coverage ratchet,
changesets or storybook, non-required `Labs` CI lane, and
`bun run beep delete-package` as the kill path. That keeps the pinned
dependency out of `@beep/repo-cli`, whose tests must pass on Node and Bun
(Text.js under Node is unverified). How the lab reads the ledger is settled
under "data seam" below. Reversal: delete the lab.

## 2026-11-10 — Q4 first panel

**Question:** Which single panel does the first slice show?

**Answer:** The live lanes board: every live session from the session ledger,
with lane, branch, PR, state, next step and age.

**Rationale:** Recommended and accepted. It replaces the wall of rows the
SessionStart hook prints, and its data already has a schema
(`SessionLedgerRow`, `packages/tooling/tool/cli/src/commands/Session/Session.schemas.ts`)
and a machine output (`bun run beep session open --json`). Rejected: reds and
inbox (95 of 97 lane-red readings were stale on 2026-11-10, so the spike
would render stale data); merge gate queue (needs GitHub reads against the
budget `goals/github-budget-ledger` protects); fleet headroom (a status
strip, nothing to navigate).

## 2026-11-10 — Q5 interaction

**Question:** Does the spike only show state, or also act on it?

**Answer:** Read and drill down. Arrow keys, a filter, Enter to expand a
lane, a key to copy its path or PR link. No writes.

**Rationale:** Recommended and accepted. A throwaway must not be able to
damage a live lane. Rejected: keys that message a session, write a ledger
note or retire a lane, which would pull T3 messaging and lane ownership
rules into a spike.

## 2026-11-10 — Q6 keep test

**Question:** What decides keep or kill after the spike day?

**Answer:** Use. It stays open in a Ghostty pane for a working day and the
operator reaches for it before rerunning `beep session open`.

**Rationale:** Recommended and accepted. Usage is the only evidence that the
surface deserves a real goal. Rejected: agent-built proof alone (proves the
loop, not the need); both required (would kill a useful cockpit that needed a
manual QA round).

## 2026-11-10 — spike vehicle

**Question:** Does the spike run inside this exploration or as a goal packet?

**Answer:** One small goal packet, `goals/lane-cockpit-spike`. The wider
cockpit stays in `MAP.md` as gated candidates.

**Rationale:** Agent call. The spike writes code under `apps/labs/` and opens
a PR, and the repo runs implementation under a goal packet with a launcher
and a reflection. The convention has no lighter vehicle. Reversal: kill the
goal and delete the lab; the exploration packet keeps the record.

## 2026-11-10 — data seam

**Question:** How does the lab read the session ledger?

**Answer:** It runs `bun run beep session open --json` on an interval and
decodes the report with a schema. It does not import the session services.

**Rationale:** Answered from the code. `@beep/repo-cli` exports
`./commands/*` as `./src/commands/*.ts`, and `Session` is a directory, so
`SessionLedger` is reachable only through the test-kit path
`@beep/repo-cli/test/Session`. Widening a tooling export for a throwaway is
out of proportion. Reversal: if the cockpit is kept, the follow-on goal
decides the proper export.
