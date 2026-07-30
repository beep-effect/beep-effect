# P3 Design Contract: libpff Driver Completion

Status: accepted 2026-07-26 (v2 — amended after a three-lens adversarial
design review; see "Review resolutions"). Scope: `packages/drivers/libpff`
only. This contract executes PLAN P3 against live HEAD and follows the P2 Tika
Server precedent (typed config, engine-version capture, shared
error-translation role file, stubbed deterministic proof, opt-in live lane).

## Exit criteria mapping

| PLAN P3 exit criterion | Design |
| --- | --- |
| Driver reports engine name and version | Probe `pffexport -V` once at engine construction; parse `pffexport <version>` from the first stdout line; populate `descriptor.version`. A failed probe leaves version unset and never fails construction (P2 precedent). |
| PST export writes child EML artifacts and JSONL metadata records | After `pffexport` completes, the driver walks every mode-derived target tree, assembles one deterministic `Message.eml` inside qualifying item directories, and writes `<artifact-id>.messages.jsonl` beside the target trees under the export root. |
| Exported children are represented through `@beep/file-processing` artifact schemas | Every raw exported file, every assembled `Message.eml`, and the `messages.jsonl` file surface as `ArtifactReference` children on `ArchiveExportResult`, ids derived via `deriveArtifactId([sourceId, relativePath])`, final child list sorted by `relativePath`. |
| Driver failures do not escape the operation contract | New `Libpff.error-translation.ts` role file consolidates the two existing inline translators; all failures remain `LibpffError` inside the driver and `FileProcessingOperationError` at the engine boundary. |

## pffexport ground truth (man page, local binary 20260608)

- `pffexport [-c codepage] [-f format] [-l logfile] [-m mode] [-t target] [-dhqvV] source`
- The target basename gains `.export` (allocated items), `.orphans`, and
  `.recovered`. Mode decides which trees exist: `items` → `.export`,
  `recovered` → `.orphans` + `.recovered`, `all` → all three. pffexport
  hard-fails (exit 1) when a tree it wants to create already exists.
- `-f text` (config default) writes `Message.txt` bodies; `html`/`rtf` write
  `Message.html`/`Message.rtf`; `all` writes every available variant.
- Item directories carry metadata files: `OutlookHeaders.txt`,
  `InternetHeaders.txt` (when original transport headers exist),
  `Recipients.txt`, `ConversationIndex.txt`, `ItemValues.txt` (only with `-d`).
- Non-mail MAPI items (Appointment/Contact/Task/Meeting/Note directories) also
  carry `OutlookHeaders.txt` with their own body files (`Contact.txt`, …).
- Attachment layout differs across libpff versions (`Attachments/` subtree vs
  `Attachment00001_<name>` siblings). The driver treats layout tolerantly, see
  classification below.

## Mode-derived target trees

`targetSuffixes(exportMode)`: `items` → [`.export`], `recovered` →
[`.orphans`, `.recovered`], `all` → [`.export`, `.orphans`, `.recovered`].
The driver walks each mode-derived tree that exists after the run (fixed
order: `.export`, `.orphans`, `.recovered`). `existingExportPolicy` always
covers **all three** suffixes plus `<artifact-id>.messages.jsonl`, regardless
of mode, so a rerun after a mode change never trips over stale trees.

## Export-tree classification (pure, deterministic, pre-assembly snapshot)

Classification operates on the walk snapshot taken **before** any driver
output is written. Driver-authored outputs (`Message.eml`,
`*.messages.jsonl`) are additionally excluded from classification by name, and
EML/JSONL child references are appended from assembly output — never
re-derived from a second walk.

An **item directory** is any directory in the snapshot that directly contains
`OutlookHeaders.txt`, except directories named `Attachments` or matching
`^Attachment\d` (attachment subtrees are never item directories, even when an
attachment is itself named `OutlookHeaders.txt`). Files below an item
directory classify as:

- body: first present of `Message.txt` > `Message.html` > `Message.rtf` >
  `Contact.txt` > `Appointment.txt` > `Task.txt` > `Meeting.txt` > `Note.txt`
  directly in the item dir (fixed precedence makes `-f all` deterministic);
  non-first body variants classify as metadata, not attachments
- metadata: `OutlookHeaders.txt`, `InternetHeaders.txt`, `Recipients.txt`,
  `ConversationIndex.txt`, `ItemValues.txt` directly in the item dir
- attachments: every other file under the item dir, at any depth, **excluding**
  files under a nested item directory (embedded messages become their own item
  records; this preserves the message→attachment relationship without double
  counting)
