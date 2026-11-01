# github-reporting — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

This is the reporting interface document of upstream `@effected/github-actions`
(`okf/interfaces/actions-reporting.md`), which moved here when wave 3-1 of
`goals/effected-promotion` promoted the reporting suite. The rest of that package's
bundle moved with its driver half to `packages/drivers/github-actions/KNOWLEDGE.md` (wave 5).

Upstream paths map onto this package as follows: `packages/github-actions/src/{CheckState,
ManagedDocument,GitHubMarkdown,CheckDocument}.ts` are `src/` here and their `__test__/`
suites are `test/` here. `@effected/github-reporting` does not exist upstream; the suite
was part of `@effected/github-actions`. Where the text says "this package", read
`@beep/github-reporting`. `templates` is `@beep/managed-section` (imported through its
`CommentStyle`, `Section`, `SectionDialect` and `SectionDocument` leaves only), `markdown`
is `@beep/markdown`, and `github` is `@beep/github`. The bundle-reachability rule that
`GitHubMarkdown.ts` alone reaches the markdown engine is pinned by `test/reachability.test.ts`,
which also pins that the root barrel never reaches `@beep/markdown` (it is a subpath-only
module here). Two port changes touch this text: `ManagedDocumentError`'s `line` field is
named `markerLine`, and the check-run conclusion mirror is pinned against `@beep/github`
by `test/CheckState.test.ts`. Run `bun run test` and `bun run check` in this directory, or
`bun run beep quality package-verify @beep/github-reporting` from the repo root.

---
<!-- okf/interfaces/actions-reporting.md -->
---
type: Interface
title: actions-reporting
description: CheckState, ManagedDocument, GitHubMarkdown and CheckDocument — the living-document surfaces an action reports progress into.
status: stable
kind: api
resource: ../../packages/github-actions/src
tags:
  - architecture
  - dx
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: ccef981ebe664a6beecefcbbfc4a6a6ce7e37a38f62e3dd6dab98dba7187c2c6
verified:
  - by: human:spencer
    at: 2026-09-24T00:12:29.767Z
---

# actions-reporting

## Contract

Four modules answer one consumer shape: an action that reports progress
into a **living document** — a pull-request comment or check summary
rewritten as checks resolve. None of the four talks to GitHub; the
reconciler writes through a narrow sink the caller supplies, so the same
registry drives a pull-request comment, a check summary or a file, and the
API calls that carry any of it belong to [`github`](../modules/github.md)
and to the action composing them. `GitHubMarkdown.ts` is the only module
in this package permitted to import [`markdown`](../modules/markdown.md) —
see [bundle reachability](../modules/github-actions.md#bundle-reachability).

### `CheckState` — pure vocabulary

The states a run reports (running, pass, fail, warn,
user-interaction-required, skipped, timeout) plus the projection onto
GitHub's check-run status-and-conclusion wire. The conclusion literals are
mirrored **structurally** rather than imported, so the module never
reaches `github` — a check state is a reporting concept an action can hold
without linking an API client. A test pins the mirror against the real
union so the duplication cannot drift silently. Never "fix" this into an
import.

### `ManagedDocument`

A marker-delimited document: a sentinel comment identifies this action's
document among many, and named regions inside it are replaced from
current state while every byte the human wrote around them survives.
Create-or-update is one parse, not a find-then-branch. It is a thin
domain fixing of `templates`' section document (HTML comment style, a
fixed marker phrase, namespaced wire keys), not a second engine — the
region grammar, the line-ending invariant and the idempotence proof stay
in [`templates`](../modules/templates.md), under test there.

A region may carry `name="value"` metadata on its marker: `withRegions`
takes an optional triple alongside the existing two-tuple, and `meta` is
always present on the `regions` getter — never optional, so a reader never
branches on absence — but not addressable: `entry(key)` looks a region up
by key exactly as `region` does. `ManagedDocumentError`'s `invalidAttribute`
kind reports the consumer's region key, not the namespaced wire key.

