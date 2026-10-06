# Friction Receipts

## 2026-10-06 — Grok read-only sandbox preflight

- Activity: qualify the actual Grok Build `/deep-research` workflow.
- Evidence: Grok 1.0.49 failed before workflow launch: `could not resolve
  runtime-socket deny path /run/podman/podman.sock: Permission denied`.
- Consequence: no workflow or X Search execution was proven by that attempt.
- Prevention: sandbox path discovery should safely deny an inaccessible parent
  rather than fail while trying to inspect a socket beneath it.
- Follow-up: diagnose a protection-preserving launch; retain actual workflow and
  X tool evidence before qualifying the route.
- Resolution: an outer read-only bubblewrap namespace hides the entire Podman,
  containerd, and Docker runtime directories. Grok's own read-only sandbox remains
  enabled. Persistent ACP keeps the background workflow alive; one-shot `-p`
  dispatch alone returns before completion. The operational run completed all
  four phases in 318 seconds, with observed backend X Search calls. Its research
  report explicitly retained partial findings and missing X thread context.

## 2026-10-06 — Grok backend result visibility

- Activity: preserve original X post evidence independently of generated summaries.
- Evidence: ACP emits `XSearch` start/completion events and backend function names
  and arguments, but those completion payloads omit the returned post body.
- Consequence: workflow completion and X execution can be verified; prose copied
  by the model cannot be relabeled as a raw backend response. Source captures must
  disclose the transport limit and retain incomplete dispositions where needed.
- Prevention: the subscription transport should expose source result payloads or
  a source export with stable identifiers and completeness metadata.

## 2026-10-06 — Firecrawl PATH shim

- Activity: inventory installed extraction tools.
- Evidence: PATH shim returned `No version is set for shim: firecrawl`; installed
  Node runtime executable reported Firecrawl 1.19.24 successfully.
- Prevention: resolve the managed runtime explicitly or use the existing Beep
  Firecrawl driver. Do not treat the broken shim as a missing installation.

## 2026-10-06 — Recorded QA skill command drift

- Activity: extract recorded evidence for the portable HTML library.
- Evidence: the browser QA skill prescribes `beep qa extract --round N`; current
  CLI returned `Unrecognized flag: --round` and exposes `--session <directory>`.
- Resolution: use the recorded round's session directory. Capture round 2 passed
  all five browser scenarios with witness events and video before extraction.
- Prevention: run skill command examples against current CLI help or maintain
  executable workflow examples alongside the command contracts.

## 2026-10-06 — Qualification must survive stricter replay

While qualifying the library, an older caption receipt claimed readability
without enough track-origin metadata. A later successful capture cannot erase
that claim silently. Preserve a correction receipt and the earlier catalog
bytes, downgrade the invalid claim explicitly, and retry. Regression coverage
should include validator changes against genuine historical receipts, not only
new fixtures. Evidence: library qualification replay and the acquisition
correction tests in `research-library-acquisition.test.ts`.

## 2026-10-06 — Library topology follow-ups after runtime freeze

- Activity: structural audit of the maintained research library against the
  architecture standard's Repo CLI Command Topology.
- Evidence: `Library.service.ts` contains library-root/config resolution rather
  than a `Context.Service` contract and live layer. The Research facade also
  reaches an internal context validator through the import module's star export.
- Severity: P2 maintenance debt; no product-domain dependency leak, browser/runtime
  boundary violation, or external private import was found. This does not block
  the current operational intake.
- Follow-up: rename the resolver role to an earned paths/config role, and curate
  the import facade's named public models/use-cases while retaining context
  validation through the source-only test seam. Perform this after the runtime
  freeze with compatibility and example-compilation checks.
- Prevention: decide the public programmatic API and role filenames before
  implementation examples and tests start depending on the command facade.

## 2026-10-06 — Provenance failure must not imply missing repository bytes

- Activity: replay every acquired GitHub capture against its local repository.
- Evidence: verify emitted "pinned commit unavailable" after an earlier semantic
  comparison failed, although all eight reported pins resolved with `git cat-file`.
- Prevention: report pin availability from the Git object check independently of
  URL, redirect, or revision-provenance validation. Encoded scoped tags and renamed
  repositories need explicit identity evidence, not a broad URL equality bypass.

## 2026-10-06 — Current evidence should precede acquisition history

- Activity: recorded browser navigation from a source card to a paper extraction.
- Evidence: QA round 4 found a readable source whose first text link opened a
  historical blocked attempt. No required browser failures remained, but the
  ordering obscured which evidence was admitted for reading.
