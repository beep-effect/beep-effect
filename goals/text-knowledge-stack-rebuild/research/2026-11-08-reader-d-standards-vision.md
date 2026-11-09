# Reader D: standards, vision and binding rulings for the text-knowledge rebuild

Read-only extraction. Citations are repo-relative `path:line`. `INFERENCE` marks anything that is my reading and not the source's words. Code counts come from `rg`/`find` on this worktree (branch `explorations/nlp-annotation-family`, HEAD `de54b37982b`).

## Judgment calls

- `standards/GLOSSARY.md` does not exist. The glossary is `standards/architecture/GLOSSARY.md`; I read all 594 lines.
- `standards/ARCHITECTURE.md`: read in full (2,194 lines).
- `standards/architecture/DECISIONS.md`: 80 headings listed. I read every entry that touches the brief's topics, using heading review plus a keyword scan, not all 2,616 lines.
- `goals/` has 286 directories. I filtered by slug keywords, so a goal with an unrelated slug can be missing from section 5.
- Owner statements that live outside the repo (`~/.claude/rules/*`, `~/.claude/memory/beep-effect/*`) are labelled "out-of-repo". They are operator doctrine, but they don't travel with the repo.

## Two corrections to the brief

1. **S31 is not a package-count rule.** It says never grow debt or exception inventories under `standards/`. "S31 versus 30+ modeling packages" is therefore not a conflict. See section 8, C8.
2. **The ruling title means epistemic vocabulary only.** "Epistemic Vocabulary Is Foundation" does not say vocabulary in general is foundation. The seed conflict is real, but its strongest citation is `law-practice keeps LegalRole` (`standards/architecture/DECISIONS.md:2322`).

---

## 1. `standards/ARCHITECTURE.md`

### Constitutional status

> "This document is the binding architecture constitution for beep-effect... If a proposed slice, package, adapter, or dependency contradicts this document, the proposal must change or this document must be amended." (`standards/ARCHITECTURE.md:3-7`)

The north star optimizes for:

> "Fast domain experiments that do not create long-term topology debt... Clear driver boundaries... Reusable rich domain concepts without turning the repo into one giant shared horizontal layer... Reviewable topology where file paths and role suffixes carry enough context to keep work consistent." (`standards/ARCHITECTURE.md:37-43`)

### Layering model

Default homes, `standards/ARCHITECTURE.md:49-60`:

| Task | Default home |
|---|---|
| Product behavior or product language | The owning slice. |
| Product language deliberately shared by multiple slices | `shared/*`, after the shared-kernel promotion gate. |
| External engines, SDKs, services, frameworks, or browser platform wrappers | `drivers/*`. |
| Domain-agnostic reusable substrate owned by this repo | `foundation/*`, after the specific-home-first routing test. |

Families, `standards/ARCHITECTURE.md:478-483`:

- `foundation` has kinds `primitive`, `modeling`, `capability`, `ui-system`: "Repo-owned domain-agnostic reusable substrate."
- `drivers` is flat.
- `tooling` has kinds `library`, `tool`, `policy-pack`, `test-kit`.
- `ecosystem` is flat.

Foundation layering, verbatim (`standards/ARCHITECTURE.md:617-622`):

| Kind | May depend on |
|---|---|
| `primitive` | `foundation/primitive` |
| `modeling` | `foundation/primitive`, `foundation/modeling` |
| `capability` | `primitive`, `modeling`, `capability` |
| `ui-system` | `primitive`, `modeling`, `ui-system`, `drivers` (narrow) |

What may import what:

- "`domain` depending on anything except shared-kernel language and `foundation/primitive` or `foundation/modeling` packages" is forbidden (`standards/ARCHITECTURE.md:278-282`).
- "`foundation`, `drivers`, `tooling`, and `ecosystem` do not depend on product slices or the shared kernel" (`standards/ARCHITECTURE.md:705-707`).
- "Slice-to-slice direct imports across `domain`, `use-cases`, `server`, `tables`, `client`, or `ui` packages of *different* slices are forbidden." Integration goes through events or promoted `shared/use-cases` (`standards/ARCHITECTURE.md:698-702`).
- Apps are "executable workspaces, not reusable package surfaces by default" (`standards/ARCHITECTURE.md:62`).
- "Foundation package roots must be runtime-neutral or browser-safe by contract" (`standards/ARCHITECTURE.md:521-523`).

Consequence (`INFERENCE`): anything a slice's `domain` must import has to be `primitive` or `modeling`. `capability` is unreachable from `domain`. This is a hard pressure on where a rebuilt knowledge core can sit.

### `foundation/modeling` definition and anchors

- Glossary: "A `foundation` kind for reusable schemas, brands, identity contracts, and modeling vocabulary that higher-level foundation packages and slices may reuse without taking product-domain dependencies." (`standards/architecture/GLOSSARY.md:295-297`)
- File anchors: "`foundation/modeling` | concept modules with `*.schema.ts`, `*.brand.ts`, `*.codec.ts`, `index.ts`; package-specific role files when canonized" (`standards/ARCHITECTURE.md:717`)
- Metadata: `package.json` `beep: {family, kind}`; "Path and metadata must agree" (`standards/ARCHITECTURE.md:581-611`)
- Naming: `foundation -> @beep/<purpose>` (`standards/ARCHITECTURE.md:542`)

`@beep/schema` namespace-first concept topology (`standards/ARCHITECTURE.md:743-808`):

- Public paths are flat PascalCase, such as `@beep/schema/<Concept>`.
- "Only `@beep/schema/<Concept>` is public for concept modules. Role files are source topology."
- Core suffixes are `.schema.ts`, `.input.ts`, `.transforms.ts`, `.constructors.ts`, `.guards.ts`, `.errors.ts`, `.types.ts`.
- Concise role names are canonical: `Schema`, `Input`, `FromInput`, `Object`, `Unit`.

### Upstream-first (verbatim, `standards/ARCHITECTURE.md:810-818`)

> "`foundation/modeling` is upstream-first. Where upstream covers a `foundation/modeling` concept's intent, its covered facets retire in the same PR that migrates their consumers, with no alias; the whole concept retires unless the lines reading its uncovered members outnumber the lines using its covered facets (ADAPT, per the facet census). A new concept is not added where upstream already covers it (`standards/architecture/DECISIONS.md` "Upstream-First Foundation/Modeling"). Named internal literal domains use `LiteralKit`; anonymous inline unions never referenced by name use `S.Literals`."

### Slice, concept and role conventions

- Slice spine: `domain/ use-cases/ config/ server/ client/ tables/ ui/` (`standards/ARCHITECTURE.md:331-339`).
- "The canonical spine is vocabulary, not a scaffold mandate... A new package needs both: a concrete architecture role; meaningful exported behavior, contract, adapter, config surface, or test fixture. Do not create packages only for symmetry." (`standards/ARCHITECTURE.md:353-360`)
- Grammar: `<package>/src/<domain-kind>/<Concept>/<Concept>.<role>.ts` (`standards/ARCHITECTURE.md:1023`).
- Domain kinds: `aggregates/`, `entities/`, `values/`, with `policies/` and `services/` as escape hatches (`standards/ARCHITECTURE.md:1004-1010`).
- Domain roles: `.model.ts`, `.values.ts`, `.errors.ts`, `.behavior.ts`, `.policy.ts`, `.access.ts`, `.contracts.ts`, `.events.ts`, `.machine.ts`, plus the alchemy block roles (`standards/ARCHITECTURE.md:1061-1079`).
- "Domain role files never define handlers, clients, transports, runtimes, persistence, or driver access." (`standards/ARCHITECTURE.md:1081-1082`)
- "Topology Is Compressed Context" (`standards/ARCHITECTURE.md:163-171`).

### Core principles most relevant here

- **Schemas are executable contracts:** "For pure data models, `Schema` is the source of truth." (`standards/ARCHITECTURE.md:122`) Finite cases are discriminated unions (`standards/ARCHITECTURE.md:132-137`).
- **Rich domain, pure behavior** (`standards/ARCHITECTURE.md:113-118`).
- **Shared is a shared kernel, not a dump;** "Domain-agnostic reusable substrate belongs in `packages/foundation`" (`standards/ARCHITECTURE.md:108-111`).
- **One identity authority:** IRIs come from `@beep/identity` composers under `https://beep-effect.com/ns/`, "`/ns/` is reserved forever", "`@beep/identity` never depends on `@beep/public-site`" (`standards/ARCHITECTURE.md:197-206`).

### Ontology, vocabulary, epistemics, provenance, identity, nlp, rdf, knowledge graphs and agents

