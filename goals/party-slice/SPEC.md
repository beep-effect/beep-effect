# Party Slice Spec

## Objective

Graduate the scratchpad party model (`scratchpad/party`) into a domain-agnostic product slice,
`packages/party/{domain,use-cases,server}`. The slice covers persons, organizations and collective agents,
their identifiers, accounts and voices, evidence-gated claims, identity resolution, admission tiers and
the reviewer loop. Claims bind the `@beep/epistemics` `makeClaimEnvelope` and the P1b factories to party
propositions and ids. Governing decision: `standards/architecture/DECISIONS.md` "2026-10-21: Epistemic
Vocabulary Is Foundation; Party Is A Product Slice; Propositions Are Slice-Owned", with its 2026-10-22
amendment.

## Non-Goals

- `@beep/party-tables` and any Postgres persistence. The first goal ships a memory ledger; durable
  storage is a later goal, once the adapters have exercised the row shape.
- client, ui or config packages, and the review page (`scratchpad/party/scripts/ReviewPage.ts`). That stays
  a scratchpad tool.
- Projecting party claims into the epistemic slice's edge authority. If wanted, that is a later
  cross-slice workflow (`10-cross-slice-coordination.md`).
- Moving law-practice's contact, client or matter vocabulary into party.
- Any corpus data. Fixtures stay synthetic; the private corpus (`$HOME/data-home/oppold-corpus`) is never
  committed or copied into tests.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Module Placement (P0, 2026-10-22)

