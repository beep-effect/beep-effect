# Instance

- id: `r3-arch-ecosystem-internal-pg-timestamp-timezone`
- exact source SHA: `f137beedb270a071d4aa2ecc1dd52a9d233044d1`
- file:line: `packages/ecosystem/effect-drizzle/src/pg/Column.ts:222`
- symbol: `SpecDefinition.timestamp` / `Timestamp`
- members: `ident`, `withTimezone`
- status: P2 refreshed; independent P3 review and implementation are outstanding.

# Current shape and evidence

`SpecDefinition.timestamp` stores `ident: "timestamp" | "timestamptz"`,
`mode: "date" | "string"`, and `withTimezone: boolean` at `Column.ts:219-225`.
`Timestamp<Mode, Timezone>` refines that descriptor at `Column.ts:416-423`,
but its default boolean instantiation still admits the product of identities
and booleans. The constructor's broad implementation accepts that product,
then rejects disagreement (`Column.ts:852-867`).

- E3: `Column.ts:862-864` derives expected identity from the flag and rejects
  disagreement. The flag duplicates the semantic identity.
- E1: `pg/combinators.ts:1011-1016` sets identity and flag from one option.
- E2: `Column.ts:983` accepts the timestamp member only when identity agrees
  with the flag, after checking presence and boolean type.

# Cardinality gap

The projected pair has four representable states and two legal states:
`timestamp/false` and `timestamptz/true`. Both modes are independently legal
for each pair; including mode would give eight representable and four legal
states. The inventory deliberately counts only the correlated pair (4/2).
This stored descriptor is internal decoded metadata. The public function flag
is excluded from campaign scope; Drizzle's own flag is an external contract
(D2 boundary), not an eradication target.

# Target schema and type owner

Reuse `SpecDefinition.timestamp["ident"]` as the sole timestamp timezone
owner. Delete `withTimezone` from that member. Refine `Timestamp` using a
second generic constrained to that existing identity type, defaulting to its
whole two-member domain, and retain the existing first `Mode` generic. Derive
identity constraints by indexing the existing spec; do not add a parallel
literal domain, standalone boolean alias, or duplicate `LiteralKit`.

This ecosystem package forbids runtime `@beep/*` imports and dependencies
(`packages/ecosystem/AGENTS.md`, architecture `14-ecosystem-packages.md`).
It already uses Effect `TaggedEnum`/`taggedEnum` for its descriptor algebra.
Reuse that algebra instead of importing `@beep/schema` or converting the
entire descriptor family as part of this instance. `targetShape: literalkit`
denotes reuse of the existing named literal owner, not a new kit dependency.

The constructor accepts only identity and mode, produces the existing
`_tag: "timestamp"`, `dialect: "pg"`, and `kind: "timestamp"`, and has no
identity/flag coherence check. `toDrizzleBuilder` projects
`ident === "timestamptz"` to Drizzle's required boolean at its call boundary.
It still chooses date versus string builder from mode. The projected boolean
may exist as an ephemeral call argument; it must not be stored in metadata.

Keep `timestamp`'s public overloads, optional `withTimezone?: TZ`, and generic
`TZ extends boolean = true`. Their result maps `TZ` once to the new identity
generic through the distributive mapping `TZ extends true ? "timestamptz" :
"timestamp"`. A widened boolean therefore yields the identity union; a
literal false or true remains precise. Do not widen all overload results to
the whole domain. Omitted timezone stays true/timestamptz; omitted mode stays
string. Drizzle itself defaults timezone to false, so omitting the projected
argument would silently change behavior and is forbidden.

# Migration inventory

All paths below are under `packages/ecosystem/effect-drizzle/`.

- `src/pg/Column.ts:219-225`: remove the descriptor field.
- `src/pg/Column.ts:416-423`: migrate the exported decoded second generic from
  boolean timezone to identity, preserving mode and default union inference.
- `src/pg/Column.ts:852-867`: replace constructor overload/implementation with
  the identity-owned input; remove expected-identity computation and throw.
- `src/pg/Column.ts:875-883`: project the identity at the Drizzle call boundary.
- `src/pg/Column.ts:927-987`: retain all shared descriptor checks and mode
  membership. Replace the timestamp-specific flag presence/type/equality
  conjunction with explicit identity membership in timestamp/timestamptz.
  **Do not merely delete the conjunction:** the shared precheck only proves
  `ident` is a string. An arbitrary string must continue to fail.
- `src/pg/Column.ts:1041`: existing timestamp compiler dispatch remains valid.
- `src/pg/Column.ts:1205-1209` and `src/pg/table.ts:135-138`: verify mode-only
  inference and Date/string builder selection under the new default second
  generic. These sites may need no textual edit; they are mandatory type
  consumers, not a reason to invent unnecessary changes.
