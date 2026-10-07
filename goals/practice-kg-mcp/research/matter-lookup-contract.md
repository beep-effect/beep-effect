# Matter-lookup contract

Stable surface for services that must turn a reference found in mail or a
document into a practice matter (docket intake, email tagging, Box filing).
Normative decision: `SPEC.md` D-12. This contract is versioned by the bundle's
`schemaVersion.duckdb` (`4`); a breaking change bumps it. Version 3 added
`client_name` to `matters` and two attribution sources (D-21); version 4 added
the correspondent tables and `kg_correspondent_lookup` (D-24).

## What a matter is

A matter is one **client-keyed docket family**: `<client>.<family>`, for
example `12345.10008`. Its dockets are the country stages filed under it
(`12345.10008US01`, `12345.10008EP02`). The bare family number alone is **not**
a matter: several clients can share one, and the build keeps them apart.

## Three ways to call it

| Caller | Use | Where |
| --- | --- | --- |
| Effect service in this repo | `PracticeKgMatterLookup` service, `PracticeKgMatterLookupLive` layer | `@beep/law-practice-server` |
| Any MCP client | tool `kg_matter_lookup` (`reference`, optional `budgetBytes`) | the `practice-kg-mcp` host |
| Anything that reads DuckDB | tables `matters` and `matter_dockets` | `<bundle>/practice.duckdb` |

Request and result schemas, the `PracticeKgMatterMatchedOn` and
`PracticeKgMatterResolution` literal domains, and the pure helper
`extractPracticeKgReferences(text)` live in
`@beep/law-practice-use-cases/server` (`PracticeKg.matter-lookup.ts`).

### Service wiring

```ts
import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb"
import { PracticeKgBundle, PracticeKgMatterLookup, PracticeKgMatterLookupLive } from "@beep/law-practice-server"
import { PracticeKgMatterLookupRequest, extractPracticeKgReferences } from "@beep/law-practice-use-cases/server"
import { Effect, Layer } from "effect"

// bundleContext: decode <bundle>/bundle.manifest.json with PracticeKgBundleManifest
const matters = PracticeKgMatterLookupLive.pipe(
  Layer.provide(
    DuckDb.makeNodeLayer(
      DuckDbConnectionOptions.make({
        databaseOptions: { access_mode: "READ_ONLY" },
        databasePath: `${bundleDir}/practice.duckdb`
      })
    )
  ),
  Layer.provide(Layer.succeed(PracticeKgBundle, PracticeKgBundle.of(bundleContext)))
)

const tag = Effect.gen(function* () {
  const lookup = yield* PracticeKgMatterLookup
  return yield* Effect.forEach(extractPracticeKgReferences(subjectAndBody), (reference) =>
    lookup.lookup(PracticeKgMatterLookupRequest.make({ reference }))
  )
})
```

**Process rule:** open `practice.duckdb` **read-only**. DuckDB allows any
number of read-only processes on one file. Never open the bundle's `kg.pglite`
from a service: PGlite is single-process, and the MCP host owns it.

## Input

One `reference` string, as it appears in the source. Case and whitespace do
not matter.

| Form | Example | Matches |
| --- | --- | --- |
| client-keyed docket | `12345.10008US01` | that docket (`docket-key`) |
| bare docket | `10008US01` | every docket with that code (`docket`) |
| client-keyed family | `12345.10008` | that matter (`family-key`) |
| bare family | `10008` | every matter sharing the number (`family`) |
| USPTO application | `14/783,547`, `14783547` | the docket it was filed from (`application`) |
| USPTO patent | `US 10,252,356 B2`, `10252356` | the docket it granted from (`patent`) |
| client number | `12345` | every matter of that client (`client`) |

If nothing matches exactly and the reference is shaped like a docket, the
lookup falls back to that docket's family, so a new country stage of a known
matter still resolves; the returned dockets then all have `matched: false`.

