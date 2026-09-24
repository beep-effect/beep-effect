# Instance

- id: `knowledge-ref-candidate`
- file:line: `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts:2261`
- symbol: private `RefCandidate`
- members: `kind`, `patternContext`, `pairingAmbiguous`, `ungoverned`, `anchor`, `token`, `slug`, `normalized`
- source: `f137beedb270a071d4aa2ecc1dd52a9d233044d1`
- disposition: replace the stale D1 census row with a designed Tier 1 qualification; independent P3 remains pending.

# Current shape

`RefCandidate` (2261-2276) is the private carrier between extraction and observation construction. It stores the public four-member `KnowledgeRefKind`, three booleans, four independent `Option` payload slots, common location/surface/identity metadata, and an existing `KnowledgeRef` union. The kind domain includes reserved `upstream` (57-71), but the actual nested reference union has only host, repository and goal members (617-623). The candidate itself is neither exported nor encoded.

The old D1 rationale says the facts are independent because pattern context and ungoverned syntax can coexist. That proves only one pair is independent. It does not justify the whole bag: no producer sets pairing ambiguity and ungoverned syntax together, and both bits control payload absence. Preserve independent `patternContext` rather than replacing it with a status.

# Cardinality gap

The selected abstraction is `(kind, patternContext, pairingAmbiguous, ungoverned, anchor presence, token presence, slug presence, normalized presence)`. Every combination is representable in the declared TypeScript carrier: **4 × 2³ × 2⁴ = 512**. It has exactly **10** source-produced abstract tuples:

| Writer case | Kind | pairingAmbiguous | ungoverned | anchor | token | slug | normalized | patternContext |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Host | host-path | false | false | Some | Some | None | None | false or true |
| Governed repository | repo-path | false | false | None | None | None | Some | false or true |
| Ungoverned repository | repo-path | false | true | None | None | None | None | false or true |
| Paired/direct goal | goal-uri | false | false | None | None | Some | None | false or true |
| Ambiguous goal | goal-uri | true | false | None | None | None | None | false or true |

The proof is the complete producer set: `hostCandidates` 2512-2535, `repoPathCandidateRefs` 2622-2651, and `goalUriCandidate` 2668-2692. Direct goal URI parsing (2694-2709) always selects paired; beep annotations (2711-2751) select paired or ambiguous using the ratified pairing grammar. The ignored repo outcome produces no candidate. There is no upstream writer.

Both pattern values are feasible in every row. Plain host text versus an `rg ` prefix provides the host witnesses. Plain inline `docs/README.md` versus `rg ` followed by that inline span provides governed repo witnesses; inline `../../etc/passwd` in `docs/guide.md`, with and without the same prefix, supplies ungoverned ones. `repo://goal/example` with/without the prefix supplies paired goal cases. An orphan `<!-- beep:ref goal/example -->`, with/without the prefix and with no preceding heading or display path, supplies ambiguous cases. Prefixing outside the inline span does not turn the span into a command span. These are source-derived witnesses, not claims of executed fixtures.

`384/10` describes only the three emitted-kind slice; it omits the fourth kind admitted by the declaration. Metadata and payload values, including the already-unioned nested `ref`, are deliberately excluded from this finite projection. The nested ref kind can also disagree with the current outer kind; the design removes that duplication, but does not multiply this additional flaw into the recorded count. The ten states are not a claim about the number of concrete objects or nested display-path values.

E3: normalized presence duplicates the repo governance flag (2648); goal slug presence duplicates inverse pairing ambiguity (2690). E2: resolution reads normalized first, then slug, then falls back to not-applicable (2952-2957), relying on their exclusivity. The classifier projection at 2958-2967 forwards the kind-specific flag/payload bag without proving it.

# Target schema

Use a private five-member schema union. Reuse the existing `KnowledgeHostPathRef`, `KnowledgeRepoPathRef`, `KnowledgeGoalUriRef`, `KnowledgeRefSurface`, `$I`, and schema primitives. Do not introduce another exported reference domain, ref compatibility layer, or copy the nested wire schemas.

The private variant kit is `LiteralKit(["Host", "GovernedRepo", "UngovernedRepo", "PairedGoal", "AmbiguousGoal"])`. Each member is an `S.Class` with `state: S.tag(...)`, the common fields below, and its exact existing reference member. Assemble those classes through the kit's `.mapMembers(...)` and `Tuple.evolve(...)`, annotate the union, then apply `S.toTaggedUnion("state")`; retain only `type RefCandidate = typeof RefCandidate.Type` as the private alias. Constructors use `RefCandidate.cases.<case>.make(...)` without manually supplying the defaulted tag. Consumers use the schema-derived `.match` and `.guards`; no handwritten type predicates.

| Member | Required payload schema | Common fields |
| --- | --- | --- |
| Host | `ref: KnowledgeHostPathRef` | subject, documentPath, line, column, surface, patternContext |
| GovernedRepo | `ref: KnowledgeRepoPathRef` | same |
| UngovernedRepo | `ref: KnowledgeRepoPathRef` | same |
| PairedGoal | `ref: KnowledgeGoalUriRef` | same |
| AmbiguousGoal | `ref: KnowledgeGoalUriRef` | same |