- Prevention: lead with validated current captures and label retained acquisition
  history separately; preserve the earlier artifacts and correction receipts.

## 2026-10-06 — Validator changes can affect unrelated selected-source runs

- Activity: reacquire three renamed GitHub references after a bounded validator fix.
- Evidence: acquisition revalidated historical captures globally before applying
  the selected source set. A temporary closed-head requirement demoted 68 valid
  API-diff captures outside that selection; immutable originals remained intact.
- Resolution: restore the intended API evidence contract, replay all originals,
  and append new validation admissions while retaining the correction history.
- Follow-up: separate whole-library migration/revalidation from selected-source
  acquisition, and record the validator contract version in migration receipts.
  Changes to evidence obligations need a real-corpus replay before state mutation.

## 2026-10-06 — Historical readable captures masked later human corrections

While reconciling three membership-gated article excerpts, `research library verify`
counted an older readable capture alongside a later explicit incomplete review.
The source/version summary preferred any historical readable result. This is an
introduced accounting defect: current status needs one validated effective decision
per requested version while retained captures still undergo integrity checking.
The active repair shares selection across status, verify, rendering and acquisition,
with regression cases for review precedence, later reacquisition, version isolation
and corrupt-review refusal. No original bytes or review history are deleted.

## 2026-10-06 — Documentation URLs can resemble operational API endpoints

The Graph documentation pages under `learn.microsoft.com/.../graph/api/` were
heuristically classified as endpoints and the automatic route stopped. The parent
used the existing Firecrawl driver and maintained import to retain actual HTML
and readable API documentation, with target status and hashes checked. The URL's
path is not proof that it is an invocation endpoint. A future classifier change
should use a bounded official-documentation fixture rather than broad URL rewriting;
this intake remains correctly acquired without asserting endpoint health.

- 2026-10-06: final Atlas projection rejected the new child README because its generated status region was absent. Restored the template markers, then used the maintained Atlas writer. Packet scaffolding should preserve generated regions before replacing authored prose.

- 2026-10-06: Yeet's wider gates found 45 test-policy entries, one schema declaration and 39 introduced Fallow findings after package audit had passed. Package proof does not cover every repository admission gate; run the cheap admission audits earlier in large CLI work. Refactor the introduced complexity and duplicates rather than baselining them. The obsolete repair continued into full-repo docgen after reporting reds; its owned process tree was stopped while repairs began. Two unrelated terse-helper edits made by the prepare step were restored to HEAD; no unrelated branch work was changed.

- 2026-10-06: independent storage review identified a concurrent publication edge: a same-byte symlink installed before a hard-link collision could pass the winner hash check. Added resolved containment checking to that collision branch and a deterministic filesystem-interception regression; the existing immutable path and hash checks remain. No live library mutation was needed.

### Fresh-main overlap at publication

The final package proof was interrupted with exit 130 to integrate main
`99d30b1b5286ae281cfab6dd7e67b169c6b01111`. M365 outbox slices 1/2 had landed
while synthesis was running, and its new decisions occupied D-12–D-27. The
research contract is now D-28; upstream guard, audit and phase progress are
preserved. Current v1 `sent` means Graph acceptance, so the research's richer
observed-sent contract remains future work with compatible journal evolution.
A hash-preserved stash and integration logs provide recovery. A fresh package
proof replaces the interrupted attempt. Earlier live packet ownership checks
would have reduced this reconciliation cost.

### Post-merge hook before workspace installation

The additive main refresh through `6008faca1d` introduced drawing workspaces.
The post-merge version check loaded the new CLI before workspace links existed
and reported `Cannot find module @beep/pdf-tools`. The Git update and index
restoration succeeded; a frozen install established the new workspace links.
The same version check then passed. This was an installation-order precondition,
not a research-library code failure. A hook that detects missing workspace links
before loading the full CLI would make the recovery clearer.

### Commit-hook documentation parity

After package audit/docgen and focused tests passed, `yeet publish` reached the
commit hook and reported 17 introduced `jsdoc/no-blank-block-descriptions`
errors. The correction is confined to comment whitespace; executable-token
equality and the exact hook lint are recorded. Package proof did not expose this
hook-only failure before publication. Running the staged JSDoc hook alongside
local final checks would have prevented the late interruption. Nonblocking
JSDoc advisories are not described as errors or silently suppressed.