`extractPracticeKgReferences(text)` finds dockets (both forms), applications
written `NN/NNN,NNN`, and patents written with comma groups. It ignores bare
digit runs on purpose. Dockets are recognised for every country stage the
practice files in (US, WO, EP, CA, AU, CN, JP, PCT, BR, ZA, UA, AR, EA, IN, IL,
GB, DE, RU, KR, ID, NZ, MX), with an optional national-phase suffix such as
`-CA1`.

### File paths from the attorney's folders

His folders are laid out
`<client name> <client number>/<docket> - <client number>.<0NNNN>/...`.
`extractPracticeKgPathEvidence(path)` returns:

- `clientNumber` — the five-digit number that ends a folder name, or null.
- `dockets` — bare dockets named by the folders (the file name is read only
  when no folder names one).
- `familyKeys` — `<client>.<family>` keys to look up: from a client-keyed
  docket in the path if there is one, otherwise client folder plus docket.
- `attorneyMatterNumbers` — the dotted `<client>.<0NNNN>` folder suffix.

**The dotted suffix is not a matter key.** It is the attorney's own per-client
matter sequence. Never pass it to the lookup as a family and never store it as
`family_key`; keep it as its own field.

## Output

`PracticeKgMatterLookupResult`:

- `resolution` — `unique` (exactly one matter), `ambiguous` (several), `none`.
- `matters[]` — `familyKey`, `family`, `client` (null for the unattributed
  remainder), `clientName` (see below), `attributionSource`,
  `epistemicStatus`, `docketCount`,
  `documentCount`, `matchedOn[]`, and `dockets[]` (`docketKey`, `docket`,
  `applicationNumbers[]`, `patentNumbers[]`, `documentCount`,
  `epistemicStatus`, `matched`).
- `bundleVersion`, `reference`.

The MCP tool returns the same data as one row per docket. `clientName` is in
its balanced and complete tiers.

### Client name

`clientName` is the name the attorney's docket register gives the matter's
client number. It is null when the register does not list the client, lists it
without a name, or lists it under more than one name. `client` stays the key:
file and tag by the number, and show the name only as a label.

### Attribution source

`attributionSource` says why a matter has its client. From strongest to
weakest:

| Source | Meaning |
| --- | --- |
| `folder-path` | the attorney's folder path names one client for the docket |
| `text-reference` | the document's text names one `<client>.<docket>` for its family |
| `client-map` | the organizer's source-label map |
| `family-consensus` | every document of the family with one of the first two agrees |
| `docket-register` | no document of the family has folder or text evidence, and the docket register lists exactly one client for the docket |
| `filename`, `restored-name` | no client evidence; the matter is the bare family |

The register is last on purpose: bare docket codes are reused across clients
and the register lists only current dockets, so it never overrides what a
document says about itself. A docket the register lists under two clients, or
a path that names two dockets, is ambiguous and is not used.

## Rules for callers

1. Act without a person only on `resolution: unique`.
2. Even when unique, send to a person when `client` is null (unattributed
   family) or `epistemicStatus` is `recycled-unverified` (the matter rests on a
   recycle-bin restore stub).
3. `ambiguous` and `none` are answers, not errors. Show the candidates; never
   pick one.