`ARCHITECTURE.md` says almost nothing on these directly. A keyword scan found:

- **Ontology, nlp, rdf, epistemics, knowledge graph:** zero mentions in the file.
- **"Vocabulary":** used only for filename-role vocabulary and access vocabulary (`standards/ARCHITECTURE.md:80`, `:170`, `:353`, `:997`, `:1017`, `:1371`). Never ontology.
- **"Provenance":** one mention, with a different meaning from `@beep/provenance`: "Provenance (principal, source kind, timestamp) is a `RequestContext` the Session middleware provides." (`standards/ARCHITECTURE.md:1762`)
- **Identity:** only principle 8 above and package examples.
- **Agents:** only as a client of `Api` surfaces: "An `Api` exposed over MCP serves Views only until the view-security tests... pass" (`standards/ARCHITECTURE.md:1768-1771`), and AI tool roles (`.tools.ts`, `:1096`; `.tool-handlers.ts`, `:1161`).

**Finding (`INFERENCE`):** the constitution has no theory of knowledge, text or meaning. It is purely topological. All semantic rulings live in `DECISIONS.md`, a glossary appendix, or goal packets. A redesign can add a knowledge-stack section without contradicting anything already there.

---

## 2. `standards/architecture/DECISIONS.md`: relevant rulings

The log has **no entries specifically about** nlp, rdf, langextract, semantica, JSDoc, or docgen as policy. A keyword scan found only incidental mentions (`standards/architecture/DECISIONS.md:1401`, `:1505`, `:2429`). The term "ontology" appears only at `:1139-1142` and `:2131`. Those laws live elsewhere (section 4). **`INFERENCE`: nothing ruled at architecture level says what `@beep/nlp`, `@beep/rdf` or `@beep/ontology` are for.**

| Date, title, line | Rule (one sentence) | Reason | Reversal clause |
|---|---|---|---|
| 2026-04-21 Prefer Hybrid Rich Domain Models, `:140` | Models own shape, validation and pure behavior, as methods, functions, `*.behavior.ts` or `*.policy.ts`. | Reduces duplicated rules. | None stated. |
| 2026-04-23 Non-Slice Family/Kind, `:350` | Every non-slice artifact has one family, plus a kind where the family has one. **Status: Superseded** by 2026-05-01 (for the agents family). | Family-only is too vague. | Superseded; the family/kind rule survives in `ARCHITECTURE.md`. |
| 2026-04-23 Semantic Foundation Names, `:456` | Foundation packages use semantic public names (`@beep/schema`). | They should read cleanly in imports. | Amended 2026-10-28 for tooling only. |
| 2026-04-23 Agent Content Portable, `:474` | **Superseded** by 2026-05-01: the `agents` family is gone. | n/a | n/a |
| 2026-05-09 Finite Cases As Discriminated Unions, `:815` | Finite data cases are tagged unions; optional bags must normalize at the boundary. | "Optional/nullish bags hide invariants." | "This is doctrine and review guidance"; no sweep. |
| 2026-05-22 Namespace-First `@beep/schema`, `:878` | Flat PascalCase concept modules, consumed as namespaces. | Effect-style consistency plus context compression "for coding agents and reviewers." | None stated. |
| 2026-05-22 Close `@beep/schema` Topology, `:919` | Lowercase topical paths are retired, enforced by `lint schema-topology`. | "gives agents a much smaller navigation surface." | None stated. |
| 2026-06-18 Cross-Slice Consumption Of The Epistemic Boundary, `:953` | Three tiers: substrate goes to `foundation/modeling`, second-vertical vocabulary goes to `shared/domain` with a promotion record, mechanism stays in the slice with a bounded exception. | Honors the `domain` import rule with zero exceptions. | Exception has a removal trigger: "until a third consumer justifies extracting a `shared/use-cases` contract." |
| 2026-07-05 Repo Crispening, `:1017` | Per-owner lint ratchet for schema-first cards; `O.getSomesStruct` amendment. | A one-time cleanup becomes a permanent property. | "not to be reopened during packet execution." |
| 2026-07-25 Foundation-Mediated Port Inversion, `:1103` | A slice may implement a foundation-owned port another slice consumes, under five conditions (no product semantics, neither slice names the other, app-entrypoint binding). | A fail-closed gate is synchronous; "an emitted event cannot express 'and do not proceed.'" | "If any condition fails, the coupling is a slice-boundary breach." |
| 2026-09-02 In-Repo Deprecations Removed on Discovery, `:1762` | Never-shipped, zero-consumer `@deprecated` symbols are deleted immediately. | Every workspace is private; release-counted windows never elapse. | Windows still govern published and cross-slice surfaces. |
| 2026-09-12 Schema Classes Derive Equivalence, `:1422` | No class-level `toEquivalence` annotations; effect derives it by construction. | Upstream fixed the premise. | Amended 2026-09-29: lint retired, decision stands. |
| **2026-09-29 Upstream-First Foundation/Modeling, `:2028`** | Quoted in full below. | | |
| 2026-10-09 Private release-note reset, `:2116` | Private workspaces need no changesets; "The live `@beep/ontology` workspace is removed from the retired-name registry" (`:2131`). | | Reverse with baseline recovery commands. |
| 2026-10-14 Plain Data Schemas Are Branded `S.Opaque`, `:2141` | Plain data is `S.Opaque`; `S.Class` is for errors, persisted entities, instance members and `.extend` chains; every class carries `{ readonly brand: unique symbol }`. | `S.Class` fails `S.is`, encoding and `structuredClone` on plain objects; 93% of 6,736 classes had empty bodies. | "Reverse by running the codemod in Opaque-to-Class mode or reverting its PR." |
| 2026-10-20 Single Public Origin, `:2228` | `/ns/` reserved forever for identity dereference; `@beep/public-site` owns hosting; identity authority is a type-level literal. | Origin-scoped files; "schema.org and w3.org mint IRIs as apex paths." | "Reverse by reverting its PR and running `bun run beep laws retired-iri-authorities` in report mode." |
| **2026-10-21 Epistemic Vocabulary Is Foundation, `:2290`** | Quoted in full below. | | |
| 2026-10-22 Upstream-First Census Amendments, `:2365` | Coverage must survive derivation; construction is neutral; a replacement that changes meaning gets its own row. | LiteralKit `pick`/`omit` looked covered but 24 sites re-wrapped the result. | Rejected alternatives listed, no reversal clause. |
| 2026-11-06 Slices Adopt `@alchemy.run/domain`, `:2541` | Event-sourced slices declare write models with alchemy; streams are the system of record; provenance is a `RequestContext`; the entity kit is frozen. | Operator ruling D0, D1-D17; kit is "a weaker DDD substrate." | Rejected list given, no reversal clause; pinned beta bumps are named tasks. |

Related but outside the log:

- `standards/memory-architecture/04-decision-log.md:202`, 2026-06-17 reframe: "The deterministic-first, semantic-as-managed-cache, and provenance-verification **principles remain binding**... the live product is the **solo IP-law firm flywheel**" (`:217-220`).
- `standards/memory-architecture/04-decision-log.md:347`: "All semantic memory layers... are treated as managed caches with bounded lifetimes, not as sources of truth."
- `AGENTS.md:134`: "Never hand-roll what an Effect module provides (e.g. `effect/Graph` algorithms)". `AGENTS.md:142`: named `LiteralKit` domains.

### Full text: Upstream-First Foundation/Modeling (`standards/architecture/DECISIONS.md:2028-2097`)

