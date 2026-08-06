# Surface Re-Verification (P0)

<!--
P0 exit requirement: "Surfaces confirmed current" against research/SOURCES.md §4
(Lane A inventory, 2026-08-04). Re-verified against live source on the dates
below. Every row cites the path actually read, not the inherited citation.
-->

Provenance: 2026-08-05, agent Claude Opus 5, branch
`feat/patent-citation-candor-gate`, verified by direct read of live source.

## 1. Verdict

All SOURCES.md §4 surfaces are **current**. No inherited citation was found
stale. Two drift notes (§4 below) refine — but do not contradict — the packet.

The NET-NEW claim re-holds: a repo-wide sweep for
`PatentCitationEvent|CandorDisposition|CandorPolicy|PatentFragmentLocator|PatentCitationEventId|CandorDispositionId`
across `packages` and `apps` returns **zero** files.

## 2. Confirmed live surfaces

| Surface | Path verified | Fact that matters for implementation |
|---|---|---|
| Entity precedent | `packages/law-practice/domain/src/entities/PriorArtReference/PriorArtReference.model.ts:50` | `BaseEntity.Class<Self>($I\`Name\`)(IdSchema, { fields, persisted }, $I.annote(...))` — the exact 3-arg shape every new law-practice entity follows. |
| Id registry | `packages/shared/domain/src/identity/LawPractice.ts:11-12,293` | `$LawPracticeDomainId.create("identity/LawPractice")` + `EntityId.factory("law_practice", $I)`; each id is `make("snake_case", { description })` plus an `export type X = typeof X.Type`. Ids are in entity order, not alphabetized. File is 392 lines. |
| Entity fields mixin | `packages/law-practice/domain/src/entities/LawPracticeEntity.fields.ts:28,64,100` | `LawPracticeFixtureKey`, `LawPracticeText`, `ClaimNumber` available for reuse. |
| Principal | `packages/shared/domain/src/entity/Principal.ts:73,101,142,181,219,240` | Tagged union over `kind` via `S.Union([...]).pipe($I.annoteSchema(...), S.toTaggedUnion("kind"), SchemaUtils.withCodecStatics)`. |
| Source-version identity | `packages/foundation/modeling/provenance/src/SourceTextIdentity.ts:119` | Fields: `scopeRef`, `sourceRef`, `locator`, `sourceDigest`, `textDigest`, `extractor`, `normalizationVersion`. **No revision order, no parent, no head marker** — confirming the SPEC constraint that currency must be declared, never inferred. `sourceRef` is the version-independent logical-source key; the digests are the version. |
| Receipt | `packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts:152` | `TextAnchorVerificationReceipt = { anchor: TextAnchor, source: SourceTextIdentity }` — a receipt already carries the observation version, so an event needs no separate identity field. |
| Re-verification | `packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts:349-351` | `verifyTextAnchor(VerifyTextAnchorInput) : Effect<VerifiedTextAnchor, VerifiedTextAnchorError, Crypto.Crypto>`. Input needs `anchor`, `expectedSource`, `source`, `sourceText`. **This is the origin of the SPEC's `Crypto.Crypto` requirement-channel clause.** `VerifiedTextAnchor` is an opaque from-self declare — a receipt provably cannot be upcast into proof (`:223`). |
| Source text port | `packages/foundation/capability/file-processing/src/SourceText/index.ts:360,371` | `SourceTextResolver` is `Context.Service<SourceTextResolver, SourceTextResolverShape>()`; shape is a single `resolve: (ResolveSourceTextRequest) => Effect<ResolvedSourceText, SourceTextResolverError>`. `ResolveSourceTextRequest = { identity }` (`:191`), `ResolvedSourceText = { identity, text }` (`:213`). Import specifier `@beep/file-processing/SourceText` confirmed in the package exports map. |
| Application identity (live) | `packages/law-practice/domain/src/values/ApplicationNumber/ApplicationNumber.model.ts:52` | WIPO ST.13, branded, 15 chars, pattern `^(?:1[0-9]\|91)[0-9]{4}[A-Z0-9]{2}[0-9]{7}$`. |
| Application identity (mirror source) | `packages/drivers/uspto/src/Uspto.models.ts:33` | `UsptoApplicationNumber` = `S.String.check(S.isPattern(/^\d{8}$/))` + `S.brand("UsptoApplicationNumber")`. Shape to **mirror, never import**. |
| Patent reference | `packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:188` | `PatentReference` = all-Option `{ country, number, kindCode }`. |
| Durability precedent | `packages/epistemic/use-cases/src/ExecutionLedger/ExecutionLedger.ports.ts` | Present as cited (rung-2 pattern, never imported). |
| Runtime approval | `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts` | Present as cited. |
| Package deps | `packages/law-practice/domain/package.json`, `packages/law-practice/use-cases/package.json` | domain already depends on `@beep/provenance`, `@beep/shared-domain`, `@beep/schema`, `@beep/identity`. use-cases already depends on `@beep/file-processing`, `@beep/law-practice-domain`, `@beep/schema`. **No dependency additions are required for rung 1.** |
| Canonical file roles | `standards/ARCHITECTURE.md:977,978,984` | `.model.ts`, `.values.ts`, `.events.ts` are canonical domain roles. **See correction 3 below — the `.events.ts` role has no slice instance on disk.** |

## 3. Test-lane facts

- `packages/law-practice/use-cases/test/` exists with one suite
  (`SchemaParity.test.ts`); `@effect/vitest` is already a devDependency.
- Package test script is `bunx --bun vitest run --passWithNoTests`.

## 4. Drift notes (refine the packet, do not contradict it)

1. **`Principal` has five members, not four.** The SPEC and MAP describe the
   union as `User` / `Agent` / `ServiceAccount` / `System`; live source
   (`Principal.ts:240`) also carries `ConnectorAccountPrincipal`. This does not
   weaken the trust boundary: the predicate's rule is *only* a `User`-kind
   principal covers an event, so the unnamed fifth member fails closed by
   construction. Recorded so the SPEC's parenthetical is not mistaken for an
   exhaustive list.
2. **JSDoc grammar has moved.** `.patterns/jsdoc-documentation.md` makes
   `**Example** (Title)` sections the canonical carrier for new or touched
   code, with legacy `@example` grandfathered (93 files migrated, 1806 not).
   The nearest precedents this goal copies from are split: `PriorArtReference`
   and `Claim` still use legacy `@example`, while the in-slice
   `ApplicationNumber.model.ts` already uses the new section grammar. New files
   in this goal follow the **new** grammar, and examples must compile through
   the docgen gate.
3. **Correction (2026-08-05): the `.events.ts` role has no slice instance.** An
   earlier draft of this file implied that `Membership.events.ts` and
   `Enrollment.events.ts` exist in `packages/shared/domain`. They do not. Those
   paths appear only inside the illustrative canonical-anchor tree at
   `standards/ARCHITECTURE.md:798,810`; the sole `*.events.ts` on disk is
   `packages/foundation/ui-system/dock/src/Dock.events.ts`, a foundation UI
   module rather than a domain-event contract. `SPEC.md:141-142` was already
   correct on this point. The error is recorded rather than silently deleted
   because it is exactly the kind of "role exists in the standard, therefore
   instances exist" inference the gate-shape analysis had to unwind — see
   [`01-gate-shape-check.md`](./01-gate-shape-check.md) §0.1.