Common fields use `S.String` for existing string metadata, `S.Number` for existing number metadata, `KnowledgeRefSurface` for surface and `S.Boolean` for the independent pattern fact. This migration does not add new validation to extracted coordinates or widen package exports. The resulting object remains private and unencoded, so field annotations and local class identity do not alter report JSON.

Remove outer `kind` entirely: use `candidate.ref.kind` for ordering and identities. Remove `anchor`/`token` because Host already requires `ref.anchor` and `ref.raw`; the writer supplies exactly the same match values to both today. Remove `normalized` because GovernedRepo supplies `ref.normalized` directly, while UngovernedRepo must never resolve that best-effort cleaned spelling. Remove `slug` because PairedGoal supplies `ref.slug`, while AmbiguousGoal must never load a manifest. Remove both correlated booleans; the member tag determines those cases. Retain patternContext in every member, even where the current classifier ignores it.

Do not infer pairing from `ref.displayPath`: a valid heading-scoped pairing has no display path. Retain `goalUriRef` and its current omission semantics, including no display path for ambiguous annotations. The existing nested public ref schemas stay unchanged.

# Migration inventory

All source anchors are in `Knowledge.refs.ts` unless another path is named.

1. **Carrier 2261-2276:** replace the type-literal bag with the private classes/kit/union in the same module; no new role file or public export. Keep common metadata unchanged.
2. **Host writer 2512-2535:** construct Host with the existing `KnowledgeHostPathRef.make`, metadata, normalized subject and computed pattern context. Remove both fixed-false writes and all four Option writes. Do not change verified generated-evidence pattern detection or host extraction ordering.
3. **Repository writer 2622-2651:** match the existing `RepoPathOutcome` discriminator. Ignored still contributes no candidate; governed constructs GovernedRepo; ungoverned constructs UngovernedRepo. Reuse both outcome values for `subject` and nested `ref.normalized` exactly as before. Delete the intermediate `ungoverned` boolean and its normalized-presence ternary. Do not change grammar, root-escape or best-effort spelling handling at 2240-2258.
4. **Goal writer 2668-2692:** construct PairedGoal or AmbiguousGoal directly when the parser decides the pairing. Replace the private boolean argument with a private LiteralKit pairing choice or construct in the callers; do not export it. This function flag is changed only as a dependent write-site migration, not admitted as a new inventory owner. Reuse `goalUriRef`; remove four Option slots and the slug-presence ternary.
5. **Goal callers 2694-2751:** direct URI always creates PairedGoal. Beep annotations preserve the existing A1 rule, heading-scope logic, sole-display-path rule and ambiguity computation, then select the appropriate case. The valid/ambiguous displayPath behavior remains exact. Keep parser conditionals that establish grammar; these are not carrier coherence guards.
6. **Collection 2753-2779 and 2919-2942:** keep host extraction on every elected file, Markdown/prose restrictions for repo/goal refs, line offset tracking, generated evidence checks and chunk flattening. Only the carried type changes.
7. **Sorting 2841-2847:** replace the kind projection with `candidate.ref.kind`. Preserve comparison order documentPath, line, column, kind, subject. Never sort by the new five-way state tag.
8. **Goal pre-resolution 2944-2948:** collect slugs solely from PairedGoal with the derived guard/match, then preserve dedupe, lexicographic sort and sequential resolution. Ambiguous refs containing a nested slug must still cause no goal manifest read.
9. **Resolution 2951-2957:** exhaustive match: GovernedRepo resolves `ref.normalized`; PairedGoal looks up its already computed slug resolution; Host, UngovernedRepo and AmbiguousGoal yield NotApplicable. Preserve a missing cache entry's existing NotApplicable fallback unless the existing map is separately modeled/proved total; do not introduce a new throw. This retains the real fallback without restoring the four-slot bag.
10. **Classification 2958-2967:** use the candidate match to construct the existing public `KnowledgeRefClassificationInput` directly at this call. Host passes Some(ref.anchor)/Some(ref.raw), no grammar flags. GovernedRepo has both flags false; UngovernedRepo sets only ungoverned. PairedGoal has both false; AmbiguousGoal sets only pairingAmbiguous. Non-host anchor/token stay None. Forward surface, independent patternContext and the computed resolution status unchanged. The existing public input still requires the three boolean fields: this projection deliberately reconstructs them at that boundary, so it is not credited as deleting those public fields. This is an existing broader public function's input, not a new compatibility model. Do not narrow or rewrite that separate owner in this design.
11. **Observation/identity 2968-2997:** use `ref.kind` wherever outer kind was used; preserve normalized documentId, subject strings, occurrence key preimages, duplicate ordinal allocation, refId preimages, location, remediation and existing nested ref values. Observation/report schemas and encoding remain untouched.

Repository-wide symbol lookup and local member-access search find no other candidate construction, mutation, storage, export or reader. `RefCandidate` array/type positions and sorted sequential `toObservation` execution are included above. The exported ClassificationInput is a separate broader owner and is not assumed to acquire candidate-only invariants.

