# Sources

## Repository Sources

- `goals/patent-citation-candor-gate/README.md` — five claimed follow-ons.
- `goals/patent-citation-candor-gate/SPEC.md` — original gate invariants and deferred binding.
- `goals/patent-citation-candor-gate/research/01-gate-shape-check.md` — prior topology research.
- `standards/ARCHITECTURE.md` — current cross-slice and foundation routing law.
- `packages/law-practice/domain/src/values/CitingApplicationIdentity/` — current identity union.
- `packages/law-practice/use-cases/src/CandorPolicy/` — current fail-closed predicate.
- `packages/law-practice/server/src/CandorRecord/` — current SQL read shape.
- `packages/agents/use-cases/src/processes/ProfessionalRuntime/` — current candidate-output acceptance boundary.
- `goals/lint-policy-single-digit/research/04-pr-scoping-deferred.md` and repo-cli quality-task code/tests — current changed/full policy planning.

## Primary External Authority

- [WIPO Standard ST.13](https://www.wipo.int/documents/d/standards/docs-en-03-13-01.pdf),
  retrieved 2026-08-13 — defines the 15-character machine-readable application
  number as a two-digit type, four-digit year, and nine-position serial. The
  `0000` year is an office policy choice, not a year that another consumer may
  infer for an unrelated office.
- [USPTO MPEP § 503](https://www.uspto.gov/web/offices/pac/mpep/s503.html),
  retrieved 2026-08-13 — defines the U.S. eight-digit application number as a
  two-digit series code plus six-digit serial and shows that one series spans
  multiple filing years.
- [WIPO ST.13 application-numbering practices](https://www.wipo.int/documents/d/standards/docs-en-07-02-06.pdf),
  retrieved 2026-08-13 — records U.S. practice as a fixed eight-digit number
  with no ST.13 type or year designation.
- [GitHub Advisory GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8),
  retrieved 2026-08-13 — identifies `nanoid` before 3.3.18 on the v3 line as
  vulnerable and 3.3.18 as the first patched release.

Together these sources disprove a deterministic USPTO-to-ST.13 conversion. The
implemented boundary requires the ST.3 office code for an ST.13 identity,
rejects `US`, and preserves the USPTO representation as its own union member.

## Evidence Rule

Repository line numbers are refreshed at closeout. External claims are
paraphrased and linked to primary sources; no third-party series table is used
as authority.