| Scratchpad module | Home | Notes |
| --- | --- | --- |
| `Ids.ts` | `PartyId` from `@beep/shared-domain/identity/Party` (integer surrogate, #2025); the deterministic `PartyKey` and the other party ids in `@beep/party-domain` | the scratchpad's evidence-minted `party:` strings become `PartyKey`s. A `KeyAssignment` claim maps a `PartyKey` to a `PartyId`, and `SameParty` redirects the absorbed party's keys to the surviving id (Decision Log) |
| `Party.ts`, `Communication.ts`, `Provenance.ts` | `@beep/party-domain` | parties, identifiers, accounts, voices, evidence anchors, collection sides |
| `Proposition.ts` | `@beep/party-domain` | the slice-owned proposition union (`IdentifierOf`, `SameParty`, `DistinctParty`, `Membership`, `ReportsTo`, `VoiceAuthor`, ...) |
| `Claim.ts` | `@beep/party-domain` | `makeClaimEnvelope({ $I, proposition, logicalKey, ids })`; party owns the stable, unambiguous key function for its proposition union; the scratchpad mirror of evidence-signals is deleted |
| `Time.ts` | removed | `@beep/epistemics` `ValidTime` / `KnowledgeInterval` (epoch millis) replace the string `UtcInstant` |
| `Admission.ts`, `Hierarchy.ts`, `Resolution.ts`, `Projection.ts` | `@beep/party-domain` | pure behavior: admission proofs, declared vs operational hierarchy, `effect/Graph` resolution, projections |
| `Ledger.ts` | port in `@beep/party-use-cases`; `PartyLedgerMemory` in `@beep/party-server` | append-only bitemporal ledger, a `Context.Service` port |
| `adapters/MailIndex.ts`, `MailCensus.ts`, `IdentityEvidence.ts`, `OrgEvidence.ts`, `ReviewLoop.ts` | `@beep/party-server` | generic ingestion over the mail drivers (`libpff`, `m365`) |
| `adapters/ContactEvidence.ts` | split | the generic contact-card path goes to `@beep/party-server`; the law-practice `contacts-kg` / client-number path stays in law-practice and feeds party through a `@beep/party-use-cases` port |
| law-practice `entities/Party` (`Party extends ProductEntity.Entity(PartyId)`) | renamed `LegalPartyReference` in `@beep/law-practice-domain` | party owns party identity and resolution; law-practice keeps a role-player reference record keyed by the shared `PartyId` (Decision Log) |
| `scripts/*`, `fixtures/acme.ts` | scripts stay in scratchpad; fixtures move to `@beep/party-domain/test` | fixtures stay fully synthetic |

## Target Surfaces

- New `packages/party/domain`, `packages/party/use-cases`, `packages/party/server`, created only with
  `bun run beep create-package`.
- `@beep/law-practice-server`: the contact-source port adapter and its Layer wiring only (bounded exception, see the Exception Ledger).
- `@beep/law-practice-domain`: the `Party` -> `LegalPartyReference` rename and its importers.
- `scratchpad/party`: remove or repoint modules once they have graduated.

## Constraints

- Party never imports law-practice. Only `@beep/law-practice-server` may depend on `@beep/party-use-cases`,
  to implement the contact-source port (bounded exception, see the Exception Ledger). Law-practice
  `domain`, `use-cases` and `tables` never import any `@beep/party-*` package.
- Party claims depend on `@beep/epistemics` only, never on `@beep/epistemic-domain` or other epistemic
  product code.
- Schema-first, then `Context.Service` contracts, then implementation. Effect v4 laws: `S.TaggedUnion`;
  `$I.annote` on checks and `.pipe($I.annoteSchema(...))` on schemas; no `as`/`!`; effect collections.
- Before each publish, run the hosted-only gates locally (lessons from #2017):
  - `bun run beep lint schema-catalog --write`
  - root `bun run lint:oxlint`
  - `bun run beep docgen check --package <pkg>`
  - the JSDoc ratchet over a regenerated inventory
  - `bun run audit:github repo-sanity`

  `@category` values come from `JSDocCategories`.
- Push the final head through `yeet publish`, so a publish verdict binds it, and keep the lane's
  `.beep/yeet/runs/<run-id>/verdict.json` for the completion gate.

## Acceptance Criteria

- [x] `@beep/shared-domain/identity/Party` exports `PartyId`; no `LawPractice.PartyId` importer remains
  (separate prerequisite PR).
- [x] `@beep/party-domain`, `@beep/party-use-cases` and `@beep/party-server` exist, created by
  `beep create-package`, with the module placement above.
- [x] Party claims bind `makeClaimEnvelope` and the P1b factories to party ids and supply the slice-owned,
  unambiguous `logicalKey` function for the party proposition union. Tests prove the binding emits
  identifiers distinct from the epistemic slice's and rejects a key inconsistent with its proposition.
- [x] The scratchpad competency tests (identity, admission, hierarchy, ledger, resolution) pass against
  the slice packages on the synthetic fixtures.
- [x] The ingestion adapters run end to end on a synthetic mail index through the memory ledger, and the
  law-practice contact port is implemented in law-practice.
- [x] Law-practice's `Party` aggregate is renamed `LegalPartyReference` (no table, so no migration). No
  second aggregate named `Party` exists outside `@beep/party-domain`.
- [x] All five boundary scans in the Verification Matrix return no matches, and the server boundary
  test passes. `@beep/law-practice-server` is the only law-practice package that imports from party, and it imports `@beep/party-use-cases` and nothing else.
  The contact-source port's input and output types reach it through the use-cases public surface.
- [x] Parties carry an integer `PartyId` plus deterministic `PartyKey`s, and resolution follows the identity
  rules in the Decision Log. Tests cover:
  - the surviving-id choice, and replay producing the same view;
  - an absorbed `PartyId` and its keys resolving to the survivor inside party (a `LegalPartyReference` keeps
    its id; cross-slice resolution is out of scope);
  - the PartyKey v1 fixtures and cross-adapter equality cases below;
  - `DistinctParty` vetoing a merge, including a later veto and equal-time conflicts;
  - a retraction recomputing components: a simple merge splits again, a cycle stays merged through its other
    edges, and a retraction that re-enables a vetoed merge yields the new component.
- [x] `bun run beep quality package-verify` passes for the three party packages.
- [x] No unrelated refactors or formatting churn.

## P1 contract tests (settled for #2045)

These are P1 deliverables, not tests implemented by this docs-only settlement.

### Exact law-practice server boundary

Add a small boundary test under `packages/law-practice/server/test/` that parses module specifiers
in `packages/law-practice/server/src/` (imports, exports, dynamic imports and `require` with literal
arguments). The same test reads `packages/law-practice/server/package.json`: among keys starting
with `@beep/party-` in `dependencies` and `devDependencies`, allow only the exact package name
`@beep/party-use-cases` (manifest keys cannot be subpaths). Reject suffix packages and every other
party package in either dependency section. Cover allowed and forbidden manifest entries with fixtures.
`test/` imports are out of scope: parser fixtures deliberately contain forbidden specifiers, so
scanning the test tree would flag the boundary test itself.
For any party specifier, allow exactly `@beep/party-use-cases` or that name followed by `/` and a
nonempty subpath. Reject every other party package. Fixtures must accept the bare package and
`@beep/party-use-cases/ContactSource`, and reject `@beep/party-use-cases-extra`,
`@beep/party-domain`, and a forbidden import on the same line as an allowed import.
Exercise single and double quotes and multiline declarations; comments do not grant an exception.
The token scan below is a quick diagnostic; the parser test is the authoritative import check.

### PartyKey v1 bytes and adapter equality

`PartyKey` is `pk:v1:` followed by the 64 lowercase hexadecimal digits of SHA-256 over the UTF-8
canonical JSON bytes of one basis object. Both adapters call the same domain canonicalizer.
The basis is exactly `{ "kind": "identifier", "scheme": <kind>, "authority": <namespace>,
"value": <identifier> }`. It identifies an ingestion anchor, not proof that its users are one person.
`KeyAssignment`, accepted identity claims and valid time still determine party resolution; shared
or reassigned addresses never automatically authorize `SameParty`.

- All strings are Unicode NFC. Trim leading/trailing Unicode White_Space from parsed values;
  preserve internal whitespace and case unless a scheme rule below says otherwise. Do not hash
  display names, adapter names, card ids, observation ids, paths, timestamps, source order or claim
  status into an identifier basis. Preserve those on evidence assertions.
- Identifier bases hash the graduated identifier's canonical value, never its `raw` spelling.
  Graduation makes NFC/trim and the scheme rules below shared by identifier deduplication and
  PartyKey generation; neither adapter adds its own case conversion. For variants with a
  `.normalized` field, `value` is exactly that field after the shared normalizer runs.
- Email: parse the mailbox from a header or card before normalization; discard the display-name
  wrapper. `scheme` is `email`, `authority` is the empty string. The graduated `normalizeEmail`
  retains its whole-address lowercase rule, including the local part. It also owns NFC/trim and
  domain conversion with UTS #46 nontransitional processing and STD3 rules to ASCII A-label form;
  lowercase the resulting whole address with locale-independent Unicode lowercase and apply NFC
  again. Store that result in `.normalized` and hash it unchanged. Preserve dots, plus tags and
  internal characters; never apply provider-specific alias rules. Reject invalid domains and
  unparseable mailboxes as data-quality issues; never strip internal whitespace to repair them.
  Thus `Dana@EXAMPLE.test`, `Dana@example.test` and `dana@example.test` all agree in v1.
- Other supported identifiers: use the identifier-kind token as `scheme` and its explicit
  issuer/tenant namespace as `authority` (empty only for a globally scoped kind). Match the
  graduated `identifierKey` rules: ExchangeDn hashes `.normalized` from `normalizeExchangeDn`
  (NFC/trim, locale-independent uppercase, then NFC); Username hashes the lowercase/NFC handle
  with its service as authority; PhoneNumber hashes validated `.e164`, with empty authority.
  NativeAccountId uses its service and `.value`; ExternalId uses its scheme namespace and `.value`.
  Preserve case/internal whitespace in namespaces and native/external values after NFC/trim.
  Require explicit country context when parsing a non-E.164 phone; reject ambiguous numbers.
  Schema validation rejects missing required authority and malformed values. No adapter-specific
  phone, handle or DN rewriting may run after this shared normalization.
- Emit one key per identifier rather than hashing the list of identifiers on a card. A record with
  no usable identifier uses a separate basis `{ "kind": "source-record", "authority": <stable
  source namespace>, "value": <stable native record id> }`, with NFC/trim and case preserved.
  Missing stable namespace/id is a data-quality issue, not a display-name fallback. Such keys have
  no cross-source equality guarantee; grouping different identifiers needs evidence and review.
- Serialize objects with keys sorted lexicographically by Unicode code point, no insignificant
  whitespace or BOM, JSON string escaping for quote, backslash and control characters only, and
  other Unicode characters emitted directly. Use `\b`, `\t`, `\n`, `\f`, `\r` for their named
  controls, `\"` and `\\` for quote and backslash, and lowercase `\u00xx` for remaining U+0000–001F
  controls. Reject unpaired surrogates. There are only string fields: no absent fields, nulls,
  numbers or arrays. For email the byte string is exactly
  `{"authority":"","kind":"identifier","scheme":"email","value":"dana@example.test"}`.
  Hash those bytes without a trailing newline. Decode accepts only `pk:v1:[0-9a-f]{64}` for v1;
  future canonicalization changes require a new version and explicit key-assignment migration.

P1 tests must pin the canonical byte string and independently calculated digest, then prove that a
synthetic mail header `Dana Example <Dana@EXAMPLE.test>` and a contact card containing
` dana@example.test ` yield the same key despite differing metadata. Pin the explicit case fixture:
header `Dana@example.test` versus card `dana@example.test` must have identical `.normalized` values,
canonical bytes and PartyKeys. Include decomposed/composed
Unicode local parts, Unicode/A-label equivalent domains, reordered input object fields, changed
metadata, equivalent local-part case, distinct plus tags, uppercase/lowercase Exchange DN inputs,
case-varied Username handles within one service, and equivalent phones yielding the same E.164 value.
Assert that changing a required service/issuer namespace changes the key. Invalid email, missing
authority, ambiguous phone numbers, and identifier-free
records exercise the issue/fallback paths. Replay and adapter input ordering must not change keys.

### DistinctParty scope, order and contradictions

For each valid-time/knowledge-time query, select the effective accepted versions first (including
retractions and supersessions). Collect all active `DistinctParty` pairs as cannot-link constraints,
then replay active `SameParty` candidates in ascending `(recordedAt, ClaimVersion id)` order.
Compare timestamps numerically and ids lexicographically by Unicode code point, independent of
locale or input iteration order. A merge is blocked if any veto crosses its two current components.
All vetoes apply before all merges, even if the veto was recorded later; at equal knowledge time
`DistinctParty` therefore wins regardless of ids. Within each kind the same timestamp/id ordering
makes diagnostics deterministic. The survivor remains the smallest integer `PartyId`.

A later active veto recomputes the entire view and can split an existing component. Historical
queries before that veto still reproduce the old merge. Do not remove one arbitrary edge from a
persisted component or mutate claims/keys/references. A blocked `SameParty` produces a
`conflicting-review` case containing the blocked claim-version id, veto claim-version ids, endpoint
ids and query scope, in deterministic order. Keep both assertions for review; neither is silently
retracted. Recompute cases with the view so resolved contradictions do not stay active.

P1 synthetic acceptance tests (assert components, survivors, key redirects and review cases):

| Scenario | Expected view |
| --- | --- |
| Simple retraction: `SameParty(1,2)` then retract it | `{1}`, `{2}`; each original key resolves to its own id |
| Cycle: `(1,2)`, `(2,3)`, `(1,3)` accepted; retract `(1,2)` | `{1,2,3}` still resolves to 1 through the other two edges |
| Re-enabled merge: active veto `(1,3)`, ordered merges `(1,2)` then `(2,3)` | Initially `{1,2}`, `{3}` with `(2,3)` in review; retract `(1,2)` and obtain `{1}`, `{2,3}` with survivor 2 and no blocked-merge case |
| Late veto: merge `(1,2)` at t1, veto `(1,2)` at t2 | At t1 `{1,2}`; at t2 `{1}`, `{2}` and a contradiction case; retract veto at t3 and merge again |
| Equal time: conflicting merge/veto `(1,2)` share `recordedAt` | Separate components and the same review case for both id orderings and shuffled input |
| Equal-time competing merges: veto `(1,3)`, merges `(1,2)` and `(2,3)` | Lexicographically earlier merge id wins; later merge is blocked; shuffled input yields identical output |
| Veto re-enabled: supersede/retract a veto's retraction so veto is active again | Recomputed components split again, contradiction case returns, and earlier knowledge snapshots remain unchanged |

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/party-slice/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/party-slice/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/party-slice` | Passes |
| Party packages | `bun run beep quality package-verify @beep/party-domain` (and use-cases, server) | Passes |
| Hosted-only gates | `beep lint schema-catalog`, root `lint:oxlint`, `beep docgen check`, the JSDoc ratchet over a regenerated inventory, `audit:github repo-sanity` | Pass locally before publish |
| Boundary: law-practice | `rg -n '@beep/law-practice' packages/party` | No matches |
| Boundary: law-practice server | `rg --no-filename -o '@beep/party-[A-Za-z0-9_./-]+' packages/law-practice/server/src \| rg -v '^@beep/party-use-cases(/[A-Za-z0-9_./-]+)?$'`; P1 parser boundary test above | No matches |
| Boundary: server manifest | `jq -r '((.dependencies // {}) + (.devDependencies // {})) \| keys[] \| select(startswith("@beep/party-")) \| select(. != "@beep/party-use-cases")' packages/law-practice/server/package.json`; P1 manifest boundary test above | No matches |
| Boundary: law-practice tiers | `rg -n '@beep/party-' packages/law-practice/domain packages/law-practice/use-cases packages/law-practice/tables` | No matches |
| Boundary: epistemic product | `rg -n '@beep/epistemic-' packages/party` (does not match `@beep/epistemics`) | No matches |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-11-03 | Regenerate the policy fingerprint to include the two new package manifests and give the synthetic Acme fixture an explicit tsconfig owner | final-check detects missing policy inputs and unowned fixture TypeScript that scoped package checking alone did not cover; the cache review changes only the root subject and preserves qualification | regenerate the fingerprint if those packages are removed; remove the fixture config only when another explicit owner covers it |
| 2026-11-03 | Record the LegalPartyReference breaking rename in a packet migration note, with no changeset for the private law-practice workspace | current release policy and the changeset graph forbid notes for private workspaces; hosted Repo Sanity and the local source checker reproduced this violation. No public package is being released | restore the old entity and imports together; if the workspace is deliberately made publish-enabled later, assess a major release under that release policy |
| 2026-11-03 | Model IdentityView as an annotated opaque schema with schema-backed maps and a declared in-memory representative function; inline the contact streaming service contract | the root schema-first gate found exported structural data contracts; the callable is explicitly runtime-only and is never persisted | restore the structural view only with an approved schema-policy exception; callers and persistence formats are unchanged |
| 2026-11-03 | Extract internal claimFromAssertion for contact and reviewer claim construction; split mail header collection, observation and pairing phases | publish-gate complexity and duplication findings identified shared logic and overly broad functions; existing synthetic tests retain behavior coverage | inline the helper or restore the prior orchestration and rerun package and root gates |
| 2026-11-03 | Keep reasoned code-duplication annotations on six nominal party factory bindings and the MailRecipient wire projection | factory facades instantiate party-owned ids and brands; reusing another product slice would violate the dependency boundary. The recipient shape intentionally repeats a tooling-owned wire contract without importing tooling. No algorithms are suppressed and complexity thresholds are unchanged | remove the annotations when a neutral factory/projection owns the repeated contract; review nominal bindings by 2026-12-03 or on factory API changes and the mail shape when its neutral driver exists |
| 2026-11-03 | Add seeded schema-derived properties for claim endpoints, candidate sealing, reporting-line rejection, observed spans and ledger snapshots | root schema-first coverage requires generated-input properties alongside fixed regression cases; canonical it.prop / it.effect.prop harnesses fail on falsification or exhaustion | replace with equivalent properties when contracts change; retain the fixed competency fixtures |
| 2026-11-02 | Party evidence identifiers use `party-`-qualified string prefixes; proposition logical keys use length-framed segments, with numeric ordering for symmetric PartyId endpoints | prevents foreign evidence-id reuse and delimiter collisions while retaining the shared integer PartyId | revert the new binding before publication; any later persisted format change needs versioned migration |
| 2026-11-02 | Memory ledger stores append-only versions and derives predecessor expiration bounds in snapshots; successors name a current predecessor (the corrected proposition may change) at a strictly later knowledge time | historical queries remain stable and failed writes cannot partially expire history | replace the adapter while preserving the port and replay tests |
| 2026-10-22 | First goal creates `domain`, `use-cases`, `server` only | smallest legal slice (doc 13); tables wait for a persistence shape the adapters have exercised | add packages in a later goal |
| 2026-10-22 | `PartyId` moves to a neutral `identity/Party` kit in a separate prerequisite PR, with no re-export | keeps the slice PR reviewable and lands the shared-kernel change alone; nothing persists the old derived names | restore it to `identity/LawPractice` |
| 2026-10-22 | Party claims persist in a party-owned bitemporal ledger bound from `makeClaimEnvelope` | avoids depending on epistemic product code; any cross-slice projection is a later workflow | write party claims as epistemic edge versions |
| 2026-10-22 | `PartyId` stays the integer surrogate from the neutral kit (#2025). Party identity evidence uses a separate deterministic `PartyKey` (`pk:v1:` + lowercase hex SHA-256 of the canonical basis defined in P1 contract tests) in `@beep/party-domain`, mapped to a `PartyId` by `KeyAssignment` claims. `SameParty` redirects the absorbed party's keys to the surviving id; the memory ledger allocates ids from a counter. Operator ruling 2026-10-22 | every product entity uses the integer surrogate and `LegalPartyReference` keys by it. A stable surrogate survives merges and splits, while keys stay deterministic for ingestion; minting the id from evidence would force a winner-take-all rewrite on every merge | make the kit carry the deterministic string as the id |
| 2026-10-22 | Identity rules. `KeyAssignment` maps a `PartyKey` to a `PartyId`; `SameParty` and `DistinctParty` relate `PartyId`s. Resolution is a read-time view over the accepted claim versions at a bitemporal scope, and no claim or reference is rewritten. In each merged component the smallest `PartyId` (earliest allocated) survives. All effective accepted `DistinctParty` constraints are collected before replaying merges in `ClaimVersion` order (knowledge `recordedAt`, then id), as detailed in P1 contract tests; a later veto can split the recomputed view and every blocked merge becomes a review case. An absorbed `PartyId` and the absorbed party's keys resolve to the survivor through the view, inside party. A `LegalPartyReference` keeps the `PartyId` it was written with. Resolving it to the survivor is a cross-slice read that this goal does not provide, because no tier may both hold the reference and query party's view. That read would come from a later `shared/use-cases` resolution query or a party merge event (doc 10). Retracting or superseding a `SameParty` recomputes the merged components from the remaining accepted claims, and each id resolves to the survivor of its recomputed component. That can differ from the pre-merge split: with `SameParty(1,2)`, `SameParty(2,3)` and `SameParty(1,3)`, retracting `(1,2)` still leaves 2 merged with 1 through 3. With `DistinctParty(1,3)`, retracting `(1,2)` re-enables a previously vetoed `SameParty(2,3)` | keeps resolution replayable and reversible (the scratchpad's `resolveParties` picked the smallest id and merged in claim order), keeps law-practice references stable without rewrites, and lets a mistaken merge be undone by a retraction | persist merges as rewrites of `KeyAssignment` and reference rows |
| 2026-10-22 | Law-practice's `Party` aggregate is renamed `LegalPartyReference` in this goal | party owns party identity and `SameParty` resolution. The law-practice record is already a role-player reference that never resolves identity (its own Gotchas), so two aggregates named `Party` over one `PartyId` would leave ownership unclear. Applies the 2026-10-21 decision ("other slices refer to parties by id and attach their own role vocabularies") | keep the name and add an ownership note instead |
| 2026-10-22 | #2045: exact server boundary parses source module specifiers and checks dependencies/devDependencies in the server manifest; test imports are excluded because fixtures carry forbidden specifiers; diagnostic scans check tokens and manifest keys | whole-line filtering hides suffix packages and mixed imports; source-only scans miss forbidden manifest dependencies | replace the parser test and scan together with an equivalent architecture gate |
| 2026-10-22 | #2045: PartyKey v1 uses the canonical basis and bytes in P1 Contract Tests; hash graduated normalized identifier values (whole-address lowercase email, uppercase Exchange DN, lowercase Username handle, E.164 phone), canonicalize email domains in the shared normalizer, and exclude provenance | identifier deduplication and PartyKey generation must agree; shared normalizers give adapters identical keys without turning email equality into identity evidence | introduce `pk:v2:` and explicit KeyAssignment migration; retain v1 decoding and historical assignments |
| 2026-10-22 | #2045: every active veto constrains a fresh merge replay, including later/equal-time vetoes; blocked merges surface as `conflicting-review` | cannot-link constraints must hold throughout the queried view; deterministic replay preserves history and retraction behavior | version the resolution policy and replay fixtures; keep old policy available for pinned historical views |
| 2026-10-22 | Generic adapters live in party server; law-practice sources feed party through a use-case port | party never learns law-practice vocabulary, and ingestion stays domain-agnostic | move the adapters back into law-practice |
| 2026-11-02 | P1b factory bindings use AssertionId for candidate/evidence references, ClaimVersionId for immutable belief and projection references, and PrincipalId for reviewers; their schema identities belong to party-domain | reuse all seven foundation families without an epistemic product dependency or duplicate identity vocabulary | repoint consumers and remove the party bindings; no persisted rows exist |
| 2026-11-02 | ContactSource exposes domain-neutral raw cards, shared phone inputs, canonical optional identifiers, and opaque context-role tokens | law-practice maps its vocabulary at its server boundary; mail and card ingestion share normalization and key generation | remove the adapter and contact port while keeping stored evidence unchanged |
| 2026-11-02 | Generic contact ingestion emits immutable observations/assertions and Proposed claims with unknown valid time; matching keys never merge cards | a card is an ingestion anchor, not an accepted identity fact; the reviewer supplies acceptance and temporal meaning | remove the ingestion adapter; existing source rows remain append-only and claims can be superseded |
| 2026-11-02 | The law-practice boundary test runs under Node, alongside the existing Bun test suite, through the package-owned beep:test implementation | TsNativeApi requires Node stdio handles; effect-drizzle already uses this split-runner pattern | restore the Bun-only implementation when the native transport supports Bun and rerun parser fixtures |
| 2026-11-02 | Mail ingestion validates a header-only index projection in party-server instead of importing the CLI corpus index model | production packages cannot depend on tooling; the consumed fields retain the existing index wire shape while unrelated corpus fields stay outside the slice | remove the projection and move the adapter back to scratchpad; no storage migration |
| 2026-11-02 | Export-time parsing retains milliseconds, truncates finer precision and rejects calendar rollover or absent timezone | foundation knowledge/valid time uses epoch milliseconds; an invalid date must stay unknown | restore the former parser with a documented precision change and replay synthetic fixtures |
| 2026-11-02 | Ledger appendEvidence validates an entire evidence batch before one atomic state replacement; contact and mail ingestion use it | late duplicate or predecessor conflicts must not leave half an extraction recorded | retain single-record operations and remove batch ingestion callers; no existing stored row changes |
| 2026-11-02 | MailIndexInput requires the child message content identifier separately from the parent archive; occurrence identity includes that content identifier | the scratchpad reused the archive id as child content, conflating distinct message content and changed bytes at a path | explicitly supply the former content reference at the adapter boundary only if a caller requires legacy replay; no mutation of existing provenance |
| 2026-11-02 | Organization and mailbox drift leads compare inclusive numeric observation bounds; known concurrent evidence takes precedence over other undated pairs | missing dates must preserve uncertainty without erasing a known overlap; organization suffix grouping remains a documented heuristic, not a public-suffix or ownership assertion | restore the prior lead classifier and replay review cases; accepted claims and source evidence remain unchanged |
| 2026-11-02 | Mailbox component labels and card candidates use deterministic ordering; card evidence deduplicates by both source and party and rejects ambiguity in any source | replay order and duplicate rows must not invent independent evidence, self-merges or different candidate chains | revert the candidate builder and regenerate unreviewed queues; no accepted identity or stored row is rewritten |
| 2026-11-02 | Mail alias pairings carry real assertion ids; each assertion anchors both matching header fields, uses unknown validity and is appended atomically with observations | the scratchpad claim builder invented assertion ids without corresponding evidence rows; extraction identity and length-framed pair identity prevent collisions | remove alias assertion production and consumers together; preserve existing immutable evidence and supersede dependent claims |
| 2026-11-02 | Pairing aggregation counts distinct message ids, bounds samples deterministically, retains sampled assertion ids and compares all observed times numerically | duplicate rows or extractions must not inflate message counts; sampled claim support must resolve to real evidence | replace the aggregate builder and regenerate unreviewed proposals; source assertions remain unchanged |
| 2026-11-02 | Pairing claims remain Proposed and use only sampled assertion references; inclusive observed bounds become half-open millisecond intervals, with an open end at the maximum representable instant | preserves the scratchpad observed-span proposal semantics on foundation ValidTime without dropping the last observation or inventing acceptance; undated bounds stay Unknown | regenerate unreviewed proposals with the prior policy; supersede any published version rather than rewriting it |
| 2026-11-02 | Pairing proposal ids bind the logical proposition, sorted assertion set, observed bounds and knowledge time through length framing | changed evidence or recording time must not reuse an immutable version id; input order and duplicate references must not change identity | version the proposal id format and replay unreviewed proposals; retain historical decoding |
| 2026-11-03 | MailCensus uses schema-owned immutable snapshots and persistent evidence maps, with a count-only summary and explicit decode-failure folding | prior snapshots remain stable, numeric times govern observed spans, and source names/ids cannot leak through the summary; blank display names do not create collision cases | adapt callers back to the prior mutable census API and regenerate summaries; no source or accepted claim is mutated |
| 2026-11-03 | Review cases seal schema-encoded canonical evidence using the existing catalog @noble/hashes SHA-256 implementation; mailbox sets use numeric PartyId order | avoids a production dependency on repo-utils or platform crypto and makes digest equality independent of presentation order | remove the server hash dependency and regenerate unreviewed case bases with a versioned replacement; retain existing decision evidence |
| 2026-11-03 | Reviewer decisions require explicit validity and source provenance; generated accepted candidates have matching real source assertions | foundation Unknown valid time intentionally does not resolve, and invented review assertion ids leave dangling evidence | migrate decision inputs through an explicit validity/provenance adapter; supersede published claims rather than changing their rows |
| 2026-11-03 | Review application validates sealed evidence and complete partitions before resolution, rejects conflicting latest-time ties, and removes conflicting candidates until the settled set is stable | invalid decisions must not poison other cases; outcomes must not depend on input order or claims withheld from publication | version the review policy and replay cases from original decisions; immutable evidence remains intact |
| 2026-11-03 | Mailbox anchors allocate shared integer PartyIds through a ledger-scoped PartyKey registry, keyed by the smallest canonical identifier in a dedicated source namespace | replaces the scratchpad string PartyId derivation, preserves repeat/concurrent allocation within one ledger, and emits no accepted identity assertion | remove registry callers and use explicit caller-owned integer anchors; no persistence migration exists for the memory Layer |
| 2026-11-03 | Scratchpad mail workflows require each index row to be enriched with an explicit child-message content id; mail census consumes the graduated package APIs and Effect CLI | the legacy corpus index has no child digest and archive identity cannot be substituted; malformed or unenriched rows are counted as decode failures without private payload output | supply a separate provenance resolver at the script boundary or restore the old script only for explicitly labeled legacy replay; never alias archive content to child content |
| 2026-11-03 | A scratchpad-only review-page adapter preserves the existing page format while binding readable addresses to canonical identifier keys and converting times for presentation; imported page decisions require explicit validity and provenance | the review page is out of scope and does not collect the new temporal/source context; a compatibility adapter avoids weakening review validation or silently choosing validity | remove the adapter when a separately scoped page update emits the graduated models directly; preserve exported decisions and explicitly migrate legacy string party ids |
| 2026-11-03 | The identity-evidence script consumes graduated adapters, exports real source assertions alongside claim files, keeps card matches Proposed, and requires explicit validity flags for page decisions | closes dangling-evidence and premature-merge paths while preserving the out-of-scope review page; extraction activities distinguish reruns and invalid decision record positions remain traceable | restore the previous script only for labeled legacy replay; retain new output evidence and explicitly migrate decision exports before changing their validity policy |
| 2026-11-03 | Remove the graduated scratch implementation, fixtures and five legacy test files after mapping their assertions to package tests; preserve scripts, page-boundary tests and the historical design document | eliminates divergent executable models after synthetic competency parity and migrated-script verification | restore historical files from git only for explicitly labeled legacy replay; current production behavior stays in package tests |
| 2026-11-03 | Refresh only audit-named cache baseline subjects for generated package and root registration changes, preserving scope/profile/epoch and qualification | package creation and manifest changes alter reviewed task inputs; the final cache audit reports zero blocking findings | regenerate from the previous baseline with a reviewed request after reverting the corresponding package registrations; no cache qualification is granted |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| `@beep/law-practice-server` imports `@beep/party-use-cases` to implement the contact-source port | law-practice server tier only (the contact adapter and its Layer wiring); never law-practice domain or use-cases, never party importing law-practice | this goal (party-slice) | `01-hexagonal-vertical-slices.md:71-74` forbids slice-to-slice imports; DECISIONS 2026-06-18 allows one at the use-cases/server tier as a bounded exception recorded here | a third consumer of contact sources justifies a `shared/use-cases` contact-source contract, or law-practice emits a contact event party consumes (`10-cross-slice-coordination.md`) |