> ## 2026-09-29: Upstream-First Foundation/Modeling
>
> - **Status:** Active (census rules amended 2026-10-22, "Upstream-First Census Amendments")
>
> Decision:
>
> `foundation/modeling` packages defer to upstream Effect facet by facet. A concept retires unless the consumer lines that read its uncovered members outnumber the lines that use its covered facets, construction included. Retiring deletes its implementation, exports, and tests and moves every consumer to the upstream API in the same PR, with no alias left behind (no deprecation shim, re-export alias, or compat module). Otherwise the concept is ADAPT: its covered facets are deleted the same way, in the PR that migrates their consumers, and the rest stays. A new concept is not added where upstream already covers its intent.
>
> - Intent is judged per facet on the consumed surface: the schema value and each member or static consumers read. A facet is covered when public upstream API covers what consumers use it for, checked against the installed `effect` declarations (`dist/*.d.ts`); an `@internal` symbol never counts. The upstream API may live outside `effect/Schema` or be an inline composition at the consumer, such as `S.String.check(S.isPattern(...))`.
> - A RETIRE with more than 100 audited consumers runs a facet census before its PR opens; the census and any flip to ADAPT are logged in the owning goal packet's decision log before the PR opens.
> - Persisted and externally served encodings stay byte-identical, using an upstream variant or a consumer-local composition of upstream codecs. Only in-memory shapes may change, and consumers accept the behavior changes that come with them. A boundary whose upstream default differs and whose bytes no such codec reproduces is a separate migration goal. A field of a promoted `shared/use-cases` contract is the exception: its name, decoded type (brands included), accepted values, bytes and meaning all stay unchanged, and any change to them is a `V2` migration outside the retirement PR.
>
> The operational rules are in `11-evolution-and-deprecation.md`, section "Upstream-first retirement in `foundation/modeling`". `goals/effect-schema-parity` applies them to `@beep/schema`, and each of its PRs cites this entry by heading.
>
> Rationale:
>
> The 2026-07-08 PGlite decision declined a repo wrapper that duplicated an upstream client. Modeling concepts follow the same reasoning: a local concept that shadows an upstream one is a second owner for one capability, and it has to be re-audited on every Effect snapshot bump. The 2026-09-02 entry removes a symbol without a window when it has never shipped in a release and has zero remaining consumers. `foundation/modeling` packages are private and have never shipped, and deleting a concept in the PR that migrates its consumers meets the zero-consumer half inside one change.
>
> Intent is judged per facet because the first `@beep/schema` audit judged it on the schema alone and ruled LiteralKit RETIRE. `S.Literals` does cover the kit's schema, but a consumer census found its uncovered keyed members (`.Enum` 1,172 lines, `.is` 603, `$match` 243, `toTaggedUnion` 36) at 2,054 lines against 2,048 for its covered facets (construction 1,521, `.Options` 395, `.thunk` 65, `.pickOptions`/`.omitOptions` 52, `.HashSet` 15). LiteralKit is therefore ADAPT: it keeps `Enum`, `is`, `$match`, `toTaggedUnion` and `LiteralToKey`, and loses `Options`, `pickOptions`, `omitOptions`, `HashSet`, `thunk`, `enumMapping` and the `M` type parameter (`explorations/effect-schema-parity/DECISIONS.md`, "LiteralKit reopened at decompose: ADAPT, not RETIRE", 2026-09-15). Byte identity keeps data migrations out of retirement PRs.
>
> Rejected: a rule in the `@beep/schema` README only (the other `foundation/modeling` packages would keep hand-rolling); aliases or deprecation windows for in-repo consumers (a kept alias is a second owner under another name, and the 2026-09-02 entry found that release-counted windows never elapse here); judging intent on the schema facet alone (it would retire LiteralKit, whose uncovered keyed members carry 2,054 consumer lines against 2,048 for its covered facets, construction included).

Scope note (`INFERENCE`): "upstream" here means **upstream Effect**, not W3C standards or RDF libraries.

- The census amendment later supersedes "construction included" (`standards/architecture/DECISIONS.md:2378-2379`).
- Rules 1-6 are at `standards/architecture/11-evolution-and-deprecation.md:109-178`.

### Full text: Epistemic Vocabulary Is Foundation (`standards/architecture/DECISIONS.md:2290-2363`)

> ## 2026-10-21: Epistemic Vocabulary Is Foundation; Party Is A Product Slice; Propositions Are Slice-Owned
>
> - **Status:** Active
>
> Decision:
>
> `@beep/epistemic-domain` splits along the line it already has. Its tenant-free value vocabulary (claim gate verdict, evidence spans, edge relation and logical edge identity, bitemporal valid/knowledge intervals, evidence-signal envelopes, and a generic `Claim<P>` / edge-version envelope over an encoded proposition and its logical key) moves to a new `foundation/modeling` package, `@beep/epistemics`. The epistemic slice keeps everything that carries product semantics: the org-scoped `ProductEntity` entities (`EdgeVersion`, `Evidence`, `CandidateClaim`, `ClaimDisposition`, `Activity`, `Contradiction`, `EvidenceVerification`, `UsageRecord`), its tables, the Postgres edge authority, and the contradiction-triage service, and it imports the vocabulary from foundation. `ClaimLifecycle` is not part of the move: it is already shared-kernel vocabulary in `shared/domain` with a promotion record, per "2026-06-18: Cross-Slice Consumption Of The Epistemic Boundary", which this entry applies rather than supersedes (substrate to `foundation/modeling`, shared product vocabulary to `shared/domain`, mechanism stays in the slice). The agent-authority values (`ExecutionGrant`, `GrantSet`, `ExecutionRecord`, `ExecutionVerdict`) are not epistemics; they are recorded as misfiled and move to their own home in a separate change.
>
> Parties (persons, organizations, collective agents), their identifiers, accounts, voices, identity resolution, and the reviewer loop graduate from `scratchpad/party` into a new product slice, `packages/party/*`, created with `bun run beep create-package`. `PartyId` moves from `shared/domain` `identity/LawPractice` to a neutral `identity/Party` kit; other slices refer to parties by id and attach their own role vocabularies (law-practice keeps `LegalRole`). Each slice owns its proposition union (party: `IdentifierOf`, `AccountIdentifier`, `MailboxKind`, `VoiceAuthor`, `SameParty`, `DistinctParty`, `Membership`, `ReportsTo`, `DelegateOf`, `ContextRole`, ...) and instantiates the foundation `Claim<P>` envelope; no central proposition union exists in `shared`. Order: the `@beep/epistemics` extraction lands first, then the party slice builds on it instead of the scratchpad mirror.
>
> Rationale:
>
> Moving the whole epistemic package to foundation would violate `07-non-slice-families.md`: its entities are tenant-scoped product records with persistence and review workflows. Leaving it whole forces every slice that needs claim semantics (party, law-practice, future professional domains) into a cross-slice dependency on epistemic product code for what is really vocabulary. Party has behavior (resolution, review, ingestion), so it cannot be `shared` (which may not hold workflows) and it has one consumer today, so a shared promotion record is not satisfiable; keeping it inside law-practice defeats the domain-agnostic runtime goal. Slice-owned proposition unions keep compile-time role checking without making every new relation a shared-kernel change. Evidence for the model: `scratchpad/party/PARTY-DATA-MODEL.md` (49 tests; run over a real 241,501-message index). Reverse by keeping the vocabulary in `@beep/epistemic-domain` (delete `@beep/epistemics` and repoint imports) and, for party, by leaving the model in scratchpad.
>
> Amendment (2026-10-22, operator ruling during the extraction): "tenant-free" is not enough for a move to foundation. Seven of the value modules (`EdgeEndpoint`, `LogicalEdgeIdentity`, `EvidenceVerification`, `Contradiction`, `ContradictionDetection`, `ClaimEvidenceReview`, `ClaimProjection`) carry shared-kernel ids (`EvidenceId`, `CandidateClaimId`, `EdgeVersionId`, `UserPrincipal`), and foundation may not depend on the shared kernel. These modules now live in `@beep/epistemics` as generic schema builders and behavior factories over caller-supplied id schemas (`IdCodec`: a schema whose type is `string | number`) and a caller-supplied identity composer. Each slice declares its own `S.Opaque` classes from the builders under its existing names and identity paths, because TypeScript cannot declare a class over a generic base (TS2509). The epistemic slice therefore emits byte-identical schema identifiers (258 checked), and the party slice binds the same factories to its own ids. The `Claim<P>` envelope (`makeClaimEnvelope`) follows the same contract. Reverse by moving the shared-domain id brands into foundation and collapsing the builders back into concrete schemas. Record: `goals/epistemics-foundation-extraction/SPEC.md` "P1b factory contract".

---

## 3. Glossary and naming standards

Defined in `standards/architecture/GLOSSARY.md`:

| Term | Definition | Line |
|---|---|---|
| Provenance Anchor | "A domain-agnostic value that pins derived knowledge to where it came from in a source. The canonical shape is `TextAnchor` (`@beep/provenance`): a half-open character range `[startChar, endChar)` into a source document plus the exact quoted substring, re-sliceable as `text.slice(startChar, endChar)`. It is pure provenance substrate — no confidence, claim, or domain semantics... Consuming slices wrap it (e.g. epistemic `EvidenceSpan` = `TextAnchor` fields + a `Confidence`)." | `:299-308` |
| Verdict family (epistemic vocabulary law) | Ratified 2026-08-17. Stems and owners below. | `:573-594` |
| Identity Authority | "The IRI root every beep identity mints under: `https://beep-effect.com/ns/`... It names things; it does not decide where anything is hosted." | `:259-268` |
| Modeling Package | See section 1. | `:293-297` |
| Foundation Family | "domain-agnostic reusable substrate" | `:184-188` |
| Schema-First Model | "A pure data model whose `Schema` value is the source of truth." | `:445-450` |
| Concept | "A named domain idea" | `:95-99` |
| Rich / Anemic Domain Model | | `:434-438`, `:48-51` |
| Shared Kernel | Plus the terminology caveat: "deliberate cross-slice product language within a single team's codebase" | `:470-488` |
| Event / Aggregate / View / Projection (event-sourced) | | `:205`, `:7`, `:560`, `:412` |
| Reflection | | `:425` |