- `src/pg/combinators.ts:997-1020`: preserve public arguments and defaults,
  map generic result identity, construct only identity/mode metadata.
- `src/pg/combinators.ts:1470-1472,1498-1506`: retain `defaultNow` timestamp
  eligibility and default metadata under the new generic.
- `src/pg/index.ts:46`: keep the consumer type export and regenerate its
  declaration/docs. No compatibility alias is needed by observed consumers.
- `typetests/contracts.tst.ts:143,379-384`: preserve the public mode assertion
  and encoded-carrier/defaultNow errors; extend inference coverage below.
- `test/fixtures.ts:58-59,493`, `test/perf.consumer.ts:21-22,60`, and
  `test/sqlite-fixtures.ts:117-118`: retain existing PG timestamp fixtures,
  including PG fixtures appearing in the SQLite test file.
- `test/unit.test.ts:264-270,358-369`: strengthen exact SQL timezone assertions
  and retain injected timestamp metadata. Existing substring SQL assertion is
  insufficient to distinguish the two identities.
- `test/import-boundary.test.ts:187`: retain consumer-bundle absence of the
  old mismatch error, alongside ecosystem dependency/import-DAG checks.
- Generated README timestamp signatures currently at 1308,2477,4829-4835
  must reflect regenerated declarations; do not hand-edit generated signatures.

Repository source search found no other consumer of this descriptor's
`withTimezone` field or explicit boolean second generic. Direct Drizzle
`timestamp(..., { withTimezone: true })` calls in architecture-lab tables are
upstream API usage and remain unchanged. Other `Timestamp` symbols in
foundation modeling are unrelated owners.

# Guard-deletion accounting

Delete the `makeTimestamp` expected-identity branch and mismatch error;
delete `isSpec`'s timestamp flag presence and boolean checks and its
identity/flag equality; delete the stored field and its constructor writer
and adapter reader. Keep identity and mode validity checks, all unrelated
isSpec checks, mode dispatch, and the public option defaulting logic.
`isBoolean` remains needed by `fromLiteralAST` at `Column.ts:994` and must not
be removed from imports merely because the timestamp use disappears.
No legacy normalizer or comment-only coherence invariant was found here.

# Encoded-side impact

No descriptor codec or persisted descriptor representation was found in this
consumer family. SQL type strings, installed Drizzle codec selection, encoded
Date/string carriers, column names, defaults, metadata kind, and downstream
DDL behavior must be preserved. Drizzle's stored/wire-facing boolean is
untouched and projected only at the adapter boundary.

`Timestamp<Mode, boolean>` becoming `Timestamp<Mode, Identity>` is an
intentional exported decoded TypeScript shape migration, permitted by the
campaign's decoded-shape rider. It is **not** source-compatible for an
external consumer explicitly supplying a boolean second argument or reading
removed metadata. Public `timestamp({ withTimezone })` calls stay compatible.
Migrate every known in-repo consumer atomically; update docs and apply the
actual release/changeset policy when implementing. Do not invent a perpetual
boolean compatibility alias or claim private-package status alone proves no
public API impact.

# Test impact and bounded evidence

A read-only P2 probe against the current implementation checked all eight
identity/flag/mode combinations: four legal and four rejected. Nine public
combinator cases (omitted/date/string mode × omitted/false/true timezone)
confirmed descriptor identity and installed builder mode/timezone defaults.
These are baseline observations, not tests of an implemented replacement.

Implementation verification must include:

- both identities and modes through the constructor, unknown-input guard,
  public combinator, and actual built table; exact SQL type, codec and carrier
  behavior, including defaultNow and existing integration DDL regeneration;
- guard rejection of invalid identity/mode and malformed outer descriptors,
  acceptance of each legal descriptor without the removed field;
- type assertions for omitted/true/false/widened timezone, string/date mode,
  identity-union default, Date/string `CarrierOf` and table builder selection;
- existing negative encoded-carrier/defaultNow tests, public import-boundary,
  bundle-size and fixtures, regenerated documentation;
- full `bun run beep quality package-verify @beep/effect-drizzle` and the
  applicable Yeet proof before publication.

# Risk and sequencing

Tier 1, stored/internal. Land descriptor, constructor, guard, combinator
return types, adapter projection, and type tests atomically after GATE 2.
Primary risks are weakened unknown-input identity validation, widened generic
inference, and accidental adoption of upstream Drizzle's false timezone
default. No product source is changed by this P2 refresh; P3 remains required.
