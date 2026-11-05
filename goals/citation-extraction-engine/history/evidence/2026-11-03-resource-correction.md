# Source reporter and page correction

ResourceCorrection.ts ports ResourceCitation.corrected_reporter and
ResourceCitation.corrected_page from pinned eyecite 2.7.6 commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e, tree
a35a58fac03400f71a93a93485b77f1d56f2b02f (Free Law Project, BSD-2-Clause).
The producer verifies a clean exact oracle and CPython 3.11.15 before execution.

## Observable behavior

Reporter correction prefers a non-null built-in edition guess and otherwise
returns groups['reporter'], including None or the empty string. Missing reporter
without a guess maps the original KeyError to a closed missing-reporter error.
Page correction returns None for missing/None pages. A false/empty raw reporter
suppresses edition lookup and correction. Otherwise either the raw reporter or
selected edition's short_name must exactly equal NY Slip Op or Misc. 3d before
[U] and [A] become (U) and (A). Case, spacing, malformed markers and other text
remain exact. These two fixed substitutions cannot create each other's input,
so one native scan preserves the source's ordered replacements.

Missing group keys and Python None remain distinct in the schema. All output
storage is owned. The existing Python Unicode adapter validates and reserves
receiving input, and its existing native slice primitive reserves the output
before allocation. Only the ASCII bracket points in the owned output are
modified. A JavaScript projection is not re-encoded: doing that would coalesce
adjacent literal surrogate points. ASCII reporter membership uses a derived
schema guard, where the projection cannot create a false ASCII equality.

The existing frozen owner supplies every edition. A shared readFrozenEdition
helper routes actual source families through source/lookup; edition inference
reuses the same helper. No new owner service, custom lookup protocol, worker,
transport, scheduler or public API is introduced. Methods capture their Clock
and optional enclosing text budget and require no caller services. Standalone
calls get fresh budgets; later caller contexts cannot replace captured owners.

## Corpus and focused proof

The actual original methods supply 396 native control states (missing keys,
None, empty values, exact/near reporter names, three edition states, bracket
variants, astral points and literal surrogate pairs). Both methods also execute
against all 2533 canonical editions. All 5858 source method calls compare locally
with native payloads, including widths and little-endian bytes. Canonical
controls authenticate existing edition fixtures; no synthetic production payload
is installed.

Producer SHA-256:
417d1f26aa0e4886f6b50a4d8c4a548ac5f7e9a5bf8169cb307b8d30d05e16f6.
Formatted resource-correction.json SHA-256:
e67abb0daae801a181d254994d79e2a16ee453ddb022348e0cb801e7a6778100.
Regeneration under PYTHONHASHSEED=103 compares byte-identical after formatting.
The formatted corpus is 789211 bytes and stays inside normal formatting limits.

Boundary controls verify the exact 16-unit correction route, 15-unit refusal,
unchanged caller bytes, fresh repeated-call ownership and an enclosing budget
that retains authority under caller replacement. Injected blocking lookup
confirms the captured deadline under a disabled caller Clock; empty raw reporter
bypasses that lookup before the manual deadline signal is released.

Twelve focused tests in four files include the new methods and existing frozen
edition, edition inference and full-law composition regressions. Scoped package
lint/type checks, Oxlint, both policy checks and new-only Fallow are run for this
wave. Complexity was reduced by extracting native marker correction rather than
changing a floor or adding a suppression. Normal commit/push hooks remain in
force. Broad local aggregate verification and head-install preflight are deferred
under the operator's hosted-CI instruction; latest-head hosted proof is pending.

This does not implement corrected_citation's general native replacement,
corrected_citation_full formatting, arbitrary custom source protocols, remaining
metadata families, public engine/Layer or exhaustive goal acceptance. No new
semantic waiver or policy exception is introduced.
