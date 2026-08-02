# P1 Contradiction-Triage Implementation and Browser QA

Date: 2026-07-29

Verdict: **PASS**

## Implemented surface

- Added schema-first contradiction candidates, receipts, persisted correction
  proposals, and dispositions without changing `ClaimDispositionStatus`.
- Added organization-scoped tables, append-only disposition and evidence-
  verification guards, generated migrations, and db-admin registration.
- Added repository, server-only ports, and the client-safe RPC surface. The
  public review payload remains exactly candidate identity, expected version,
  and either a reasoned rejection or a reasoned persisted-proposal selection.
- Added the canonical source-text resolver, exact verified UTF-16 anchors,
  surrogate-safe paging, and fail-closed source re-verification.
- Added Effect Atom client state and the professional-desktop Beliefs dock
  surface. The UI presents both beliefs symmetrically and exposes no automated
  winner or raw fact-authoring action.

## Browser QA

Harness:
`.beep/qa-capture.mjs`

Canonical URL:
`http://professional-desktop.beep.localhost:1355`

Final artifacts:

- `.beep/qa/round-4/manifest.json`
- `.beep/qa/round-4/inventory.md`
- 21 screenshots under `.beep/qa/round-4/`

The opt-in seed used a fresh isolated database and vault root. It persisted two
candidates, four beliefs, four evidence records, exact verification receipts,
and a canonical source longer than one page with a surrogate pair crossing the
nominal page boundary.

Final capture result:

```text
Scenarios          12
Screenshots        21
Assertions         77 passed
Failed assertions  0
Console errors     0
Capture verdict    CAPTURE-GREEN
```

The scenarios covered closed-by-default dock behavior; open, focus, close,
reopen, float, move, resize, dock, and maximize gestures; container-responsive
wide and narrow layouts; light and dark themes; bitemporal filters and reset;
symmetric belief comparison; unavailable unverified sources; exact cross-page
source highlighting; required review reasons; rejection cancellation;
supersession; reload recovery; and final runtime invariants.

## Independent visual review

Round 3 reported four required findings: viewport-based floating layout,
clipped exact JSON, hash-first queue labels, and stale actions after
supersession. The fixes moved responsiveness to the triage container, wrapped
exact payloads, made proposal rationale primary, and treated the persisted
review result as authoritative.

A fresh high-effort visual review of every Round 4 screenshot confirmed those
four findings resolved and ended with:

```text
REQUIRED FINDINGS: 0
```

Five optional P2 polish notes remain in the ignored QA inventory. They concern
global dark-theme elevation, highlight palette, shared dock grips, tertiary
metadata sizing, and light-theme active-tab emphasis; none blocks correctness,
accessibility, or the requested feature.

## Scoped package and migration proof

The final focused lanes passed after the strengthened span schema exposed and
corrected two legacy test fixtures whose declared widths did not equal their
quotes' UTF-16 code-unit lengths.

| Surface | Result |
| --- | --- |
| provenance | 2 files / 13 tests; build; lint; 18 docgen examples |
| langextract | 4 files / 31 tests; build; lint; 43 docgen examples |
| file-processing | 3 files / 22 tests; build; lint; 105 docgen examples |
| workspace server | 3 files / 19 tests; build; lint; 24 docgen examples |
| epistemic domain | 5 files / 62 tests; build; lint; 236 docgen examples |
| epistemic tables | 3 files / 24 tests; build; lint; 90 docgen examples |
| epistemic use-cases | 5 files / 27 tests; build; lint; 110 docgen examples |
| epistemic server | 3 files / 26 unit tests and 2 files / 7 contradiction PGlite tests; build; lint; 25 docgen examples |
| epistemic client | 2 files / 8 tests; build; lint; 23 docgen examples |
| epistemic UI | 2 files / 7 tests; build; lint; 9 docgen examples |
| db-admin | 2 files / 7 unit tests and 5 files / 5 PGlite migration tests; check, migration-drift proof, build, and lint |
| professional desktop | 31 files / 120 unit tests and 1 file / 4 PGlite seed tests; production build |

The JSDoc/schema-annotation pass typechecked 683 examples across the four
source-text packages and six epistemic packages listed above. The Effect,
schema, Atom reactivity, and Crispen passes also removed forgeable runtime
proofs, throwing persistence codecs, seed fallbacks, unbounded queue limits,
duplicate read models, and a now-redundant claim-gate span guard.