- `folderPath` = item dir's parent relative to its target-tree root (e.g.
  `Top of Personal Folders/Inbox`); `messagePath` = item dir relative to the
  export root (so it also encodes which target tree the item came from)

## EML assembly (deterministic, pure given file contents)

`Message.eml` is assembled only for item directories that have
`InternetHeaders.txt` or a `Message.*` body (non-mail items get JSONL records
without an EML), and is written inside the item directory:

- Headers: `InternetHeaders.txt` when present, CRLF-normalized, with
  MIME-structural headers stripped (case-insensitive `MIME-Version`,
  `Content-Type`, `Content-Transfer-Encoding`, `Content-Disposition`,
  `Content-ID`, including their folded continuation lines) and trailing blank
  lines removed, so the original message's MIME structure never contradicts
  the driver-generated structure below. Otherwise headers are synthesized from
  parsed `OutlookHeaders.txt` fields (`Subject:`, `From:` from sender
  name/email address) plus `X-Beep-Libpff-Client-Submit-Time:` carrying the
  verbatim submit-time string. Explicit P3 waiver: no `Date:`/`To:`/`Cc:`
  synthesis (Outlook time-format conversion and `Recipients.txt` parsing are
  deferred; the verbatim values remain available in `record.headers` and the
  exported metadata children). Synthesized header values are stripped of
  CR/LF (header-injection hygiene, mirrors Tika's content-disposition
  sanitizer).
- No attachments: single-part message, `Content-Type` from the body variant
  (`text/plain; charset=utf-8` / `text/html; charset=utf-8` /
  `application/rtf`), `Content-Transfer-Encoding: 8bit`, body verbatim —
  unless any physical body line exceeds RFC 5322's 998-octet limit, in which
  case the whole part is emitted as base64, losslessly (see the v5 addendum).
  The same conditional rule governs the body part of the multipart branch
  below. A headers-only item (InternetHeaders.txt, no body) yields an empty
  `text/plain` body part.
- Attachments present: `multipart/mixed`; part 1 is the body (as above), one
  part per attachment ordered by relative path, base64,
  `application/octet-stream` + `Content-Disposition: attachment;
  filename="<sanitized>"`. `Encoding.encodeBase64` returns an unwrapped
  string; the RFC 2045 76-column folding is a separate pure helper built from
  `A`/`Str` combinators.
- Boundary: `=_beep-<first 40 hex of sha256 via deriveArtifactId([sourceId, messagePath, "boundary"])>`
  — deterministic, ≤70 chars, valid RFC 2046 bchars.
- Budget: `operation.maxMaterializedBytes`, when present, caps the
  **cumulative** bytes of driver-assembled EMLs across the whole operation, in
  deterministic `messagePath` order. Once the next EML would exceed the cap it
  and all subsequent EMLs are skipped, each with a warning on the result;
  budget skips are warnings (data), not failures, and the JSONL record still
  carries `body`/`attachments`. Raw engine output on disk is engine-owned
  materialization and is not counted — the caller bounds it through
  `exportRoot` placement and `existingExportPolicy`. The `output-limit` →
  `output-limit-exceeded` translation arm is retained as a defensive mapping
  (it exists in the scaffold translator today).

## JSONL metadata records

New driver-owned schema `PffexportMessageRecord` (role file
`Libpff.messages.ts`):

- `folderPath: PosixPath` — folder chain inside its target tree
- `messagePath: PosixPath` — item dir relative to the export root
- `body: S.optionalKey(ArtifactReference)` — the raw body child, present
  whether or not the EML was assembled
- `eml: S.optionalKey(ArtifactReference)` — assembled EML child
  (mediaType `message/rfc822`, a valid `MimeType` literal)
- `attachments: S.Array(ArtifactReference)` — attachment children
- `headers: S.Record(S.String, S.String)` — parsed `OutlookHeaders.txt`
  key/value pairs (sanitized, verbatim values)

Records are encoded through `S.fromJsonString` (ChildArtifactRecord precedent),
ordered by `messagePath`, joined with `\n`, and written to
`<export-root>/<source-artifact-id>.messages.jsonl`. That file is itself a
child `ArtifactReference` (no mediaType: JSON Lines has no IANA literal in the
repo MIME table). Recorded seam: P4 reads `messages.jsonl` through the
`@beep/libpff` schema export; an engine-neutral message-record schema is a
deliberate P3 non-goal and becomes a capability-package decision only if a
second archive driver appears.

## Config additions (`PffexportEngineConfig`)

