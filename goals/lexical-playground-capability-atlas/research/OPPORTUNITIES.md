# Opportunities Ledger

Friction receipts recorded at the moment they happen (repo law: friction is a
first-class output). Redacted per public-repo rules.

## 2026-08-24 — Generated-file merge treadmill on packet PRs

**What was happening:** landing PR #781 (`docs(goals): graduate
configurable-full-document-editor`), a docs-only packet PR that was fully green
(28 checks, Greptile 5/5, zero threads) on every attempt.

**Evidence:** `bun run beep yeet merge` failed three consecutive times with
`gh pr merge --squash --match-head-commit <sha>` reporting "not mergeable: the
merge commit cannot be cleanly created". Five packet PRs landed on `main` the
same night (#776, #777, #778/#780, #779, #782), and every one rewrites the
generated `goals/INDEX.md`; two graduations also edited adjacent
`explorations/ATLAS.md` regions. Each reconcile requires a merge commit, an
index/baseline regeneration, and a full `yeet verify` (~20 min), during which
the next packet PR landed and re-conflicted the branch. Merged only via a
bounded reconcile→verify→push→monitor→merge retry loop (attempt 2), roughly
2.5 hours wall-clock for a docs-only change.

**What would have prevented it:** any of (a) a merge queue so green PRs
serialize server-side instead of racing; (b) making `goals/INDEX.md` a
merge-driver/union-style regenerated artifact (or regenerating it in CI on
`main` post-merge) so packet PRs stop conflicting by construction; (c) a
cheaper re-proof tier for a base-merge whose only delta is regenerated
index/baseline files. The ATLAS conflict class additionally needs judgment
(entries move between sections on graduation), so (a) or (b) helps most.

## 2026-08-24 — Exercise runner cannot launch Chromium in the agent sandbox

**What was happening:** rerunning the `block-menu` exercise batch after a
selector repair.

**Evidence:** the requested `bun run .../runner.ts --batch block-menu` command
failed before page creation. Playwright's bundled Chromium exited at
`sandbox_host_linux.cc:41` with `shutdown: Operation not permitted`; headful
Chromium and the installed Chrome binary failed on the same restricted socket
operation. The live playground remained reachable through the browser-control
lane, which confirmed this was launch isolation rather than an application or
server failure.

**What would have prevented it:** a QA execution lane whose seccomp profile
permits Playwright browser subprocesses, or a supported runner option that
attaches to an already-authorized browser without changing exercise semantics.

## 2026-08-24 — Six blind triage passes to converge a scenario harness

**What was happening:** exercising the 157 scripted atlas entries against the
pinned Playground. Scenarios were authored and repaired by an agent that
cannot launch a browser (previous receipt), so every fix was inferred from
`observations.ndjson` rows, PNGs, and pinned JSX, then proven by a re-run in
a separate lane.

**Evidence:** full sweep → 79 entries with non-network failures → six
Codex triage passes and five re-run loops (`ops/exercise/scenarios/*`,
reports in the session scratchpad). One helper bug explained ~50 entries:
`testId()` used Playwright `getByTestId` (`data-testid`) while the Playground
only has `data-test-id`. A second class needed three passes because the
harness recorded no uncaught page exceptions: `transformer.tweet` blanked the
whole app and the evidence showed only a vanished `.ContentEditable__root`
(root cause: the pinned TWEET `triggerOnEnter` transformer drops the
selection, `updateEditor: selection has been lost…`, and `App.tsx` has no
error boundary). `page-error` rows were added to the runner in pass 6.

**What would have prevented it:** (a) a five-entry smoke batch before the full
sweep, so a shared-helper bug fails fast instead of after 162 entries;
(b) `pageerror` capture from the first version of any browser harness — a
vanished DOM is not evidence, the exception is; (c) the same browser-capable
QA lane the previous receipt asks for, so authoring and proving happen in one
loop instead of a scratchpad relay.

## 2026-08-24 — Cross-contaminated exports from a non-hermetic clipboard round trip

**What was happening:** judging the P0 live-exercise exports after operators
had rerun entries in parallel against one system clipboard. The shared
`surfaceLifecycle` tail recorded keypress completion but did not verify the
clipboard, pasted document, or downloaded editor state.

**Evidence:** the `authoring.undo` export contained `authoring.redo`'s
document, `document.clear` contained a 5x5 table, and `document.html-source`
contained `document.export-lexical-json` text. A focused probe showed that
`Ctrl+A → End → Enter` wipes the document when the caret key follows select-all
within about 50 ms because Lexical still holds a document-wide selection.

**What would have prevented it:** clipboard, paste, and export verification
rows in the first harness version; a shared run lock that refuses parallel
entry processes; and never treating a successful keypress row as proof that
the intended editor-state change occurred.

## 2026-08-24 — Waiver drafts named follow-up goals that do not exist

**What was happening:** assigning owners to the P0 waivers for
`interchange.pandoc-docx` and `interchange.pdf`.

**Evidence:** the drafts named `pandoc-docx-driver` and
`document-pdf-export` as owning follow-up goals. They are gated candidates in
`explorations/full-document-editor/MAP.md:12-13`, not packets under `goals/`.
The Pandoc draft also assigned executable conversion to `@beep/pandoc-ast`,
contrary to D25.

**What would have prevented it:** a verifier or goals-doctor check that requires
each Exception Ledger owner to resolve to either `goals/<slug>` or a named
`explorations/full-document-editor/MAP.md` row.

## 2026-08-25 — The touch table has no scaffold path for a `ui-system` concept module

**What was happening:** starting P1 by adding the `src/capability/` module
(schemas, errors, resolver, projections) to `packages/foundation/ui-system/editor`.
`AGENTS.md` routes "New slice / concept / role file" to `bun run beep architecture`.

**Evidence:** `bun run beep architecture add concept --help` and
`... add role --help` take `<slice> <concept> [role]` with
`--domain-kind aggregates|entities|values` and `--stage core|persistence|...`;
they scaffold bounded-context slices, not concept modules inside a
`foundation/ui-system` package. This package's existing convention is flat
lowercase role files (`src/chat/config.ts`, `src/chat/atoms.ts`), which the
slice scaffold would contradict. The module was hand-authored to the package
convention and the design was recorded in `research/P1-CAPABILITY-CONTRACT.md`.

**What would have prevented it:** either scope the touch-table row to slices
(`packages/<family>/<slice>`), or give `beep architecture add concept` a
`ui-system`/`modeling` target that emits the package's own role-file layout.

## 2026-08-25 — `jq` edits reflow the biome-formatted atlas artifact

**What was happening:** correcting seven compatibility rows in
`research/capability-atlas.json` (evidence from the live Lexical codec).

**Evidence:** `jq '...' file > tmp && mv tmp file` produced a 3,759-line diff
(`3089 insertions(+), 670 deletions(-)`) for a seven-row change because the
artifact is biome-formatted (the `biome.jsonc` override only raises `maxSize`
for it). `bunx biome format --write <atlas>` restored the layout and the diff
collapsed to `18 insertions(+), 18 deletions(-)`.

**What would have prevented it:** an `ops/` recipe (or a `beep goals atlas
set` subcommand) that applies a row edit and re-formats in one step, so an
agent never has to know the formatter is part of the artifact's identity.
