/**
 * Minimal decoded SCIP index document and symbol liveness vocabulary used by
 * the symbol resolver port.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import { LiteralKit, PosixPath, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $AgentMemoryStoreId.create("Scip.models");

/**
 * Fully qualified SCIP symbol string.
 *
 * **Example** (Brand a SCIP symbol)
 *
 * ```ts
 * import { ScipSymbol } from "@beep/agent-memory-store"
 *
 * console.log(ScipSymbol.make("scip-typescript npm @beep/schema 0.0.0 src/`Sha256.ts`/Sha256Hex."))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScipSymbol = S.NonEmptyString.pipe(
  S.brand("ScipSymbol"),
  $I.annoteSchema("ScipSymbol", {
    description: "Fully qualified SCIP symbol string.",
  })
);

/**
 * Runtime type for {@link ScipSymbol}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ScipSymbol = typeof ScipSymbol.Type;

/**
 * Zero-based line and character range of a SCIP occurrence.
 *
 * **Example** (Construct a one-line range)
 *
 * ```ts
 * import { ScipRange } from "@beep/agent-memory-store"
 *
 * const range = ScipRange.make({ startLine: 3, startCharacter: 13, endLine: 3, endCharacter: 22 })
 * console.log(range.endCharacter - range.startCharacter)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScipRange extends S.Opaque<ScipRange, { readonly brand: unique symbol }>()(
  S.Struct({
    startLine: S.Natural.annotateKey({ description: "Zero-based start line." }),
    startCharacter: S.Natural.annotateKey({ description: "Zero-based start character." }),
    endLine: S.Natural.annotateKey({ description: "Zero-based end line." }),
    endCharacter: S.Natural.annotateKey({ description: "Zero-based exclusive end character." }),
  }).pipe(
    $I.annoteSchema("ScipRange", {
      description: "Zero-based line and character range of a SCIP occurrence.",
    })
  )
) {}

/**
 * Role a SCIP occurrence plays for its symbol.
 *
 * **Example** (Check an occurrence role)
 *
 * ```ts
 * import { ScipOccurrenceRole } from "@beep/agent-memory-store"
 *
 * console.log(ScipOccurrenceRole.is.definition("definition"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScipOccurrenceRole = LiteralKit(["definition", "import", "reference", "writeAccess", "readAccess"]).pipe(
  $I.annoteSchema("ScipOccurrenceRole", {
    description: "Role a SCIP occurrence plays for its symbol.",
  })
);

/**
 * Runtime type for {@link ScipOccurrenceRole}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ScipOccurrenceRole = typeof ScipOccurrenceRole.Type;

/**
 * One occurrence of a symbol in a SCIP document.
 *
 * **Example** (Read the fields of an occurrence)
 *
 * ```ts
 * import { ScipOccurrence } from "@beep/agent-memory-store"
 *
 * console.log(ScipOccurrence.fields.roles)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScipOccurrence extends S.Opaque<ScipOccurrence, { readonly brand: unique symbol }>()(
  S.Struct({
    symbol: ScipSymbol.annotateKey({ description: "Symbol the occurrence refers to." }),
    range: ScipRange.annotateKey({ description: "Source range of the occurrence." }),
    roles: S.Array(ScipOccurrenceRole).annotateKey({ description: "Roles the occurrence plays." }),
  }).pipe(
    $I.annoteSchema("ScipOccurrence", {
      description: "One occurrence of a symbol in a SCIP document.",
    })
  )
) {}

/**
 * One source file of a SCIP index with its occurrences.
 *
 * **Example** (Construct an empty document)
 *
 * ```ts
 * import { ScipDocument } from "@beep/agent-memory-store"
 * import { PosixPath } from "@beep/schema"
 *
 * const document = ScipDocument.make({ relativePath: PosixPath.make("src/index.ts"), occurrences: [] })
 * console.log(document.relativePath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScipDocument extends S.Opaque<ScipDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    relativePath: PosixPath.annotateKey({ description: "Source path relative to the index root." }),
    occurrences: S.Array(ScipOccurrence).annotateKey({ description: "Symbol occurrences in the file." }),
  }).pipe(
    $I.annoteSchema("ScipDocument", {
      description: "One source file of a SCIP index with its occurrences.",
    })
  )
) {}

/**
 * Minimal decoded SCIP index: documents plus the producing tool.
 *
 * **Example** (Construct an empty index)
 *
 * ```ts
 * import { ScipIndex } from "@beep/agent-memory-store"
 *
 * const index = ScipIndex.make({ documents: [], toolName: "scip-typescript", toolVersion: "0.4.0" })
 * console.log(index.toolName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScipIndex extends S.Opaque<ScipIndex, { readonly brand: unique symbol }>()(
  S.Struct({
    documents: S.Array(ScipDocument).annotateKey({ description: "Indexed source documents." }),
    toolName: S.NonEmptyString.annotateKey({ description: "Name of the indexer that produced the index." }),
    toolVersion: S.NonEmptyString.annotateKey({ description: "Version of the indexer." }),
  }).pipe(
    $I.annoteSchema("ScipIndex", {
      description: "Minimal decoded SCIP index: documents plus the producing tool.",
    })
  )
) {}

/**
 * Liveness verdict for a symbol a note references.
 *
 * **Details**
 *
 * Decision `symbol-resolver-port-scip-driver-p3`: SCIP resolves identity; a
 * normalized span hash mismatch yields `reverify`, never a staleness verdict
 * (S35: 109/129 hash flags were on intact claims).
 *
 * **Example** (Check a liveness verdict)
 *
 * ```ts
 * import { SymbolLiveness } from "@beep/agent-memory-store"
 *
 * console.log(SymbolLiveness.is.reverify("reverify"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SymbolLiveness = LiteralKit(["live", "reverify", "unresolved"]).pipe(
  $I.annoteSchema("SymbolLiveness", {
    description: "Liveness verdict for a symbol a note references.",
  })
);

/**
 * Runtime type for {@link SymbolLiveness}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SymbolLiveness = typeof SymbolLiveness.Type;

/**
 * A note's reference to a code symbol with the hash of the span it described.
 *
 * **Example** (Reference a symbol)
 *
 * ```ts
 * import { ScipSymbol, SymbolReference } from "@beep/agent-memory-store"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const reference = SymbolReference.make({
 *   symbol: ScipSymbol.make("scip-typescript npm @beep/schema 0.0.0 src/`Sha256.ts`/Sha256Hex."),
 *   spanHash: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 * })
 * console.log(reference.symbol)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SymbolReference extends S.Opaque<SymbolReference, { readonly brand: unique symbol }>()(
  S.Struct({
    symbol: ScipSymbol.annotateKey({ description: "Referenced SCIP symbol." }),
    spanHash: Sha256Hex.annotateKey({ description: "Normalized hash of the symbol span the note described." }),
  }).pipe(
    $I.annoteSchema("SymbolReference", {
      description: "A note's reference to a code symbol with the hash of the span it described.",
    })
  )
) {}

/**
 * Where SCIP says a symbol is defined: the document and the occurrence range.
 *
 * **Example** (Locate a definition)
 *
 * ```ts
 * import { ScipDefinition, ScipRange } from "@beep/agent-memory-store"
 * import { PosixPath } from "@beep/schema"
 *
 * const definition = ScipDefinition.make({
 *   relativePath: PosixPath.make("src/Sha256.ts"),
 *   range: ScipRange.make({ startLine: 3, startCharacter: 13, endLine: 3, endCharacter: 22 }),
 * })
 * console.log(definition.relativePath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScipDefinition extends S.Opaque<ScipDefinition, { readonly brand: unique symbol }>()(
  S.Struct({
    relativePath: PosixPath.annotateKey({ description: "Document holding the defining occurrence." }),
    range: ScipRange.annotateKey({ description: "Range of the defining occurrence." }),
  }).pipe(
    $I.annoteSchema("ScipDefinition", {
      description: "Where SCIP says a symbol is defined: the document and the occurrence range.",
    })
  )
) {}

/**
 * Resolution of one symbol reference, discriminated on `liveness`.
 *
 * **Details**
 *
 * Decision `symbol-resolver-port-scip-driver-p3`: the resolver returns symbol
 * identity plus a re-verify flag.
 *
 * - `live`: SCIP defines the symbol and the normalized span hash still
 *   matches. `definition` says where the symbol lives now, which is how a
 *   renamed or moved target is followed (S7 renamed stratum).
 * - `reverify`: SCIP defines the symbol but the span hash changed. The note
 *   is re-verified, never marked stale (S35); both hashes are kept.
 * - `unresolved`: SCIP has no definition of the symbol.
 *
 * **Example** (Report a symbol that needs re-verification)
 *
 * ```ts
 * import { ScipDefinition, ScipRange, ScipSymbol, SymbolResolution } from "@beep/agent-memory-store"
 * import { PosixPath, Sha256Hex } from "@beep/schema"
 *
 * const resolution = SymbolResolution.cases.reverify.make({
 *   symbol: ScipSymbol.make("scip-typescript npm @beep/schema 0.0.0 src/`Sha256.ts`/Sha256Hex."),
 *   definition: ScipDefinition.make({
 *     relativePath: PosixPath.make("src/Sha256.ts"),
 *     range: ScipRange.make({ startLine: 3, startCharacter: 13, endLine: 3, endCharacter: 22 }),
 *   }),
 *   expectedSpanHash: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   actualSpanHash: Sha256Hex.make("1111111111111111111111111111111111111111111111111111111111111111"),
 * })
 * console.log(resolution.liveness)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SymbolResolution = SymbolLiveness.toTaggedUnion("liveness")({
  live: {
    symbol: ScipSymbol.annotateKey({ description: "Resolved symbol." }),
    definition: ScipDefinition.annotateKey({ description: "Where the symbol is defined now." }),
  },
  reverify: {
    symbol: ScipSymbol.annotateKey({ description: "Resolved symbol." }),
    definition: ScipDefinition.annotateKey({ description: "Where the symbol is defined now." }),
    expectedSpanHash: Sha256Hex.annotateKey({ description: "Span hash the note recorded." }),
    actualSpanHash: Sha256Hex.annotateKey({ description: "Span hash of the current definition." }),
  },
  unresolved: {
    symbol: ScipSymbol.annotateKey({ description: "Requested symbol SCIP does not define." }),
  },
}).pipe(
  $I.annoteSchema("SymbolResolution", {
    description: "Resolution of one symbol reference, discriminated on liveness.",
  })
);

/**
 * Runtime type for {@link SymbolResolution}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SymbolResolution = typeof SymbolResolution.Type;