Verdict family (`standards/architecture/GLOSSARY.md:578-586`):

| Concern | Canonical stem | Owner |
|---|---|---|
| Shape validity | `ShapeValidationResult` | the schema-owning domain |
| Anchor fidelity | `AnchorVerificationResult` | `@beep/provenance` |
| Semantic stance | `SemanticStance` | epistemic domain |
| Source authority | `SourceAuthorityAssessment` | the consuming legal/domain slice |
| Human decision | `HumanDisposition` stem; domain-qualified concretes (e.g. `ClaimDisposition`) | the domain owning the reviewed subject |
| Action authorization | `ExecutionVerdict` | governed-execution boundary |
| Release | `ReleaseDisposition` | the release-owning boundary |

> "**Law:** names may be shared; vocabularies stay decentralized. Structural verification lives with the structure it verifies; human dispositions with the reviewed subject; authorization at the enforcement boundary... Uniform `...Verdict` naming is rejected: it erases the distinction between validation, classification, assessment, recorded disposition, authorization, and release." (`standards/architecture/GLOSSARY.md:588-594`)

**Not defined anywhere in the glossary:** Claim, Proposition, Evidence, Party, Ontology, Vocabulary (semantic sense), Knowledge Graph, Span, Annotation, Mention, IRI, Taxonomy, Citation, Agent. This is verified by reading the whole file; the glossary has no agent or ontology entries at all. For a stack whose stated aim is ontological grounding, this is the largest documentary gap.

There is no separate naming standard under `standards/`. Naming rules live in `standards/ARCHITECTURE.md:539-551`, `:1015-1057`, the `2026-04-23` ruling, and the `@category` vocabulary in `.patterns/jsdoc-documentation.md` (closed list; "Data boundaries: `validation`, `parsing`, `encoding`, `decoding`, `serialization`, `codecs`..." at `:403-404`).

---

## 4. `.patterns/`

Files: `README.md`, `effect-library-development.md`, `effect-module-paths.md`, `error-handling.md`, `jsdoc-documentation.md`, `module-organization.md`, `testing-patterns.md`. **There is no standalone schema-first pattern here.** Schema-first lives in `standards/schema-first-development-prompt.md` and the skill.

**Schema-first** (`standards/schema-first-development-prompt.md`):
1. Creed: "The schema is truth. Behavior precipitates from the data." (`:42`)
2. "the model owns the facts that define valid data, and downstream behavior derives from those facts instead of recreating them" (`:44-46`).
3. Mirrored by `standards/ARCHITECTURE.md:122` and `AGENTS.md:125`; a worked Opaque example is at `.patterns/effect-library-development.md:432-446`.

**effect-module-paths** (`.patterns/effect-module-paths.md`):
1. Import every Effect module from its dedicated public leaf path (`:3-6`).
2. Effect #8354 moved the former `unstable` subpath of `effect` to top-level paths with no re-exports (`:10-14`); validate against the installed package, "never from memory."
3. `@stability unstable` is no reason to avoid a module: use it "instead of hand-rolling what it provides" (`:42-45`). Enforced by `bun run beep laws retired-effect-paths --check`.

**jsdoc-documentation** (`.patterns/jsdoc-documentation.md`):
1. Binding law: every public export has a lead description, canonical `@category`, `@since 0.0.0`, and value-level exports require an Example (`:15-21`).
2. Fixed section order: `**When to use**`, `**Details**`, `**Gotchas**`, `**Example** (Title)` (`:33-38`).
3. Examples compile through docgen; `@remarks` and `@example` are forbidden (`:21`, `:53-54`).

**Modeling, codecs, brands and vocabularies:** no pattern file addresses modeling packages or vocabularies. `module-organization.md` is explicitly an *upstream Effect* reference (`.patterns/README.md:9-10`, `.patterns/module-organization.md:1-3`). Brand guidance appears only in examples (`.patterns/effect-library-development.md:433-446`). LiteralKit appears in `.patterns/error-handling.md:75-248`. Property-testing law is `standards/architecture/08-testing.md:46-50`, `:106-109`: "Schema-derived property tests complement fixtures... sharpen the production schema or its source-schema arbitrary annotation."

---

## 5. Explorations and goals

### `explorations/README.md`

"`goals/` answers 'build this.' `explorations/` answers 'help me crystallize this.'... Nothing here is doctrine; crystallized product prose graduates to `docs/product/`, implementation contracts graduate to `goals/<slug>/`." (`explorations/README.md:8-12`)

- Six stages: capture, research, align, shape, decompose, graduate (`explorations/README.md:73-80`).
- Graduation contract at `explorations/README.md:166`.
- Statuses: active, parked, graduated, killed; "Killing an idea is a successful outcome" (`explorations/README.md:105-108`).

### `explorations/INBOX.md`

The only knowledge-relevant bullet is the TTL→Effect-Schema codegen pipeline (`explorations/INBOX.md:11-22`). It flags synthetic JSON-Schema discriminators, a hand-rolled `namedNode` that should mint through `CoreVocab`, and "the same decision table in opposite directions" between import and export. It recommends one shared range-policy module. **This is directly relevant to a rebuild.**

### Explorations touching this space

Stage and status come from each README's lines 6-7. Lines below name the packet README.

| Slug | Stage / status | One line |
|---|---|---|
| `knowledge-endgame` | capture / parked | Four-part thesis: join layer over five ratified laws; practice-as-repo with ontologies as the type system; agents as FDEs; clone-and-go distribution (`:14-20`). Reopen goes through grill. |
| `knowledge-workspace` | capture / parked | Event-journal-backed knowledge workspace vision. |
| `semantic-agent-graph-stack` | research / **active** | Ontology, KG, memory graph, context graph, GraphRAG and decision-model patterns "under different names"; asks which bricks already cover them. Open: first consumer. |
| `auto-ontology-comparison` | research / parked | "Retain Beep's architecture and test specific integration hypotheses" before adopting NVIDIA Auto Ontology or Ossie. |
| `effect-ontology-harvest` | align / parked | Harvest patterns from effect-ontology `@core-v2`, not a wholesale port. |
| `ontology-agent-surface` | graduate / graduated | Curated MCP surface over ontology plumbing. |
| `ontology-curation-governance` | capture / parked | Accept, decline, exclude, quarantine; no direct generated DELETE/INSERT. |
| `ontology-lifecycle-qa` | capture / parked | Versioned induced shapes with triple-level witnesses. |
| `legal-ontology-landscape` | graduate / graduated | Ground legal semantics in reusable ontologies "without coupling... to a premature graph store." |
| `legal-inference-policy` | capture / parked | Observed, extracted and inferred edges stay distinct; retain derivation DAGs. |
| `legal-position-relator-runtime` | graduate / graduated | Closed structural core for legal domain. |
| `lynx-lkg-ontology-grounding` | graduate / graduated | Lynx Legal KG ontology grounding. |
| `identity-as-iri` | graduate / graduated | Identity path and IRI as two literal-typed encodings of one value. |
| `document-structure-ontologies` | graduate / graduated | DOCO/PO "near-isomorphic to the recursive tagged unions in `@beep/md`, `@beep/pandoc-ast`, and `@beep/lexical-schema`" (`:14-16`). |
| `epistemic-belief-view-revision` | graduate / graduated | Into `goals/belief-view-engine` (paused). Source of the verdict law. |
| `evidence-source-policy-calibration` | shape / parked | Five confidence signals stay separate typed fields; "collapsing them into one score" destroys meaning (`:14`). |
| `citation-grounding-hallucination-guard` | graduate / graduated | Never cite from memory; verbatim-verified grounding span. |
| `research-library-ontology` | graduate / graduated | Second research aggregation and gated 2-hop intake. |
| `research-corpus-synthesis` | graduate / graduated | External reference library plus evidence-bound exploration. |
| `semantica-lab` | graduate / graduated | Port atlas; second graduation 2026-09-03. |
| `rag-retrieval-projection` | graduate / graduated | RRF candidate seam "that cannot bypass `ClaimGate`." |
| `verification-route` | graduate / graduated | Compute affected checks over the dependency graph. |
| `typed-agent-skill-contracts` | graduate / graduated | `@beep/skill-contract`; reopened at decompose. |
| `project-intelligence` | capture / parked | Deterministic evidence-bearing landscape loop. |
| `protocol-as-value` | shape / **active** | "programs live in the same value universe as data"; journal, register, fold and digest unification. |
| `graphnosis-prior-art` | graduate / graduated | Into contradiction detection and governance laws. |
| `execution-authority-home` | graduate / graduated | Applied the 10-21 "misfiled" note. |
| `nlp-annotation-family` | **unscaffolded** | Untracked in this worktree: only `assets/.gitkeep` and `research/SOURCES.md` (a blank template). No README, manifest or decisions yet. The current lane. |

