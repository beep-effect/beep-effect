# JSDoc lead single source: friction receipts

Receipts recorded while the work happened. Secrets, home paths and machine
identifiers are redacted.

## 2026-11-22: a scratch ts-morph census over 3,839 files grew past 12 GB

- **Doing:** P0 census of leads on annotated schemas, type companions and barrels.
- **Evidence:** one `Project` with `addSourceFileAtPath` plus `removeSourceFile`
  per file ran for more than 10 minutes and reached about 10% of host memory
  before it was stopped; creating a fresh `Project` every 500 files with
  `createSourceFile` finished the same scan in a few minutes.
- **Would have prevented it:** the JSDoc inventory already parses every docgen
  package in under a minute; a `--json` per-export dump from it would have made
  a separate census script unnecessary.

## 2026-11-22: a counted-only JSDoc rule opened 180 packages

- **Doing:** P1, adding `restating-lead` to the JSDoc inventory.
- **Evidence:** first run with the finding inside `countFindings`:
  `packagesNeedingRemediation: 195 > 15 (+180)` and `openExports=8851`. Every
  finding the inventory records also flips the entry to `open`, so a new rule
  cannot start as a measured backlog without growing a tracked total.
- **Would have prevented it:** a documented split in the inventory between
  findings that open an entry and findings that are only counted for the
  ratchet.

## 2026-11-22: changing the inventory needs three reseals

- **Doing:** P1, the same change.
- **Evidence:** `root-tasks-turbo-inputs.test.ts` pins sha256 values of
  `JSDocDocumentationInventory.ts` and `JSDocRatchet.ts`, the new
  `@beep/repo-utils/JSDoc/LeadSource` import staled
  `standards/policy-tools.fingerprint.json` and `turbo.json`
  (`bun run beep lint policy-fingerprint --write`), and every formatter pass
  after a reseal moved the digest again.
- **Would have prevented it:** a `--write` mode on the seal test that
  recomputes the pinned digests after review, as the fingerprint has.

## 2026-11-23: a gate-introducing PR merges green, then main and every sibling go red

- **Doing:** P1 wave 2, when main turned red on the gate #3496 introduced.
- **Evidence:** twice in one day.
  - The comment law (#3483) turned blocking while #3458 was in flight, so
    Repo Sanity went red on main until #3495 landed.
  - #3496 measured `restating-lead` at its branch base (0e305a468a0), but
    #3439 and #3493 merged before it and added 32 restating leads. Main then
    failed `quality:jsdoc-ratchet:regenerated` with
    `restating-lead: 8758 > 8726 (+32)`, and #3449, #3498, #3500 and #3501
    went red on the same line.
  - Each PR passed its own gates against its own base. Nothing re-measured the
    new gate against the merge ref at the moment of merge.
  - The JSDoc ratchet does not run on pushes to main, so main never went red
    itself. The drift surfaced only on the next PR's merge ref, and every
    sibling that merged main inherited it.
- **Would have prevented it:** a PR that adds or tightens a ratcheted total
  re-runs that gate on the up-to-date merge ref inside the merge gate (or a
  merge queue). The PR then lands with a baseline measured on the tree it
  actually merges into, rather than on its branch base.