### `GitHubMarkdown` — the writer

A fluent writer for GitHub's surfaces (tables, headings, links, code,
lists, collapsible sections, raw passthrough). Every member takes
pre-rendered markdown and returns a string, so compositions read as plain
string assembly — the writer owns the structure. This deletes the defect
where joining strings corrupts a table when a cell contains a pipe: a
cell's pipes are escaped, a fence inside a code block widens the fence,
and a URL with spaces is bracketed. The serializer's only failure is a
nesting-depth guard that is unreachable from this writer, because every
member wraps pre-rendered markdown in exactly one passthrough node, so a
composition nests strings, not trees — pinned by tests that nest the
writer's own output a thousand deep. `tableFor` requires a `format`
option for any non-string-encoded field rather than defaulting to
stringification; the serializer's impossible arm is a defect, not a
fallback.

### `CheckDocument` — the reconciler

An in-process registry of check reports, last-write-wins per check and
resolution non-terminal, projected onto a managed document by a scoped
background fiber and written through a narrow sink (a function from
rendered text to an effect, optionally paired with a read-back). Push, not
pull — nothing here polls GitHub. Trailing debounce with a max-wait
coalesces a burst into one write carrying its final state. A
byte-identical render issues no write at all. The finalizer is registered
before the daemon is forked, so it runs after the fork's own interruption
finalizer and the two cannot race for the sink; a background pass that
fails logs a structured warning and leaves the registry intact, and only
an explicit `flush` surfaces the typed error.

**The staleness guard** answers two workflow runs in flight against one
document. Without it, each pass reconciles against the last text *this
process* wrote, a process-local shadow, so a run never sees another run's
writes and happily rewrites over them. Two independent, opt-in mechanisms
close it: a sink `read` makes every pass reconcile against the live text
instead of the shadow; a per-run `stamp` (`{ at, runId }`) drops any pass
whose stamp is strictly older than the most recent stamp already on the
document, via `CheckDocumentStamp.isAtLeastAsRecent` — total and
reflexive, comparing `at` as epoch milliseconds when both sides parse as
dates and `runId` numerically when both sides are non-blank and finite,
falling back to lexical comparison otherwise. The blank guard on `runId`
is load-bearing: `Number("")` is a finite `0`, so a blank runId (the
ordinary case when `GITHUB_RUN_ID` is unset) would otherwise compare equal
to `"0"` and outrank `"-1"`. The stamp is a per-run constant, minted once
at startup, never per pass, which is what preserves the
byte-identical-render suppression; the accepted corner is that a
content-identical pass does not refresh the document's stamp, which is
sound because only a *strictly* older stamp drops. Unstamped regions are
ignored — evidence of a run that never opted in, not of a newer one.
`flush` answers `written | unchanged | stale`, and a drop announces
itself once, at the transition (INFO, then debug on repeats): the stamp
is constant, so a stale run stays stale, and a per-report line would bury
the one fact in the log a person reads when the report looks wrong.

The sink `read` carries the **same timeout bound as the write**, for the
same non-defensive reason: the pass holds the single permit and the
finalizer's last flush waits on it, so an unbounded read stalls scope
teardown. A failed read is `kind: "read"` — "GitHub would not tell us
the current comment" is a different problem from "the state could not be
rendered" (`render`) or "the write failed" (`sink`).

The guard narrows the window; it does not make the write atomic. A
read-then-write still races inside one pass, and nothing on GitHub's
comment API offers a conditional write to build a compare-and-swap on.
Never restate it as the stronger claim.

## Stability

`CheckState`, `ManagedDocument`, `GitHubMarkdown` and `CheckDocument` are
the contract surface. The sink function shape (`write`, optional `read`)
and the `stamp` option are part of the contract; the process-local shadow
used when neither is supplied is an implementation detail a consumer must
not rely on for multi-run correctness.
