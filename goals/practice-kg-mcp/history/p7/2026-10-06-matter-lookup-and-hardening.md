# P7 evidence — matter lookup, claims carry, verification, server hardening

Date: 2026-10-06 · Decisions: `SPEC.md` D-12 – D-15. Closes P6 and P7; the
defect-register items below refer to
[`../p5/2026-07-30-defect-register.md`](../p5/2026-07-30-defect-register.md).
Client numbers and matter content are withheld as before.

## What changed

| Item | Change |
| --- | --- |
| Matter lookup (D-12) | Build writes `matters` (170) and `matter_dockets` (438) into the bundle DuckDB. `PracticeKgMatterLookup` service, `kg_matter_lookup` tool, and `extractPracticeKgReferences`. Contract: [`../../research/matter-lookup-contract.md`](../../research/matter-lookup-contract.md). |
| Claims carry (D-13) | `claims.ts --carry-from <bundle>` lifts claim and evidence rows verbatim and resolves `sourceDocumentDigest`. No model call. |
| B-2 node provenance (D-14) | Not reproducible on the current build: the July compiled host fails on the July bundle, the current compiled host resolves every node kind by `iri` and `natural_key`. Locked in by `verify.ts`. |
| B-3 typed failures | `PracticeKgToolError.reason` is `store-query-failed` or `row-decode-failed`; "no such record" is zero rows plus a note, not an error. |
| B-4 node floor disclosure | Node provenance results carry a note explaining `attributionSource` and `recycled-unverified`. |
| B-5 claim routing | `kg_candidate_claims` description now names office-action questions and the label duty. Claim rows carry `client` and `familyKey`; the family filter accepts either key form. |
| B-6 truncation signal | Results below the complete tier list `withheld_columns`. |
| B-7 degenerate joins | Removed at the source in P6: family counts are per family and `files_as` is no longer a cross-product. The family query is pinned by per-family count assertions. |
| B-8 match offsets | `corpus_search_text` returns `matchOffset` and a snippet around the first matching term. |
| Store format | DuckDB store is format 2 (new tables); the host refuses any other pglite/duckdb format by name. Bundle version `2026-10-06-01`. |
| Windows packaging | The pinned DuckDB win32 binding had drifted from the lockfile (`1.5.5-r.2` vs `1.5.6-r.1`), so the Windows package could not be built from main; pin and integrity updated from `bun.lock`. |

## Rebuilt bundle

`<corpus>/staging/practice-kg-bundle-p6`, built from the base run with emails,
then claims carried from the shipped `practice-kg-bundle`.

`verify.ts --bundle-dir` result:

| Check | Value |
| --- | --- |
| nodes / resolved through the provenance projection | 8,240 / 8,240 |
| `catalog-digest` references not in the bundle | 0 |
| `uspto-anchor` references not in the bundle | 0 |
| dangling edges | 0 of 1,756 |
| matters vs family nodes · matter dockets vs docket nodes | 170 = 170 · 438 = 438 |
| claims carried · linked to a catalogued document | 16 · 14 |

AC-2 is met on this bundle: every graph row resolves.

## Spot re-runs (compiled Linux host, rebuilt bundle)

Nine tool calls over stdio from a neutral working directory.

- **G-1 family 10073** — one family, ten rows, no application or patent
  column populated: zero phantom patents.
- **G-3 family 10013** — the family lookup returns five families (four
  client-keyed, one unattributed) and one member application.
  `kg_candidate_claims` returns four claims, every one labelled
  `candidate — unreviewed`, with an evidence quote and a source-document
  digest; two sit in a client-keyed family.
- **Matter lookup** — a client-keyed docket resolves `unique`; the bare family
  number resolves `ambiguous` (13 docket rows); application `13/572,982`
  resolves `none`, and `kg_application_lookup` shows it against six families as
  mentions only.
- **Node provenance** — a client-keyed family resolves by `natural_key`.

## AC-5 under enforced network isolation (closes D-10(c))

The same nine calls were run twice against a private copy of the bundle: once
normally, once with the host inside `bwrap --unshare-net` (loopback only; an
outbound TCP connect from inside fails with "Network is unreachable"). The two
response streams are byte-identical. The host needs no network.

## Windows target run (relayed by the orchestrator session, same day)

A Claude Code session on the attorney's PC (Windows 11 Pro) ran the unattended
checklist against the staged hand-off set. As reported:

- Checksums match; manifest reads bundle `2026-10-06-01`, duckdb 2 / pglite 2,
  with the same document, email, node, and edge counts as the workstation.
- Nine tool calls straight against `practice-kg-mcp.exe` from `C:\`: eleven of
  eleven checks pass and every row count equals the workstation run. `stderr`
  is empty.
- Zero TCP connections owned by the process across eleven samples.
- The executable exits with code 130 when stdin closes. That is the host's
  normal end-of-input path (the compiled smoke already accepts 130), not a
  fault; left as is.
- The executable is unsigned; `Unblock-File` was applied.

This is the first run of this build on real Windows, and it covers the B-1
cwd-independence regression on the target itself.

**Correction to earlier packet notes:** this PC had no prior practice-KG
install (no Claude extension, no KG entry in the Desktop config, empty target
folder). The July gauntlet ran on a different Windows test target. There is
therefore no old extension to disable, and "installed on the attorney's
machine" was never true before this hand-off.

## Not done here

- **AC-6** needs people: the operator registers the server in the Claude
  Desktop config with the app closed (a prepared script), and the attorney
  asks his first questions with memory cleared. Server and bundle are already
  on the PC and proven at the tool layer.
- **P5 correctness calls** on G-1..G-5 remain the attorney's.
- windows-latest CI packaging smoke (D-15 follow-up).
- Scope calls A-8 / A-10 / A-13 stay with the operator.
