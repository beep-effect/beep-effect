# Eyecite Data Audit

Date: 2026-07-25

This audit answers which parts of the local eyecite implementations are useful
for the court/reporter ingestion substrate. Production data authority is the
pinned Free Law Project repositories, not either local port.

## Repositories inspected

| Repository | Inspected revision | Relevant data shape |
| --- | --- | --- |
| `/home/elpresidank/YeeBois/dev/eyecite-js` | `53a49f2412da668aaf262e5f92584c2c3781043b` (2025-08-21) | seven JSON datasets under `src/data/` |
| `/home/elpresidank/YeeBois/research/law_stuff/repos/eyecite-ts` | `34133d03143ea65861f48a5ed0eb32c931581666` (2026-07-04) | one reporter JSON plus generated TypeScript packaging |

## eyecite-js findings

`src/data/` contains courts, reporters, case-name abbreviations, state
abbreviations, journals, laws, and regex fragments. Its data index demonstrates
the consumer-facing grouping we need to preserve internally.

Its refresh script is not a safe source pipeline:

- it fetches mutable `main` URLs with no commit pin or checksum;
- it downloads only courts, reporters, case-name abbreviations, and state
  abbreviations;
- it overwrites `src/data/index.ts`, dropping the journal, law, and regex
  exports even though those files are used elsewhere;
- it downloads raw templated `courts.json` without courts-db's ordinal,
  variable/place, escaping, or parent-inheritance assembly.

The checkout is also stale/custom relative to the selected pins:

- 2,804 court rows versus 2,809 assembled pinned courts;
- 1,232 reporter keys versus 1,236 pinned keys;
- missing `Arizona Cases Digest`, `Tex. Bus.`, `VI Super`, and `Vt. Super.`;
- locally changed law/regex data and a `Distribuor` case-name expansion typo.

Disposition: retain the seven-dataset inventory as research evidence. Do not
copy its data or refresh implementation.

## eyecite-ts findings

This checkout is newer and its generator demonstrates a useful packaging
property: a large JSON payload can be moved into a generated TypeScript module
instead of becoming a raw runtime file dependency.

It is still not an authoritative data sync:

- only `data/reporters.json` is present;
- `scripts/generate-reporters-data.ts` reads that local file and performs no
  upstream acquisition, pin, checksum, or provenance capture;
- the data has 1,235 keys, includes local variation changes, and is missing the
  pinned `VI Super` reporter key;
- its generated module uses native `JSON.parse`, which is replaced here by the
  repository's Effect Schema JSON codec.

Disposition: reuse only the packaging idea. Do not import its reporter overlay,
types, or native JSON decoder.

## Authoritative mapping

| Internal artifact | Pinned upstream input |
| --- | --- |
| `courts.ts`, `courts-db.data.json` | courts-db `courts.json`, `variables.json`, 28 place files, and `utils.py` ordinal data |
| `reporters.ts` | reporters-db `reporters.json` |
| `case-name-abbreviations.ts` | reporters-db `case_name_abbreviations.json` |
| `journals.ts` | reporters-db `journals.json` |
| `laws.ts` | reporters-db `laws.json` |
| `regexes.ts` | reporters-db `regexes.json` |
| `state-abbreviations.ts` | reporters-db `state_abbreviations.json` |

The selected pins, archive digests, and exact emitted counts are recorded in
[`SOURCES.md`](./SOURCES.md) and generated sidecars.
