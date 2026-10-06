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

**Existing install on that PC.** The July extension is installed there and was
the running server (Claude Desktop → Developer shows it "managed by an
extension", pointed at the July bundle). The scripted session could not see it:
this Claude Desktop install keeps its data under a virtualized path, not the
plain `%APPDATA%\Claude`, so a script-level edit of
`claude_desktop_config.json` lands in a file the app does not read. Two
consequences: the update path on this machine is **Settings → Extensions**
(uninstall the old extension, install the new `.mcpb`, set the bundle folder),
and the manifest version had to change, because the July package and the first
2026-10-06 package both said `0.0.0` and the app could not tell them apart. The
manifest version is bumped per hand-off (`0.2.1` after the handshake fix).

## Handshake failure on first install, and the fix (D-17)

Installing the first package in Claude Desktop failed for every session:
"initialize is not supported by the configured MCP protocols (requested
'2025-11-25')". The host had been stateless-only since the stateless-kit
change; Claude Desktop always opens with `initialize`. The eleven-check
Windows run above did not catch it because its driver spoke the stateless
framing directly. That run proved the tools and the bundle on Windows; it did
not prove that the real client could start the server.

Fix: the host lists the handshake-era protocol versions after the stateless
one. Proven on the workstation with the compiled binary: `initialize`
negotiates `2025-11-25`, `tools/list` returns ten tools, a tool call succeeds,
and a stateless client still works on the same binary. The compiled smoke now
has a handshake leg (`COMPILED_HANDSHAKE_OK`). Package version `0.2.1`.

## Not done here

- **AC-6** needs people: the operator replaces the extension through
  Settings → Extensions and points it at the new bundle folder, and the
  attorney asks his first questions with memory cleared. Server and bundle are already
  on the PC and proven at the tool layer.
- **P5 correctness calls** on G-1..G-5 remain the attorney's.
- windows-latest CI packaging smoke (D-15 follow-up).
- Scope calls A-8 / A-10 / A-13 stay with the operator.