# Guard-deletion accounting

| Current site | Deleted obligation | Replacement |
| --- | --- | --- |
| 2529-2534 | Host fixed-false flags and four Option slots | Host case and existing required nested ref payload |
| 2633,2643-2648 | Re-derive governance bit, synchronize it with normalized absence and non-host slots | Match RepoPathOutcome into one candidate case |
| 2686-2691 | Synchronize pairing bit with slug absence and forbidden payload slots | PairedGoal/AmbiguousGoal constructors |
| 2944 | Read slug Option from every kind and drop None | Select PairedGoal and read required nested slug |
| 2952-2957 | Optional normalized-first/slug-second cascade re-derives which resolution operation is legal | Exhaustive member dispatch |
| 2845,2959,2969,2972 | Maintain outer kind in agreement with nested ref kind | One authoritative ref.kind |
| 2962-2966 | Reading unconstrained stored candidate fields for the classifier | Case-scoped projection to the existing public bag; its three booleans and host Options remain required and are not counted as deleted |

The kind-specific documentation at 1847-1850 belongs to public ClassificationInput; do not claim to delete it. Public classifier fallback guards at 1960-1987 remain outside this owner. Parser grammar conditions, missing tracked-target checks, absent-cache fallback and operational error handling remain real runtime decisions.

# Encoded-side impact

Tier 1, internal derived carrier. There is no candidate codec today, persistence writer, RPC/MCP request or public constructor. Its only terminal consumer creates `KnowledgeRefObservation` at 2973; the wire-compatible `KnowledgeRef` members (525-597), resolution schemas and report schema are retained verbatim. Candidate members now have schema encoders in principle, but no writer uses them; do not add one.

The compatibility obligation is **byte-identical report JSON and identical refId/occurrence identities**, not preservation of an invented candidate JSON encoding. Preserve raw strings, best-effort ungoverned normalized strings, optional goal displayPath omission, Unicode subject normalization, sort order, report metadata, classifications and remediation text. No compatibility codec or public aliases are necessary. The exported classifier's current accepted inputs remain untouched.

# Error and ordering contract

Goal manifests are resolved once per deduplicated sorted PairedGoal slug before candidate sorting and observation construction (2944-2948). Preserve this read/failure ordering; moving manifest IO into per-candidate matching would change both repetition and failure order. Preserve resolver behavior at 2810-2839: untracked/nonregular manifests are missing without reading; malformed UTF-8, unparseable JSON and invalid manifest schemas fail operationally; declared-id mismatch is its existing resolution.

Ordinary document UTF-8 failures are skipped (2921-2928), while generated-evidence inspection remains at 2934-2940. Governed repo resolution remains the path-index/directory-prefix/producer-registry decision at 2781-2804. Ungoverned spellings and ambiguous goal refs remain NotApplicable even when their nested payload happens to name an existing target. No new IO, schema decoding of trusted extracted candidates, error recovery or completion behavior is introduced.

# Test impact

Use the existing public scanner fixture harness in `packages/tooling/tool/cli/test/knowledge-refs.test.ts`; do not export RefCandidate solely to test it. Existing coverage anchors:

- 173-225: governed/missing relative paths, root escape, links, producer-owned targets.
- 375-409: host conventions, archival provenance, pattern precedence and fenced host references.
- 419-499: resolved/mismatched/missing goal identities, paired display paths, heading scope, multiple and orphan ambiguity.
- 503 onward: duplicate ordinals and identity preimages.
- 647-704: deterministic byte-identical output under entry permutation; symlink/gitlink behavior.
- 772-808: public classifier precedence and manifest operational failures.
- 1090-1290: verified generated-evidence pattern classification and fail-closed provenance handling.

At P4 add the ten source-derived witnesses above to the scanner fixture matrix and compare full encoded observations/report bytes against the pre-migration baseline, not only classifications. Include an existing target behind an ungoverned spelling and an unreadable/malformed manifest behind ambiguous refs to prove forbidden resolution does not happen. Include a direct goal URI with a display tail and a heading-scoped valid pairing without a display path so absence cannot become an ambiguity heuristic. Count manifest reads across duplicate valid references and verify stable sorted failure order. Keep the public classifier tests unchanged under this owner.

After implementation, run the focused knowledge refs suite and full `bun run beep quality package-verify @beep/repo-cli`, then the campaign's canonical Yeet gates. This P2 pass ran no implementation tests or package verification; its proof is current-source audit and a finite enumeration of the selected source-derived tuples, recorded separately.

# Risk & sequencing

This newly qualified private carrier is independent of any decision about the broader exported classifier API. Land its classes, three writers, parser call sites, resolution/ordering/identity readers and scanner tests atomically in the Tier 1 internal tooling batch after independent P3/GATE 2. The principal risks are accidentally resolving ambiguous/ungoverned targets, changing manifest IO order, changing refId sort/preimage semantics, and assuming displayPath absence means ambiguity. The design explicitly preserves each contract.
