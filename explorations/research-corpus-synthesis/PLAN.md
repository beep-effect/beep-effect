# Approved Implementation Plan

## Outcome

Build the reusable external library at `$HOME/YeeBois/research/beep-effect/` and
complete this exploration by routing evidence-backed findings into appropriate
existing or new packets. Phase 1 must pass before substantive synthesis begins.

## Phase 1: reference library

1. Snapshot every input file with original location, SHA-256, size, repository
   commit, and capture time. Keep originals immutable.
2. Extract every citation occurrence from Markdown, JSON/JSONL, bare URLs,
   DOI/arXiv IDs, and supported repository shorthand. Retain positions, labels,
   context, finding IDs, original locators, and unresolved identities.
3. Classify resource kinds, ownership, aliases, and cited versions. Keep
   operational endpoints and internal links distinct from readable articles.
4. Qualify actual acquisitions per kind, including Grok Build /deep-research and
   observed X Search. Install fallback tools only when a demonstrated gap needs
   them. Use existing subscriptions and approved secret routes.
5. Capture papers with originals and readable extraction; clone every referenced
   external GitHub repository at a recorded commit; archive referenced issues,
   PRs, releases and diffs separately; capture web originals plus Markdown;
   retain YouTube captions/context with local audio transcription only as a
   fallback; import source-bearing X results with tool provenance.
6. Generate report/source/topic/type/status navigation, search and backlinks in
   Markdown and standalone HTML. Escape untrusted content and keep relative
   links portable.
7. Verify every source is readable or explicitly disposed. Report readable,
   unavailable, ambiguous, incomplete, and tool-blocked counts separately.
   Qualification failures cannot masquerade as source unavailability.

## Maintained interfaces

`beep research library` exposes `inventory`, `qualify`, `acquire`,
`import-result`, `verify`, `render`, and `status`. Keep the library separate from
the existing knowledge vault. Use schema-first JSON/JSONL, typed Effect services,
atomic writes, single-writer catalog updates, bounded concurrency/retries,
immutable artifacts, and per-source acquisition receipts. Reruns skip verified
outputs; later intakes reuse sources without overwriting earlier snapshots.

The library contains `intakes/`, `catalog/`, `objects/sha256/`, `sources/`,
`repos/github/`, `ops/`, and `views/`, with a root README and library manifest.

## Phase 2: synthesis and graduation

Read every report and packet; evaluate source-linked findings against live
capabilities, current goals/explorations, active work, architecture doctrine and
the Effect reference checkout. Preserve contradictions, duplicated reporting,
superseded advice and evidence gaps. Separate source assertions, verified
observations and proposed cross-domain experiments. No domain is excluded in
advance; evaluate concrete value, existing coverage, evidence, effort,
dependencies and bounded acceptance tests.

Route each finding to attach/amend existing work, new ready goal, child
exploration, or duplicate/superseded/parked/rejected disposition. Completed work
gets re-entry evidence rather than a silent lifecycle reset. Create the justified
packets and synchronize provenance/manifest backlinks. Graduate only when the
exploration definition-of-ready passes and promised-now packets exist.

## Acceptance and rollout

Test extraction forms, identity/revision preservation, hashes, interrupted
writes, corrupt artifacts, unavailable sources, partial pagination, false success
responses and provider qualification. Exercise real acquisition per source kind,
portable HTML links, real search/filter input, idempotent second run and later
intake reuse. Require every finding to have an explained route. Run CLI package
verification and browser QA. Publish/merge through Yeet and retain reflection
and lifecycle state in the same final PR. Never modify merged nightly packets or
their single-writer ledger. Keep full copyrighted/private source content external.