4. Application and patent numbers match only **membership** (filed from one of
   the matter's dockets). A number that a matter's documents merely cite is not
   returned here; `kg_application_lookup` shows those as `mentioned_in_family`.
   Membership is `filename` or `text-reference` when every citing document sits
   in the matter, and `mention-dominance` (D-23) when the matter holds at least
   3 citing documents and at least 80% of them, and no file name elsewhere
   carries the number. A dominance member still resolves `unique`; act on
   `unique` only, exactly as before, and treat `mention-dominance` as the
   reason to show the other citing matters to a person when the stakes call
   for it.
5. The bundle is a snapshot of the corpus at `corpusSnapshotAt`. A matter opened
   after that date returns `none` until the bundle is rebuilt.

## Correspondent lookup

Turns an email address from a From, To, or Cc header into the matters it
writes about. Normative decision: `SPEC.md` D-24.

| Caller | Use | Where |
| --- | --- | --- |
| Effect code in this repo | `lookupPracticeKgCorrespondents({ address })` over the bundle DuckDB and `PracticeKgBundle` | `@beep/law-practice-server` |
| Any MCP client | tool `kg_correspondent_lookup` (`address`, optional `budgetBytes`) | the `practice-kg-mcp` host |
| Anything that reads DuckDB | `matter_correspondents`, `contact_client_links`, `contact_addresses` | `<bundle>/practice.duckdb` |

Request, result, and decision schemas, the link-source domain
(`PracticeKgContactLinkSource`, split into `PracticeKgAttorneyLinkSource` and
`PracticeKgInferredLinkSource`), and the pure `resolvePracticeKgCorrespondent`
live in `@beep/law-practice-use-cases/server`
(`PracticeKg.correspondent-lookup.ts`).

**Evidence ladder.** The attorney's own links for a contact
(`attorney-answer`, `attorney-pc-folder`, `attorney-docket-sheet`,
`attorney-filed-email`) outrank everything. Message counts from filed email
and from archive mail placed by its subject line (D-26, `subject-reference`:
the subject names exactly one of the bundle's matters), and the inferred
links `org-name-match` and `email-subject-ref`, rank candidates for a person
and never decide.

**Resolution.**

- `unique` only when the address belongs to exactly one contact, the contact
  is not a role mailbox, the address is not on a practice domain, and every
  attorney-sourced link of the contact names the same client-keyed matter: a
  family key that starts with the link's own client number and is one of the
  bundle's `matters`. The attorney's `<client>.<0NNNN>` matter numbers have
  the same dotted shape and never qualify (D-20). `familyKey` is that matter.
- `ambiguous` whenever there is any candidate or link but no unique answer.
- `none` when the address appears nowhere.

**Input.** `address` is a bare address or one header entry
(`Pat Example <pat@example.com>`), read with the build's own header parser.
Input holding no address or several (a whole header) fails with reason
`invalid-input`; look each address up on its own.

The tool returns one row per matter the address is tied to: the filed-mail
candidates (by message count, then most recent message), then matters and
clients named only by contact links, with message counts zero. On a `unique`
lookup the decided row comes first, carries `decided: true` and is the only
row whose `resolution` is `unique`; every other row says `candidate`. Rows of
an `ambiguous` or `none` lookup carry that resolution. `decided` is in every
field tier, so a budget that keeps one row keeps the decided one, and the
note names the decided matter.

**Rules for callers.** Act on `unique` only. A role mailbox (`docketing@`,
`info@`) and the practice's own addresses never resolve uniquely however many
messages they carry; show their candidates instead.

## Where unresolved files go in Box

The Box workstream files by `family_key`. A file whose reference does not
resolve `unique`, or resolves to a matter with no client or with
`recycled-unverified` status, is never auto-filed:

- unresolved docket files: `03 Historical Files To Be Filed/Dockets To Be Confirmed/<family>/<docket>/`
- other unresolved files: `03 Historical Files To Be Filed/<original layout>/`

Use these names when describing the outcome to the attorney. When a new bundle
version adds matters, Box re-runs its map and moves files; nothing is
re-uploaded.

## Table shapes

```
matters(
  family_key VARCHAR PRIMARY KEY,   -- "12345.10008", or bare "10008" when unattributed
  family VARCHAR NOT NULL,          -- bare family number
  client VARCHAR,                   -- null when unattributed
  client_name VARCHAR,              -- from the docket register; null when it gives no single name
  attribution_source VARCHAR NOT NULL,
  epistemic_status VARCHAR NOT NULL,
  docket_count BIGINT NOT NULL,
  document_count BIGINT NOT NULL
)
matter_dockets(
  docket_key VARCHAR PRIMARY KEY,   -- "12345.10008US01"
  docket VARCHAR NOT NULL,          -- "10008US01"
  family_key VARCHAR NOT NULL,      -- -> matters.family_key
  epistemic_status VARCHAR NOT NULL,
  document_count BIGINT NOT NULL,
  application_numbers VARCHAR[] NOT NULL,   -- digits only
  patent_numbers VARCHAR[] NOT NULL         -- digits only
)
matter_correspondents(              -- one row per matter and address in filed email
  family_key VARCHAR NOT NULL,      -- -> matters.family_key
  address VARCHAR NOT NULL,         -- lower-cased
  contact_id VARCHAR,               -- when exactly one contact owns the address
  display_name VARCHAR,             -- contact's name, else the first header name
  role_address BOOLEAN NOT NULL,
  is_practice_address BOOLEAN NOT NULL,   -- on a --practice-domain
  message_count BIGINT NOT NULL,    -- distinct email documents
  from_count BIGINT NOT NULL,
  to_count BIGINT NOT NULL,
  cc_count BIGINT NOT NULL,
  first_at VARCHAR,                 -- dcterms:created, earliest
  last_at VARCHAR,                  -- dcterms:created, latest
  epistemic_status VARCHAR NOT NULL,      -- always mention-derived
  PRIMARY KEY (family_key, address)
)
contact_client_links(               -- the contacts table's links, verbatim
  contact_id VARCHAR NOT NULL,
  client_number VARCHAR NOT NULL,
  family_key VARCHAR,
  source VARCHAR NOT NULL,          -- PracticeKgContactLinkSource
  evidence VARCHAR NOT NULL         -- opaque producer note
)
contact_addresses(                  -- which contact owns an address
  address VARCHAR NOT NULL,
  contact_id VARCHAR NOT NULL,
  display_name VARCHAR NOT NULL,
  organization VARCHAR,
  role_address BOOLEAN NOT NULL,
  is_practice_address BOOLEAN NOT NULL,
  PRIMARY KEY (address, contact_id)
)
```

## Where the bundle is

This contract describes store format pglite 4 / duckdb 4, which the build
writes from bundle version `2026-10-07-01` on; extension `0.4.0` reads it and
refuses format 3 and older by name. The current bundle is `2026-10-07-03`
(`<corpus>/staging/practice-kg-bundle-2026-10-07-03`, archive mail in the
correspondent tables, D-26, each message counted once, D-27);
`2026-10-07-02` (the same without D-27) and `2026-10-07-01` stay on disk
beside it. The
last format 3 bundle is
`<corpus>/staging/practice-kg-bundle-2026-10-06-03`; `practice-kg-bundle-p9`
is `2026-10-06-02` (same matters, fewer documents with text, and a wrong
`run_label` on documents that exist in two runs). The bundle at
`<corpus>/staging/practice-kg-bundle-p6` is the older `2026-10-06-01` (format
2); the current host refuses it by name. Name a rebuilt bundle with
`--bundle-version <version>`. Rebuild with
`bun run apps/practice-kg-mcp/src/build.ts --corpus-root <corpus> --bundle-out <dir> --overwrite`,
adding `--include-run <label>` for each later source run and
`--docket-register <file>` for the register, `--contacts <file>`,
`--practice-domain <domain>` and `--mail-index <file>` for the correspondent
tables (see
`bundle-contract.md` §5).
Carry claims with `claims.ts --carry-from <old bundle>`, and prove the result
with `verify.ts --bundle-dir <dir> --compare-to <old bundle>`: it prints the
verification summary, then the matter-table diff (matters and dockets added
and removed, application and patent numbers added and removed per docket),
and exits non-zero when a row does not resolve or when the old bundle had a
matter, a docket, or a number the new one lacks (D-25).
