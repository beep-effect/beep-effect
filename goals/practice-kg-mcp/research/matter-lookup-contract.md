# Matter-lookup contract

Stable surface for services that must turn a reference found in mail or a
document into a practice matter (docket intake, email tagging, Box filing).
Normative decision: `SPEC.md` D-12. This contract is versioned by the bundle's
`schemaVersion.duckdb` (`2`); a breaking change bumps it.

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
digit runs on purpose.

## Output

`PracticeKgMatterLookupResult`:

- `resolution` — `unique` (exactly one matter), `ambiguous` (several), `none`.
- `matters[]` — `familyKey`, `family`, `client` (null for the unattributed
  remainder), `attributionSource`, `epistemicStatus`, `docketCount`,
  `documentCount`, `matchedOn[]`, and `dockets[]` (`docketKey`, `docket`,
  `applicationNumbers[]`, `patentNumbers[]`, `documentCount`,
  `epistemicStatus`, `matched`).
- `bundleVersion`, `reference`.

The MCP tool returns the same data as one row per docket.

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
5. The bundle is a snapshot of the corpus at `corpusSnapshotAt`. A matter opened
   after that date returns `none` until the bundle is rebuilt.

## Table shapes

```
matters(
  family_key VARCHAR PRIMARY KEY,   -- "12345.10008", or bare "10008" when unattributed
  family VARCHAR NOT NULL,          -- bare family number
  client VARCHAR,                   -- null when unattributed
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
```

## Where the bundle is

On the workstation: `<corpus>/staging/practice-kg-bundle-p6` (bundle version
`2026-10-06-01`, store format pglite 2 / duckdb 2). Rebuild with
`bun run apps/practice-kg-mcp/src/build.ts --corpus-root <corpus> --bundle-out <dir> --overwrite`,
carry claims with `claims.ts --carry-from <old bundle>`, and prove it with
`verify.ts --bundle-dir <dir>`.