Others with a direct bearing: `claim-element-graph`, `court-vocabulary-resolver`, `deterministic-doc-structure-extraction`, `legal-patent-kg-deepening`, `harvey-lab-firm-knowledge` (all graduate), `academia-corpus-mining` (align).

### Goals (lifecycle from README `Lifecycle:` line)

**Foundation of this stack**

| Slug | Lifecycle | Purpose |
|---|---|---|
| `nlp-adjunct-port` | completed-retained | "The upstream half of the IP-law 'AI stack': a product-neutral NLP capability (`@beep/nlp`)..." (`:12`) |
| `identity-iri-core` | completed-retained | IRI core. |
| `identity-iri-fibered` | completed-retained | Fibered identity. |
| `identity-iri-fold` | completed-retained | "Repopulate `@beep/ontology` around the split authoring surface". |
| `provenance-shared-claim-kernel` | completed-retained | "Make the `epistemic` boundary consumable by a second vertical." |
| `epistemics-foundation-extraction` | completed-retained | The extraction ruled on 10-21. |
| `citation-verified-span-substrate` | completed-retained, archived | `VerifiedTextAnchor` substrate. |
| `spar-document-annotation-wire` | completed-retained | Pinned DOCO/DEO/FaBiO/CiTO terms; typed OA/PROV wire. |
| `pandoc-ast-foundation` | completed-retained | |
| `rich-text-foundation` | completed-retained | |
| `document-ast-pattern-classification` | completed-retained | |
| `langextract-capability` | completed-retained | `@beep/langextract`. |
| `effect-schema-parity` | completed-retained | Applies upstream-first to `@beep/schema`. |
| `schema-opaque-default` | completed-retained | |
| `literal-kit-subset-algebra` | completed-retained | |
| `research-library-ontology-core` | completed-retained | |

**Ontology and semantica**

| Slug | Lifecycle |
|---|---|
| `ontology-workbench`, `ontology-workbench-migration`, `ontology-agent-surface`, `ontology-interop-roadmap` | completed-retained |
| `ontology-sidecar-stateless-identity` | active |
| `semantica-canary` | completed-retained |
| `semantica-atlas-sync`, `semantica-storage-inversion`, `semantica-reasoning-spike` | active |
| `ciops-ontology-pipeline` | completed-retained |
| `trustgraph-doc-ontology` | reference |

**Epistemic slice**: `epistemic-bitemporal-edge-core`, `epistemic-claim-lifecycle-gate`, `epistemic-contradiction-detection`, `epistemic-contradiction-triage`, `epistemic-memory-retention-projections`, `epistemic-retention-policy-calibration`, `party-slice`, `agent-execution-authority` (all completed-retained); `execution-authority-slice`, `agentic-governance-laws` (active); `belief-view-engine` (paused).

**Law-practice consumers**:

- Active: `citation-extraction-engine`, `claim-check-performance`, `legal-document-intake`, `uspto-prosecution-read`, `lejeune-demo-corpus-and-ontology`.
- Paused: `attributed-multi-claim-span`, `effect-native-legal-eval`, `lejeune-knowledge-desk-lab`.
- Completed-retained: `claim-element-antecedent-check`, `legal-position-relator-runtime`, `patent-citation-candor-gate`, `patent-document-schema`, `practice-document-identification`, `practice-kg-mcp`, `law-practice-office-action-*`.

**Agents as users**: `skill-contract-kernel`, `mcp-kit`, `mcp-stateless-kit-and-drivers`, `mcp-host-retrofit`, `gov-legal-mcp`, `uspto-mcp`, `m365-mcp`, `practice-kg-mcp`, `practice-kg-mcp-strict-tier` (completed-retained); `skill-contract-gate-certificates`, `t3code-harness-mcp` (active).

**Research intake**: `research-intake-2026-11` (active): "T1/T2/T3 mining into CiTO-typed, SKOS-routed findings" (`goals/research-intake-2026-11/README.md:11`).

---

## 6. Vision documents

`docs/PROSE_TO_PROOF_VISION.md`:

- "**Prose in, proof out.**" "Obsidian for lawyers — but it proves its sources." (`:3-5`)
- "A solo IP attorney's whole practice... flows through **one local machine** that reads the prose, **proposes** structured claims about it, **proves** those claims sound against a formal legal ontology, and admits only what survives into **one knowledge graph where every fact carries a link back to the exact words that justify it.**" (`:15`)
- "Father built the knowledge. Son builds the machine that makes it legible... **We dogfood our own product**" (`:29`)
- "There are **two families** of computation, and they must never be confused" (`:35`). "**The retrieval family — *proposes*, fallibly.**" (`:37`) "**The logic family — *proves*, soundly.** A formal ontology and a reasoner compute what *follows*: consequences true in every model" (`:38`)
- "Between them sits **the boundary** — the one place where *confidence becomes provenance*." (`:40`)
- "The deepest invariant, stated as a single test: *does anything compute an entailment?*... The surface form (triples, RDF, a graph database) never tells you which family you're in." (`:42`)
- Grounded against "FOLIO, BFO, LKIF-Core, the WEMI/LRMoo document model, ODRL, CPC/IPC" (`:50`).
- "**Not an autonomous lawyer.** Agents *propose*. The attorney *approves*." (`:57`)
- Principles (`:62-66`): local-first with every matter walled; "The file is canonical"; the editor is a portal; "Nothing is asserted without a source. A **character span** is the provenance link"; "Retrieval proposes, logic proves... The boundary is sacred."
- Local-first language is superseded as architecture. See section 8, C9.

`docs/product/citation-grounding.md`:

- "**Ground before cite.** No citation or quotation reaches legal work product unless identified source text verifies the exact raw span it would emit." (`:3-4`)
- "Machine output therefore has zero citation authority." (`:22`)
- Status: "Ratified product doctrine (2026-07-14)" (`:6`).

`docs/product/workspace-substrate.md`:

- "**agents are first-class workspace operators.** Not a future consequence — a design requirement." (`:38`)
- "Mouse gestures and agents are two clients of one kernel." (`:42`)

`docs/ROADMAP.md`:

- "The MCP surface is thesis, not shim: Claude Desktop is client #1; Word/Outlook/cron/background agents are the same consumer." (`:135-137`)
- This file is "the **only cross-portfolio priority layer**" (`:27`). Freshness 2026-10-05, older than several rulings.

`docs/BEEPGRAPH_ARCHITECTURE.md`:

- "*EO is the spine; TG is the shell.*" (`:28`). "monoid-fold merge" is listed as a strength (`:20`, `:146`). Status: "Proposed" (`:4`).

`packages/foundation/modeling/nlp/THEORY.md`:

- "`@beep/nlp` treats natural-language annotation as **algebra over a typed text graph**: text strata are objects, NLP operations are morphisms, structure-building and projection passes come in law-checked pairs, and every law is a machine-checked **proof** (FastCheck property test)." (`:3-6`)
- "The headline claim is *full categorical fidelity*: the elegance is not decoration, it is the load-bearing structure." (`:9-10`)
- The IR "is deliberately the **free object**" (`:139-140`).

`explorations/knowledge-endgame/CAPTURE.md`:

- "the tip-of-tongue thing is the **join layer** over records that exist but cannot be dereferenced across subsystem boundaries. Independence proof: producers reinvent PROV shapes without importing `Prov.ts`... 'the unifying move is mapping, not a fifth schema family'" (`:84-90`). Five laws start at `:90`.
- "**the developer's environment is the first agent-native knowledge substrate; generalize it.** Practice-as-repo" (`:153-154`).

---

## 7. The owner's philosophy, verbatim

**Schema is truth**

- "The schema is truth. Behavior precipitates from the data." (`standards/schema-first-development-prompt.md:42`)
- "For pure data models, `Schema` is the source of truth." (`standards/ARCHITECTURE.md:122`)
- Out-of-repo memory: "this is the through-line of the user's whole engineering philosophy ('the schema is truth, behavior precipitates from the data' = the universal property of the initial algebra)" (`~/.claude/memory/beep-effect/effect-schema-is-applied-category-theory.md:34`).

