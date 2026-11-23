/**
 * P0 design module of the text-knowledge stack rebuild: the section 4
 * sketches of `research/2026-11-08-rebuild-report.md` as compiling Effect v4
 * schemas, checked against the installed effect 4.1.5.
 *
 * This is a design artifact, not package code. Each phase moves its layer
 * into the owning package and deletes it here in the same PR, so the
 * directory is empty at P7 (decision
 * 2026-11-19-p0-design-module-home-and-effect-version).
 *
 * **Details**
 *
 * Checks: `bunx tsrs -p goals/tsconfig.ops.json --noEmit` (compiler) and
 * `bunx tsrs -p goals/text-knowledge-stack-rebuild/ops/design/tsconfig.json --noEmit`
 * (the package Effect language-service profile; zero diagnostics).
 *
 * Identity composer: every file mints its schema identities with
 * `$RepoCliId.create("goals/text-knowledge-stack-rebuild/ops/design/<file>")`,
 * the composer the existing goals ops scripts use. Known gap the owning
 * package closes: these identifiers and IRIs sit under `@beep/repo-cli`, not
 * under the package each layer moves to, so each phase re-annotates with that
 * package's composer when it moves the layer.
 *
 * Bodies written as `declare const` are signatures only (the L3 audit and
 * coherence check, dataset canonicalization and isomorphism). Annotation
 * operations, the OA codec, claim cores, the claim log checker, retraction
 * closure, admissions, assessments and the nanopublication codec live in
 * production.
 *
 * Layer edges used here: L3 -> `@beep/epistemics`; L5 -> none.
 * L2 and the OA codec moved to `@beep/annotation` in P3.
 * L4 left the design module in P4: `@beep/epistemics` owns `makeClaimCore`,
 * the claim log and its checker, `Admission`, `makeAssessments`, retraction
 * closure and the nanopublication codec (`@beep/epistemics/rdf/NanopubCodec`);
 * the coherent claim-log generators live in its test support.
 * L0 left the design module in P1. The identity layer is `@beep/identity`:
 * term IRIs, code ids, namespaces, terms, bindings, deprecations and the
 * snapshot are `@beep/identity/Term`, and the CURIE codec is
 * `@beep/identity/Registry`. The digest brands, the set codec and well-formed
 * text are `@beep/schema` (`ContentHash`, `CanonicalHashSet`,
 * `WellFormedText`), and minting and the activity id are `@beep/jsonc`
 * (`Mint`, `ActivityStart`).
 * L1 left the design module in P2: `@beep/text` owns `OffsetUnit`,
 * `Position`, unit conversion, `Selector`, `Resolution` and `resolve`,
 * `Anchored`, `OccurrenceId` and its `occurrence/v1` preimage, `QuoteKey`,
 * the two text normalizations, `LocatorMap` and `reanchor`, and the layers
 * here import them from its subpaths. Two shapes changed on the way: minting
 * an occurrence fails with `PreimageMintError` (a schema or canonicalization
 * error) instead of a canonicalization error alone, and `Reanchoring.to` is
 * the target capture's `Anchored`, not a second id (decision
 * 2026-11-22-p2-reanchoring-shape-and-lax-direction). The citation mention
 * preimage went to the law-practice server, not to `@beep/text`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/** L3 taxonomy: SSSOM mapping sets, gUFO audit and coherence signatures. */
export * as L3 from "./L3.taxonomy.ts";
/** L5 operations: operations, activities, composition, provenance wrapper. */
export * as L5 from "./L5.operations.ts";
/** L6 interchange: three-case literal, dataset quotient and digest. */
export * as L6 from "./L6.interchange.ts";
