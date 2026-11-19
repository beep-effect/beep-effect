/**
 * P0 design module of the text-knowledge stack rebuild: the section 4
 * sketches of `research/2026-11-08-rebuild-report.md` as compiling Effect v4
 * schemas, checked against the installed effect 4.1.4.
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
 * Bodies written as `declare const` are signatures only (resolve, reanchor,
 * unit conversion, the L3 audit and coherence check, grounding verification,
 * dataset canonicalization and isomorphism, and the OA codec). Everything
 * else has a real implementation, including merge, restrict, closure,
 * containment, the claim log checker and the retraction closure.
 *
 * Layer edges used here: L1 -> L0; L2 -> L0, L1; L3 -> L0 and
 * `@beep/epistemics` (`makeSignal`, `Measurement`), an ontology -> epistemics
 * edge that decision 2026-11-19-p0-census-dispositions removes in P4 by moving them to `@beep/schema`; L4 -> L0, L1; L5 -> L0; L6 -> L0, L2.
 * L0 is split by dependency: `L0.identity.ts` imports only effect and
 * `@beep/identity` (the RFC 3987 schemas included, `@beep/identity/Iri`);
 * `L0.digest.ts` may import `@beep/schema` and `@beep/jsonc`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/** Composed `Arbitrary` prototypes for the annotation document and the claim log. */
export * as Generators from "./generators.ts";
/** L0 digest (`@beep/schema`, `@beep/jsonc`): digest brands, the set codec, minting, the activity id. */
export * as L0Digest from "./L0.digest.ts";
/** L0 identity (`@beep/identity`): term IRIs, code ids, namespaces, terms, bindings, deprecations, the snapshot. */
export * as L0 from "./L0.identity.ts";
/** L1 text: occurrence identity, selectors, resolution, re-anchoring, `Anchored`. */
export * as L1 from "./L1.text.ts";
/** L2 annotation: kind registry, document ingredients, merge, restrict, closure, refusals. */
export * as L2 from "./L2.annotation.ts";
/** L3 taxonomy: SSSOM mapping sets, gUFO audit and coherence signatures. */
export * as L3 from "./L3.taxonomy.ts";
/** L4 claims: core, stance, challenge, admission, retraction, assessments, gates, log checker. */
export * as L4 from "./L4.claims.ts";
/** L5 operations: operations, activities, composition, provenance wrapper. */
export * as L5 from "./L5.operations.ts";
/** L6 interchange: three-case literal, dataset quotient and digest, OA profile and import result. */
export * as L6 from "./L6.interchange.ts";