**Category theory**

- This session's request, from the owner: "I like the category theoretic grounding of `@beep/nlp` quite a lot... To me this creates beautiful, robust, provable, testable & scalable code."
- Out-of-repo memory maps endofunctors to schema layers, initial algebras to `S.suspend`, catamorphisms to `Match.tagsExhaustive` folds, and optics to `{decode, encode}`. Same file, lines 15-24. It cites arXiv 2402.15332.
- In-repo: `packages/foundation/modeling/nlp/THEORY.md:3-13`.
- `INFERENCE`: `packages/foundation/modeling/nlp/THEORY.md` is the only in-repo document with categorical grounding. `standards/` has none. A keyword scan for "category theor", "functor", "catamorph" and "initial algebra" across `standards/`, `docs/` and `.patterns/` returned nothing beyond "monoid" in `docs/BEEPGRAPH_ARCHITECTURE.md`. So the philosophy the owner most values is not doctrine anywhere.

**Laws and property tests**

- "every law is a machine-checked **proof** (FastCheck property test)" (`packages/foundation/modeling/nlp/THEORY.md:5-6`).
- "Schema-modeled laws: pass production Schemas to `it.prop`..." (`standards/architecture/08-testing.md:46-48`).
- "Lossiness laws are algebraic facts, not test trivia." (same memory file)

**Consistency over philosophy**

- Out-of-repo memory: "He rejected exactly that question with 'whatever is more consistent'... Save grill questions for genuine branch-points where the codebase is silent or self-contradictory." (`~/.claude/memory/beep-effect/decide-by-consistency-not-philosophy.md`)
- `standards/architecture/00-philosophy.md`: "high modularity + consistent topology > low ceremony + improvised structure"; "The point is not purity for its own sake. The point is preserving optionality." (read in full; opening "beep-effect wants a repo where experimentation is cheap and quality is not.")
- **Tension worth naming:** the owner's new request explicitly asks for first-principles challenge of "semantics, names, design, architecture, documentation, theory, syntax, api, dependencies & overall taste." The consistency rule governs abstract forks on existing conventions. This request reopens the conventions. `INFERENCE`: this request outranks the memory for this scope, but consistency should still resolve small forks within the new design.

**Upstream-first**

- "a local concept that shadows an upstream one is a second owner for one capability, and it has to be re-audited on every Effect snapshot bump." (`standards/architecture/DECISIONS.md:2070-2072`)
- "Never hand-roll what an Effect module provides" (`AGENTS.md:134`).

**No inventory growth (S31)**

- "operator S31 forbids new debt and exception entries even for legitimate cases... the normal resolution is a check improvement with zero inventory growth." (`goals/repository-simplification-confidence/SPEC.md:1682-1690`)
- Out-of-repo: "The bar is introduced=0, and a PR that grows an inventory is not final." (`~/.claude/memory/beep-effect/feedback-no-inventory-growth-s31.md`)

**Agents as first-class users**

- "**agents are first-class workspace operators.**" (`docs/product/workspace-substrate.md:38`)
- "agents are the same consumer" (`docs/ROADMAP.md:137`)
- "gives agents a much smaller navigation surface" (`standards/architecture/DECISIONS.md` 2026-05-22 entry, `:919` ff.)
- The operator charter says agents decide and keep moving, escalating only money (`AGENTS.md:167-168`).
- Note: the *owner's request* lists "tools & things that agents can use", but the architecture has no agent-as-user concept. See section 1.

**Design before implementation**

- Out-of-repo, verbatim: "we start with data model / schema design then effect/Context service design only then do we go to implementation." (`~/.claude/rules/effect-coding-standards.md`)
- Out-of-repo: "I break work down by capability" and "I like to design the sub-parts & schemas for things before I begin product work." (`~/.claude/rules/working-style.md`)
- Out-of-repo: "I greatly appreciate it when I'm challenged and tought about things though a lens I can understand (types, schemas, flows, diagrams, visualizations)." (same)
- In-repo pipeline: `explorations/README.md:8-12`.

**Determinism and truth**

- "The deterministic-first, semantic-as-managed-cache, and provenance-verification **principles remain binding**." (`standards/memory-architecture/04-decision-log.md:218-219`)

**Fail closed**

- "An absent, ambiguous, stale, unverifiable, or cross-matter anchor fails closed" (`docs/product/citation-grounding.md:22-24`).

---

## 8. Conflicts

**C1. "Domain-agnostic foundation" versus legal seeds inside `@beep/ontology` (real, direct).**
- Rule: foundation is "domain-agnostic" (`standards/ARCHITECTURE.md:54`, `:177`; `standards/architecture/GLOSSARY.md:186`). Product semantics go to the owning slice (`standards/ARCHITECTURE.md:491`). "law-practice keeps `LegalRole`" (`standards/architecture/DECISIONS.md:2322`). The package README itself claims: "domain-agnostic ontology... Vendor-specific identities and alignment decisions stay in their owning asset packs or product slices" (`packages/foundation/modeling/ontology/README.md:8-11`).
- Code: `packages/foundation/modeling/ontology/src/Vocabulary.seed.ts` (514 lines) ships `DocketingVocabulary` (`:22`), "Patent office-action response deadline" (`:71`), USPTO MPEP source IRIs (`:34`, `:84`, `:104`), 86 matching lines for patent, legal, attorney, court, uspto, statute or law. README: "`docketing`, `party-kinds` and `legal-roles` schemes... 25, 6 and 11 concepts" (`:85-87`). Seed files include `legal-intake.ttl` and `party-roles.ttl` under `packages/foundation/modeling/ontology/src/seed/`. IPC and CPC parsing is at `packages/foundation/modeling/ontology/src/internal/ClassificationXml.ts:46`, `:72`.

**C2. Plain-data Opaque rule versus `S.Class` in text primitives (partial).**
- Rule: `standards/architecture/DECISIONS.md:2147-2165`.
- `packages/foundation/modeling/provenance/src/TextAnchor.ts:156` is `S.Class` with only statics in the first 45 lines of the body. Statics are allowed on Opaque, so A search of `packages/**/*.ts` found no `TextAnchor.extend`, `extends TextAnchor` or `TextAnchor.fields`. `INFERENCE`: the canonical provenance value looks like a plain-data class the rule says should be Opaque. I did not check the rest of its body past those 45 lines.
- `packages/foundation/modeling/nlp/src/Core/Token.ts:215` has an instance getter, so `S.Class` is compliant.
- `packages/foundation/modeling/nlp/src/Handoff/Contract.ts:213` is `S.Class<SpanFields, {}>`, an inventoried structural-brand exception (`standards/schema-first.inventory.jsonc:649-650`). The rule requires this exception to be documented, so it complies, though it counts against shrinking the inventory.

**C3. Canonical anchors versus actual topology (real).**
- Rule: `*.schema.ts`, `*.brand.ts`, `*.codec.ts` (`standards/ARCHITECTURE.md:717`).
- Code across the seven packages: 0 `.brand.ts`, 0 `.codec.ts`, 1 `.schema.ts` (rdf). Across all 32 modeling packages, 44 of 50 suffixed files are in `@beep/schema`. Actual shapes: flat PascalCase (`packages/foundation/modeling/provenance/src/TextAnchor.ts`), `.model.ts` borrowed from slice grammar (`packages/foundation/modeling/md/src/Md.model.ts`; 15 in epistemics), and a non-canonical plural (`packages/foundation/modeling/ontology/src/Fold.models.ts`). I found no ruling canonizing these "package-specific role files".
- `INFERENCE`: the anchor describes `@beep/schema`, not the family.

**C4. Verdict law versus the code and versus the 10-21 ruling (real).**
- Six of the eight stems searched have zero hits under `packages/**/*.ts`: `ShapeValidationResult`, `AnchorVerificationResult`, `SemanticStance`, `SourceAuthorityAssessment`, `HumanDisposition`, `ReleaseDisposition`. Only `ClaimDisposition` and `ExecutionVerdict` exist. `INFERENCE`: `belief-view-engine` is paused, so a "ratified" law has no implementation.
- Rule says "Uniform `...Verdict` naming is rejected" (`standards/architecture/GLOSSARY.md:592-594`), yet `packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts:157` exports `StructuralVerdict`, and `standards/architecture/DECISIONS.md:2297` calls it "claim gate verdict."
- "human dispositions [live] with the reviewed subject" (`standards/architecture/GLOSSARY.md:590-591`) versus a foundation-level `packages/foundation/modeling/epistemics/src/ClaimDispositionStatus/`. The entity stays in the slice per `standards/architecture/DECISIONS.md:2302-2304`, but the status vocabulary is in foundation.