- `existingExportPolicy: LiteralKit(["fail", "replace"])`, default `"fail"` —
  the output-directory policy from PLAN P3 step 1, covering all three target
  suffixes plus the messages JSONL (see "Mode-derived target trees"). `fail`
  raises a typed `LibpffError("config")` when any of them already exists;
  `replace` removes them before spawning. Executable discovery stays as-is
  (typed `pffexportPath`, default `"pffexport"` resolved via PATH) — SPEC only
  requires typed config or PATH.

## Error translation

New `Libpff.error-translation.ts` exporting `libpffOperationError(operation,
error, options?)`, consolidating `Libpff.service.ts#mapLibpffErrorToOperationError`
and `Libpff.pffexport.ts#operationFailure`. The identity guarantee is scoped
to **reason + details** (what the existing tests assert); wording differs per
engine, so `options` carries per-arm message overrides
(engine-unavailable / timeout / export-failed) with pffexport-engine defaults,
and the scaffold passes its P1 wording. Reason mapping:
`engine-unavailable`→`engine-unavailable`, `timeout`→`operation-timed-out`,
`output-limit`→`output-limit-exceeded`, `config`/`process`→
`archive-export-failed` (exit code in `details` when available).

## Tests

Deterministic (bash stub, no real PST — the "generated synthetic fixture"
lane):

- stub handles `-V` (prints `pffexport 20260608`) and export invocations,
  writing a two-folder tree where **both** messages carry
  `OutlookHeaders.txt`; message 1 additionally carries `InternetHeaders.txt`
  (with MIME-structural headers to prove stripping) + nested
  `Attachments/report.pdf`; message 2 carries only `OutlookHeaders.txt` +
  `Message.txt` (synthesized-headers path)
- asserts: descriptor.version captured; children include raw files, two
  `Message.eml` refs (mediaType `message/rfc822`), and the `.messages.jsonl`
  ref; EML bytes contain expected headers/boundary/base64 and no duplicated
  structural headers; JSONL decodes through `PffexportMessageRecord` with
  correct folder/body/attachment relationships; `existingExportPolicy` fail vs
  replace (including a stale `.recovered` tree); cumulative budget skip with
  warning; existing failure translations still hold (reason + details)
- schema round-trips for `PffexportMessageRecord` in the service test; dtslint
  entries for the new exports; every new export ships `@example`/`@category`/
  `@since` JSDoc and `$I.annote`/`$I.annoteSchema` annotations plus barrel
  updates, proven by the package check/lint/docgen gates

