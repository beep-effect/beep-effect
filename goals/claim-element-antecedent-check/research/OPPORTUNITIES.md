# Opportunities and friction receipts — claim-element-antecedent-check

Receipts recorded at the moment friction happens (AGENTS.md "Friction is a first-class output").
They are redacted: no secrets, no absolute home paths, no session ids.

## 2026-10-14 — USPTO ODP key rejected (403) when scoping the P2b adapter

- **Doing:** probing the Open Data Portal documents endpoint. The goal was to learn whether
  file-wrapper claims (`CLM`) download as XML, which decides how the `UsptoClaims` adapter parses
  claims.
- **Evidence:**
  - The workstation's agent `USPTO_API_KEY` reference resolves to a 30-character key.
  - `GET https://api.uspto.gov/api/v1/patent/applications/<public application>` returns `403`
    with the key and `401` without it. The `/documents` endpoint returns `{"message":"Forbidden"}`,
    and the search endpoint also returns `403`.
  - So the key is recognized but not authorized.
- **Cost:**
  - The adapter's `application` source is blocked, and so is the office-action provenance for
    positive fixtures.
  - P2a and the use-cases Layer are unaffected.
- **Would have prevented it:**
  - A `beep` health probe for each external data credential: a cheap authorized call, reporting
    status only and never the value.
  - Running that probe when a goal that depends on the source graduates.
  - Regenerating an ODP key needs the operator's verified USPTO account, which is a human step.

## 2026-10-14 — Junie lane died on an exhausted JetBrains balance the accounts screen did not show

- **Doing:** running P2a as a bounded Junie lane (`junie --model=claude-opus-5-5 --effort=medium`).
  The doctrine prefers the JetBrains pool while `beep accounts status` shows credit left in the
  cycle.
- **Evidence:**
  - `beep accounts status` showed JetBrains AI at "23% left" with three days to reset.
  - Seven minutes and about 40K Opus output tokens into the run, Junie exited 1. Its JSON `errors`
    held "Insufficient account balance. All tokens in your account have been spent."
  - The text printed was "Failed to build 'issue.md.junie_standalone'".
  - No files changed.
- **Cost:** one lane launch. The work moved to the Claude child route.
- **Would have prevented it:**
  - The accounts poller should read the JetBrains balance at launch time, or mark how old its
    reading is.
  - Lane launchers should map Junie's "Insufficient account balance" error to a confirmed quota
    failure, so the fallback is automatic and the summary line is not misleading.

## 2026-10-28 — ODP access blocker reproduced during worktree resumption

- **Doing:** resuming P2 from current `origin/main` in a dedicated worktree.
- **Evidence:** authenticated read-only probes of
  `GET /api/v1/patent/applications/16123456` and its `/documents` endpoint
  both returned HTTP 403. The key was read through the approved agent `op`
  route and passed directly to the request in memory; no value was printed
  or persisted. No live claims or office actions were acquired.
- **Consequence:** the real-rejection vertical slice, positive provenance,
  labelled corpus and adjudicated evaluation remain unverified. Synthetic
  rule tests do not satisfy these requirements.
- **Next prerequisite:** restore authorized ODP access through the operator's
  verified USPTO account, then repeat a status-only probe before acquisition.
- **Prevention:** validate source authorization at goal resumption before
  launching corpus labelling. An HTTP 403 alone does not distinguish an
  expired key, account entitlement, or upstream access policy.

## 2026-10-28 — Live XML representation differs from synthetic fixtures

- **Doing:** validating the source adapter after the operator restored ODP access.
- **Evidence:** public application `16123456` returned HTTP 200 and 52 documents.
  Both claims documents list PDF before XML; the XML downloads redirect to
  `data-documents.uspto.gov` and return TAR containers. Archive entries contain
  namespaced `ClaimsDocument` / `Claim` / `ClaimText`, not the synthetic
  `<claim num>` / `<claim-text>` shape. Both sampled claims XML documents
  include `OCRConfidenceData`. The amended set also has `Ins` / `Del` markup.
- **Consequence:** a successful listing and an XML format label do not establish
  eligibility under the no-OCR fixture rule. The records are quarantined in
  the ignored local acquisition cache, not committed or treated as gold.
  The sampled non-final action does not supply the required antecedent
  rejection. Native full-text claims and a real rejection must still be bound.
- **Prevention:** qualify actual bytes, namespaces, source-generation metadata,
  and amendment status before launching the extractor/critic loop.

## 2026-10-28 — Metadata search page ceiling

- **Doing:** collecting approximately 200 allowed-claim source sets.
- **Evidence:** ODP application search returned HTTP 400 with
  `Requested page limit exceeds allowed limit 100`.
- **Resolution:** use 100-row pages with explicit offsets; record source
  counts before qualification rather than treating metadata matches as claims.
- **Prevention:** read and schema-bound the source pagination limit before
  launching larger acquisition jobs.

## 2026-10-28 — Gold protocol copied parser limitations

- **Doing:** independently reviewing the corpus annotation procedure before
  treating it as a deterministic recovery benchmark.
- **Evidence:** the initial procedure forced five-token and stop-word cuts,
  including omission of `a through hole` and truncation of the quoted
  `end of process` signal. The P0 schema describes full lexical phrases and
  does not impose those cuts. Unsupported input transitions had also been
  classified as unresolved gold despite the tree schema representing them.
- **Resolution:** preserve 14 earlier family drafts as auxiliary conformance
  receipts, exclude them from semantic scoring, and derive fresh references
  under semantic-reference/v2 without access to implementation rules. The
  deterministic implementation remains fixed for honest floor measurement.
- **Prevention:** an independent critic must check annotation protocol fidelity
  before volume labeling. Separate source uncertainty, reference uncertainty,
  implementation coverage and semantic recovery in every denominator.

## 2026-10-28 — Native XML and chronology are insufficient source proof

- **Doing:** checking whether published claims match the claims rejected by
  the examiner.
- **Evidence:** same-day CLM records contain competing versions; one native
  claim embeds the following numbered claim; another proposed independent root
  lacks its reference number. Original PDFs resolved missing headers in some
  XML records, while a separate native software claim lost formula operators.
- **Resolution:** retain extractor and critic evidence, document identifiers,
  hashes and inspected page numbers; keep material version/symbol conflicts
  unresolved. Original PDFs corroborate only; gold text remains native XML.
- **Prevention:** compare the numbered examiner phrases and actual original
  version to native source. Full inventory chronology is necessary but does
  not establish adoption of an amendment or lossless native representation.