**C5. "Canonical" span versus five span encodings (real).**
- Rule: "The canonical shape is `TextAnchor`" (`standards/architecture/GLOSSARY.md:302`).
- Code:
  - `packages/foundation/modeling/provenance/src/TextAnchor.ts:156` (`startChar`/`endChar`/`quote`)
  - `packages/foundation/modeling/nlp/src/Graph/Schema.ts:358` (`Span`)
  - `packages/foundation/modeling/nlp/src/Handoff/Contract.ts:216-249` (`start`/`end`)
  - `packages/foundation/modeling/rdf/src/Evidence.ts:78-122` (`TextQuoteSelector`, `TextPositionSelector` with `start`) and `EvidenceAnchor` at `:290`
  - `packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts:60-138`
  - `packages/foundation/modeling/epistemics/src/EvidenceSpan/EvidenceSpan.model.ts:147`
- `@beep/nlp` imports none of provenance, rdf, epistemics or ontology (`rg` empty across `packages/foundation/modeling/nlp/src`). `@beep/provenance` and `@beep/epistemics` import neither nlp nor rdf.
- The vision doc names a *different* canonical: `GroundedExtraction.span` in `packages/foundation/capability/langextract` (`docs/PROSE_TO_PROOF_VISION.md:65`).
- `packages/foundation/modeling/nlp/THEORY.md:139` describes `Provenance` as carrying `confidence`, against "no confidence" (`standards/architecture/GLOSSARY.md:304`).

**C6. One word, several meanings (real).**
- **Provenance:** RequestContext (`standards/ARCHITECTURE.md:1762`), text anchor (`standards/architecture/GLOSSARY.md:299`), PROV-O (`packages/foundation/modeling/rdf/src/Prov.ts`), NLP handoff (`packages/foundation/modeling/nlp/THEORY.md:139`). Also: producers "reinvent PROV shapes" (`explorations/knowledge-endgame/CAPTURE.md:86`).
- **Ontology:** `@beep/ontology` foundation, `packages/ontology/*` slice (`packages/foundation/modeling/ontology/README.md:18-20`), `packages/foundation/modeling/nlp/src/Ontology/Kind.ts` ("Type-level ontology of text-processing categories"), and a vision-level OWL TBox (`docs/PROSE_TO_PROOF_VISION.md:38`).
- **Vocabulary:** filename roles (`standards/ARCHITECTURE.md:1017`), SKOS (`packages/foundation/modeling/ontology/src/Vocabulary.seed.ts:2`), epistemic value types (`standards/architecture/DECISIONS.md:2296`), `packages/foundation/modeling/identity/src/Vocab.ts`, `packages/foundation/modeling/rdf/src/Vocab/`.
- **Claim:** `Claim<P>` epistemic, patent claim (`explorations/identity-as-iri/README.md:14`), and doc examples in `packages/foundation/modeling/ontology/src/Fold.projections.ts:228`.
- **Model:** `.model.ts` versus `Domain.Model` (`standards/architecture/GLOSSARY.md:286`).
- The glossary resolves none of these.

**C7. Upstream-first versus hand-rolled algebra (candidate, needs a census).**
- Rule: `standards/architecture/DECISIONS.md:2034-2043`.
- `packages/foundation/modeling/nlp/src/Algebra/Monoid.ts` is "Algebraic monoid primitives and reusable instances" (`:2`), importing only `@beep/utils`, `effect/Function`, `effect/HashMap` and `effect/HashSet` (`:8-11`). The installed `effect` ships `dist/Combiner.d.ts` and `dist/Reducer.d.ts`. `INFERENCE`: coverage is unverified and I saw no census. This is the first thing upstream-first demands before keeping or rebuilding that module. `effect/Graph` *is* reused (`packages/foundation/modeling/nlp/src/Graph/GraphOps.ts:30`), which is compliant.
- **Scope gap:** the brief's "upstream-first versus hand-rolled vocab" is not strictly a conflict. The ruling covers upstream *Effect* only. **No ruling requires reuse of W3C or OBO standards**, even though vision grounds on FOLIO, BFO and LKIF (`docs/PROSE_TO_PROOF_VISION.md:50`). That is a doctrine gap to fill.

**C8. S31 versus package count (not a conflict; correct the frame).**
- S31 forbids growing `standards/` debt inventories (`goals/repository-simplification-confidence/SPEC.md:1682-1690`). It isn't in `DECISIONS.md` at all. It constrains a rebuild through its bar on new exceptions, not through package count.
- The real package-growth constraint is `standards/ARCHITECTURE.md:353-362` ("Do not create packages only for symmetry") and `standards/ARCHITECTURE.md:509` ("Reusable shape alone is not enough", for capability).
- Count: 32 modeling packages, 15 capability, 197 workspace `package.json` files. `INFERENCE`: many sit beside each other without a ruled stack order.

**C9. Local-first vision versus withdrawn local-only framing (real; high risk of being inherited by accident).**
- Vision: "Not a cloud SaaS. Local-first, on device by default... Embeddings are computed locally" (`docs/PROSE_TO_PROOF_VISION.md:55`), principle 1 (`:62`), "everything on device" (`:94`), "one local machine" (`:15`). Also `docs/product/prose-to-proof.md` summary.
- Later, out-of-repo rule (`~/.claude/rules/oip-confidentiality.md`, revised 2026-08-17): "It does not require local models, on-device inference, or offline operation. Do not derive 'local-only'... Product direction is the opposite: **quality first, hosted providers welcome**"; "That framing is withdrawn."
- So a rebuild must not treat on-device as an architectural constraint. The vision docs have not been updated. Corpus-out-of-repo (`docs/PROSE_TO_PROOF_VISION.md:58`) stays binding.

**C10. Theory document and doc drift (real).**
- `packages/foundation/modeling/nlp/THEORY.md:72` cites `src/Graph/TypeClass.ts`. `packages/foundation/modeling/nlp/src/Graph/` holds only `GraphOps.ts`, `index.ts`, `Schema.ts`.
- `packages/foundation/modeling/nlp/THEORY.md:141`, `:193` and `goals/nlp-adjunct-port/README.md` point to `ip-law-knowledge-graph` as the owner of the interpretation functor. That packet is deleted (`docs/ROADMAP.md:133`, and `goals/ip-law-knowledge-graph` does not exist). **The downstream half of the headline "free object" claim therefore has no owner.**
- `packages/foundation/modeling/nlp/THEORY.md:144` says "any KG schema factors through it uniquely"; `INFERENCE`: nothing in the repo tests that universal property.
- `packages/foundation/modeling/rdf/src/Prov.ts:2` still says `@beep/semantic-web`.
- `docs/PROSE_TO_PROOF_VISION.md:50` and `docs/BEEPGRAPH_ARCHITECTURE.md:191` cite `@beep/epistemic-domain` for what the 10-21 ruling split.
- `docs/PROSE_TO_PROOF_VISION.md:90` calls BeepGraph "settled"; `docs/BEEPGRAPH_ARCHITECTURE.md:4` says "Proposed".

**C11. Kind ambiguity for `@beep/nlp` (real).**
- `packages/foundation/modeling/nlp/package.json` declares `modeling`; `goals/nlp-adjunct-port/README.md:12` calls it "a product-neutral NLP capability." THEORY treats backends as functors with `@beep/wink` as the driver (`packages/foundation/modeling/nlp/THEORY.md:126`).
- `foundation/capability/{nlp-processing,langextract,semantic-web}` exist alongside. `INFERENCE`: the modeling and capability boundary has never been ruled for the text stack. `capability` is unreachable from slice `domain` (`standards/ARCHITECTURE.md:686-687`), so this choice has real consequences.

**C12. Architecture dependency versus semantic layering (design pressure, not a violation).**
- `packages/foundation/modeling/rdf/src/Adapters/MdSections.ts:8` imports `@beep/md` from `@beep/rdf`. This is legal (modeling may depend on modeling, `standards/ARCHITECTURE.md:620`).
- `INFERENCE`: a graph-model package depends on one document format. With a ruled stack order this would likely invert or move to an adapter.

**C13. Factories as a TypeScript workaround (design pressure).**
- The 10-22 amendment forces generic builders because of TS2509 and because foundation may not depend on shared-kernel ids (`standards/architecture/DECISIONS.md:2347-2361`). Each slice re-declares classes. `INFERENCE`: this combines with the Opaque rule to push against a clean parametric `Claim<P>`; a rebuild proposing a different encoding must keep byte-identical identifiers or stage a migration.