Live lane (opt-in, mirrors `BEEP_TEST_TIKA_URL`): `test/integration/
Libpff.pffexport.live.test.ts` gated on `BEEP_TEST_LIBPFF_PST` (host path to a
real PST) — real `pffexport` run, asserts version, non-empty children, EML +
JSONL presence, all failures typed. No public PST binary is committed or
downloaded (public repo, fixture policy `generated-synthetic-fixtures`); the
documented public sample for operators is any EDRM Enron PST file
(<https://edrm.net/resources/data-sets/edrm-enron-email-data-set/>) pointed at
via `BEEP_TEST_LIBPFF_PST`.

## Review resolutions (v2)

- Mode-derived target trees + policy over all suffixes (blocker, realism lens)
- MIME-structural header stripping from verbatim InternetHeaders (blocker,
  realism lens)
- Pre-assembly snapshot classification + by-name exclusion of driver outputs
  (important, realism + repo-law lenses)
- Cumulative operation-scoped EML budget (important, contract + realism lenses)
- `Attachments`/`Attachment\d` item-dir exclusion, non-mail body files, fixed
  body precedence, defined no-body branch (important/minor, realism lens)
- Error-translation identity scoped to reason + details with per-arm wording
  overrides (important, repo-law lens)
- `body` field added to `PffexportMessageRecord`; `folderPath` typed as
  `PosixPath` (important/minor, contract + repo-law lenses)
- Stub fixture corrected (both messages carry OutlookHeaders.txt), base64
  wrapping helper noted, docgen/annotation obligations recorded, engine-brand
  seam recorded, public-sample fallback documented, Date/To/Cc synthesis
  explicitly waived (minor, all lenses)

## Review resolutions (v3 — post-implementation adversarial review)

A second three-lens adversarial review (bug hunt / repo-law / test adequacy)
ran against the implementation diff. Resolutions:

- Signal-killed pffexport (segfault on corrupt PSTs) now maps to
  `archive-export-failed`, not `engine-unavailable`: the spawn-failure mapping
  is scoped to `spawner.spawn` alone, and exit-wait/stream failures map to
  `LibpffError("process", "pffexport terminated abnormally")`. Proven by a
  `kill -SEGV` stub test (CONFIRMED, all three lenses).
- The budget gate now short-circuits **before** any part is read: once
  exhausted, remaining items skip reads entirely, and a strict lower bound
  (raw body + attachment bytes from the walk snapshot — base64 only expands)
  pre-skips over-budget items without materializing them. `assembleEml` is
  additionally wrapped in `Effect.try` so a pathological RangeError becomes a
  typed process failure instead of a defect (important, bugs + repo-law
  lenses). Peak assembly memory remains one in-budget message's parts by
  design.
- An engine-owned file already named `Message.eml` in an item directory is
  never overwritten: assembly is skipped with a dedicated warning, keeping
  children relativePaths unique and snapshot references truthful, proven by a
  colliding-stub test (PLAUSIBLE hazard, bugs + test lenses).
- `parseOutlookHeaders` dedupes with an own-key check (`R.has`) instead of the
  prototype-chain `in` operator (CONFIRMED, minor).
- Dropped item records get a dedicated non-portable-path warning instead of
  the misleading child wording (CONFIRMED, minor).
- Stub now fills mode-faithful trees (`recovered` → `.orphans` +
  `.recovered`, `all` → all three); added tests for both modes, plus the
  signal-death test and an `it.live` timeout test (TestClock cannot fire
  `timeoutOrElse` against a real subprocess). dtslint now covers every new
  export.
- Accepted P3 debt (probe-verified green by reviewers, no shipped
  assertions): `-f all` body-precedence, header-injection sanitization,
  attachment-named-OutlookHeaders.txt, embedded-item nesting, exact-at-limit
  budget boundary, and `X-Beep-Libpff-Client-Submit-Time` synthesis
  assertions.

## Review resolutions (v4 — hosted PR review)

- Greptile P1 "non-atomic export target ownership": concurrent exports of the
  same content-addressed source (duplicate PSTs are common in real corpora)
  could both pass the existing-output check before either wrote. Resolved with
  an atomic per-target claim (`<target>.claim` via non-recursive mkdir) held
  for the duration of the export and always released.
- Greptile P1 follow-on "replace steals active claims": the driver cannot
  distinguish a live concurrent export's claim from a crashed run's leftover,
  so a present claim refuses with a typed config error under **every**
  policy — `replace` replaces stale outputs, never claims. Crashed-run
  recovery is an explicit operator action (remove the `.claim` path or use a
  fresh export root). Covered by claimed-target tests for both policies.
- Greptile P1 follow-on "claim cleanup failures are hidden": the success path
  now releases the claim explicitly and surfaces a failed release as a result
  warning; the `ensuring` backstop stays silent only for failure paths, which
  already carry their own error.
- Greptile P1 follow-on "claim errors masquerade as ownership": claim
  acquisition discriminates `AlreadyExists` from other platform failures, so a
  permission or filesystem error reports "export claim could not be created"
  instead of falsely blaming a concurrent export.

## Addendum (v5 — body content-transfer-encoding decision, 2026-07-27)

Decided via a three-lens adversarial panel with a cross-examining judge on
2026-07-27.

- Decision: conditional base64. A body part stays `8bit` verbatim unless any
  physical line (split on `/\r?\n/`; a lone CR is content and counts toward
  its line's octets) exceeds RFC 5322's 998-octet limit, in which case the
  whole part is emitted as base64 — 76-column wrapped, same helper as the
  attachment path — losslessly: decoding restores the exact body string.
- Quoted-printable rejected: text-mode QP normalizes bare LF to CRLF on
  decode — a byte mutation; binary-mode QP forfeits the readability that
  would justify QP while demanding a novel hand-rolled encoder; no QP encoder
  exists in the repo.
- Unconditional base64 and do-nothing rejected: unconditional encoding is
  fixture churn for nothing (the overwhelmingly common short-line bodies are
  already compliant), and the header-waiver precedent does not transfer to
  bodies because a content-transfer-encoding is losslessly reversible while
  folding is not.
- Residual waivers: remaining `8bit` parts may carry bare-LF line endings —
  pre-existing, deliberately not normalized. "Byte-lossless" is relative to
  the UTF-8-decoded body string (post U+FFFD replacement); the raw body file
  remains the authoritative byte copy beside the EML. The ~33% growth of
  encoded parts reaches `maxMaterializedBytes` sooner, but the raw-bytes
  lower-bound pre-skip stays valid since base64 only expands.

## Out of scope (unchanged)

No OCR, no Box, no extraction capability on the libpff engine (still
`unsupported-file-format`), no capability-package changes, no CLI changes
(P4).