**C14. Log ordering (minor).** `## Known Unknowns` sits at `standards/architecture/DECISIONS.md:2099` with later dated entries after it, and entries are out of date order overall, so "latest ruling" must be read by date, not position.

---

## 9. Closing lists

### Binding constraints for a rebuild

1. **Architecture is amended, not bypassed.** `standards/ARCHITECTURE.md:3-7`.
2. **Foundation is domain-agnostic; no product semantics.** `standards/ARCHITECTURE.md:54`, `:177`, `:491`.
3. **Foundation never depends on slices or the shared kernel.** `standards/ARCHITECTURE.md:705-707`; re-affirmed by 2026-10-22 amendment, `standards/architecture/DECISIONS.md:2347-2351`.
4. **Slice `domain` may import only shared-kernel plus `primitive` or `modeling`.** `standards/ARCHITECTURE.md:278-282`; 2026-06-18, `standards/architecture/DECISIONS.md:953`.
5. **Modeling depends only on primitive and modeling.** `standards/ARCHITECTURE.md:620`.
6. **No slice-to-slice imports;** events, promoted contracts, or foundation-mediated ports only. `standards/ARCHITECTURE.md:698-702`; 2026-07-25, `standards/architecture/DECISIONS.md:1103`.
7. **Three-tier routing:** substrate to `foundation/modeling`, shared vocabulary to `shared/domain` with a record, mechanism stays in the slice. 2026-06-18, `standards/architecture/DECISIONS.md:953`.
8. **Epistemic split:** tenant-free vocabulary in `@beep/epistemics`, product entities in the slice, `ClaimLifecycle` in shared. 2026-10-21, `standards/architecture/DECISIONS.md:2290`.
9. **Propositions are slice-owned; "no central proposition union exists in `shared`".** 2026-10-21, `standards/architecture/DECISIONS.md:2322-2326`.
10. **Party is a product slice; law-practice keeps `LegalRole`.** 2026-10-21, `standards/architecture/DECISIONS.md:2316-2322`.
11. **Tenant-free is not enough:** id-bearing values need builders or a different id home. 2026-10-22, `standards/architecture/DECISIONS.md:2347`.
12. **Upstream-first, facet census, same PR, no alias, byte-identical encodings.** 2026-09-29 and 2026-10-22, `standards/architecture/DECISIONS.md:2028`, `:2365`.
13. **Finite cases are tagged unions.** 2026-05-09, `standards/architecture/DECISIONS.md:815`.
14. **Plain data is branded `S.Opaque`; class only where allowed.** 2026-10-14, `standards/architecture/DECISIONS.md:2141`.
15. **Derived equivalence; no class-level `toEquivalence`.** 2026-09-12, `standards/architecture/DECISIONS.md:1422`.
16. **Named literal domains use `LiteralKit` (ADAPT).** 2026-09-29, `standards/architecture/DECISIONS.md:2083-2088`; `standards/ARCHITECTURE.md:817`.
17. **Identity authority is `https://beep-effect.com/ns/`, IRIs only from `@beep/identity`, `/ns/` reserved forever.** 2026-10-20, `standards/architecture/DECISIONS.md:2228`; `standards/ARCHITECTURE.md:197-206`.
18. **Verdict law:** names shared, vocabularies decentralized, no uniform `...Verdict`. 2026-08-17, `standards/architecture/GLOSSARY.md:573-594`.
19. **Event-sourced slices on alchemy; streams are system of record; no shared facade; entity kit frozen.** 2026-11-06, `standards/architecture/DECISIONS.md:2541`.
20. **Ground before cite; fail closed; zero citation authority for machine output.** 2026-07-14 product doctrine, `docs/product/citation-grounding.md:3-6`, `:22`.
21. **Deterministic-first, semantic memory as managed cache, provenance verification.** 2026-06-17, `standards/memory-architecture/04-decision-log.md:218-219`; 2026-04-15, `:347`.
22. **Corpus and client data stay out of the repo.** `docs/PROSE_TO_PROOF_VISION.md:58`; `~/.claude/rules/oip-confidentiality.md` Rule 1.
23. **No exception or debt inventory growth (S31).** 2026-10-15, `goals/repository-simplification-confidence/SPEC.md:1682`.
24. **Packages only via `bun run beep create-package`; no symmetry packages.** `AGENTS.md` Discovery & Reuse; `standards/ARCHITECTURE.md:353-362`.
25. **JSDoc law; compiled examples; closed `@category` list.** `.patterns/jsdoc-documentation.md:15-21`, `AGENTS.md` Code Laws.
26. **Effect v4 leaf-path imports; effect helper modules; `HashMap`/`HashSet`.** `.patterns/effect-module-paths.md:3-6`; `AGENTS.md:125-134`; `~/.claude/rules/effect-coding-standards.md`.
27. **Design order: schema, then `Context.Service` contract, then implementation.** `~/.claude/rules/effect-coding-standards.md`; explorations pipeline.
28. **Agents propose, attorney approves.** `docs/PROSE_TO_PROOF_VISION.md:57`.

### Amendable by a new ruling

Each of these needs a decision, and most have no ruling to overturn at all.

1. **Text-stack package boundaries and order** (identity, rdf, provenance, epistemics, ontology, nlp, md; merge or split). No current ruling besides the epistemic split. Amend `standards/ARCHITECTURE.md` and add a DECISIONS entry.
2. **Where legal vocabulary seeds live** (C1). Either move to law-practice or an asset pack, which applies existing law, or explicitly rule that public standard vocabularies count as domain-agnostic substrate.
3. **`foundation/modeling` file anchors** (C3). Either enforce them or canonize `<Concept>/<Concept>.model.ts`.
4. **`@beep/nlp`: modeling or capability** (C11). Must weigh the `domain` import restriction.
5. **A single canonical span** (C5). The glossary already names `TextAnchor`; the code hasn't complied. Ruling a selector algebra (quote, position, fragment) would amend the glossary's "canonical shape".
6. **Glossary terms** for Claim, Proposition, Evidence, Party, Ontology, Vocabulary, Span, Annotation, Knowledge Graph, Agent, and disambiguation for Provenance and Claim (C6). Additive, no conflict.
7. **Verdict stems** (C4). Rename `StructuralVerdict`, implement or retire unimplemented stems, decide whether `ClaimDispositionStatus` stays in foundation.
8. **Standards-reuse rule** (C7). Extend "upstream-first" beyond Effect to W3C, OBO and legal ontologies; today no doctrine exists.
9. **Category theory as doctrine.** Today only `packages/foundation/modeling/nlp/THEORY.md` and out-of-repo memory state it. Requires a new `standards/architecture/` chapter and a law on what counts as a proof.
10. **Epistemic builder pattern** (C13). The 10-21 ruling gives its own reversal: "moving the shared-domain id brands into foundation and collapsing the builders back into concrete schemas."
11. **Local-first posture in vision docs** (C9). Rewrite the docs; no architecture ruling is needed because the framing is already withdrawn.
12. **BeepGraph's "Proposed" status and THEORY's dead owner** (C10).
13. **Agent-as-user in the constitution.** Currently only in product docs.

**Mechanism:**

- A started goal's decisions: `bun run beep goals decisions add <slug> --title "..." --reversal "..."`, one file under `goals/<slug>/decisions/` (`AGENTS.md:167-172`). Never append to `SPEC.md`'s tail.
- Architecture-wide policy: a dated entry in `standards/architecture/DECISIONS.md`, per its header ("Amend this file when the standard changes", `:3-4`), with status and a reversal clause, plus edits to `standards/ARCHITECTURE.md`.
- Fuzzy-to-real pipeline: `/explore` drives `explorations/<slug>/` through capture, research, align (`DECISIONS.md`, one question at a time), shape (`BRIEF.md`), decompose (`MAP.md`), then graduate after definition-of-ready: "brief complete, no open questions, map names goals, capabilities cited" (`explorations/README.md:53`, `:73-80`, `:166`). No-gos become SPEC non-goals; vision prose goes to `docs/product/`.
- Direction-setting decisions go through `/grill-with-docs` first (`AGENTS.md` Guided Closeout). The architecture grilling uses the standard, glossary and decision log.
- Retirement of existing modeling concepts follows `standards/architecture/11-evolution-and-deprecation.md:109-178`; a census is required before a RETIRE over 100 consumers. Only money escalates to the operator (`AGENTS.md:167`), but this request's scope is the owner's own, so direction should be aligned with them first (`INFERENCE`).
