import { $TestUtilsId } from "@beep/identity/packages";
import * as Conformance from "@beep/schema/Conformance";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as S from "effect/Schema";

const $I = $TestUtilsId.create("ConformanceLedger");
const strictDecodeOptions = { errors: "all", onExcessProperty: "error" } as const;

const LedgerHeader = S.Struct({
  schemaVersion: S.Literal(1),
  packageName: S.NonEmptyString,
  profileIds: S.NonEmptyArray(S.NonEmptyString),
}).pipe(
  $I.annoteSchema("LedgerHeader", {
    description: "Package and profile identity shared by every conformance-ledger document.",
  })
);

const SourcesLedger = S.Struct({
  ...LedgerHeader.fields,
  sources: S.NonEmptyArray(Conformance.SpecificationSource),
  profiles: S.NonEmptyArray(Conformance.ConformanceProfile),
}).pipe(
  SchemaUtils.withStatics((schema) => {
    const fromJson = S.fromJsonString(schema);
    return {
      decodeUnknownEffectFromJsonString: S.decodeUnknownEffect(fromJson),
    };
  }),
  $I.annoteSchema("SourcesLedger", {
    description: "Package-owned source and conformance-profile registries.",
  })
);

const InventoryKind = LiteralKit([
  "ast-member",
  "block-ast-member",
  "conforming-ast-member",
  "document-ast-member",
  "element-ast-member",
  "future-block-ast-member",
  "future-inline-ast-member",
  "future-metadata-ast-member",
  "inline-ast-member",
  "inner-tagged-union",
  "inner-tagged-union-candidate",
  "internal-tagged-union",
  "leaf-ast-member",
  "literal-domain",
  "lossless-wire-union",
  "metadata-ast-member",
  "nested-ast-member",
  "obsolete-ast-member",
  "reviewed-candidate",
  "reviewed-existing-design",
  "reviewed-non-candidate",
  "root-ast-envelope",
  "root-ast-member",
  "structural-ast-component",
  "tagged-union",
]).pipe(
  $I.annoteSchema("InventoryKind", {
    description: "Closed semantic roles used by the four document-model conformance inventories.",
  })
);

const InventoryDiscriminator = LiteralKit([
  "_tag",
  "checked",
  "headerRow",
  "headerState",
  "kind",
  "level",
  "listType",
  "literal value",
  "mathType",
  "mode",
  "none",
  "quoteType",
  "state",
  "style",
  "t",
  "tag",
  "type",
]).pipe(
  $I.annoteSchema("InventoryDiscriminator", {
    description: "Closed discriminator descriptions recorded by the current conformance inventories.",
  })
);

const InventoryEnforcementLayer = LiteralKit(["type", "decode", "tree", "adapter"]).pipe(
  $I.annoteSchema("InventoryEnforcementLayer", {
    description: "Implementation boundaries at which an inventory member is currently constrained.",
  })
);

const CandidateDisposition = LiteralKit([
  "add-flat-tagged-view",
  "evaluate-after-source-refresh",
  "evaluate-after-upstream-parity",
  "migrate-flat-view-to-tagged-union",
  "migrate-to-tagged-union",
  "retain-bit-state",
  "retain-boolean-field",
  "retain-existing-tagged-member",
  "retain-existing-tagged-union",
  "retain-integer-and-constrain-in-adapter",
  "retain-literal-domain",
  "retain-literal-domains",
  "retain-literal-token-list",
  "retain-open-string-domain",
  "retain-open-wire",
  "retain-structural-schema",
  "retain-structured-envelope",
]).pipe(
  $I.annoteSchema("CandidateDisposition", {
    description: "Closed migration decisions applied to inventoried discriminatable variants.",
  })
);

const InventoryItem = S.Struct({
  id: S.NonEmptyString,
  symbol: S.NonEmptyString,
  tag: S.NonEmptyString,
  kind: InventoryKind,
  existingDiscriminator: InventoryDiscriminator,
  currentEnforcementLayers: S.NonEmptyArray(InventoryEnforcementLayer),
  sources: S.NonEmptyArray(S.NonEmptyString),
  candidateDisposition: CandidateDisposition,
  candidateReason: S.NonEmptyString,
}).pipe(
  $I.annoteSchema("InventoryItem", {
    description: "Inventory identity and the registered sources supporting it.",
  })
);

const InventoryLedger = S.Struct({
  ...LedgerHeader.fields,
  items: S.NonEmptyArray(InventoryItem),
}).pipe(
  SchemaUtils.withStatics((schema) => {
    const fromJson = S.fromJsonString(schema);
    return {
      decodeUnknownEffectFromJsonString: S.decodeUnknownEffect(fromJson),
    };
  }),
  $I.annoteSchema("InventoryLedger", {
    description: "Package-owned public AST and TaggedUnion candidate inventory.",
  })
);

const InvariantsLedger = S.Struct({
  ...LedgerHeader.fields,
  invariants: S.NonEmptyArray(Conformance.InvariantDescriptor),
}).pipe(
  SchemaUtils.withStatics((schema) => {
    const fromJson = S.fromJsonString(schema);
    return {
      decodeUnknownEffectFromJsonString: S.decodeUnknownEffect(fromJson),
    };
  }),
  $I.annoteSchema("InvariantsLedger", {
    description: "Package-owned specification-backed invariant registry.",
  })
);

const CoverageStatus = LiteralKit(["covered", "partial", "cannotTell", "unsupportedProfile", "notApplicable"]).pipe(
  $I.annoteSchema("CoverageStatus", {
    description: "Closed implementation status recorded for invariant coverage.",
  })
);

const CoverageEntry = S.Struct({
  invariantId: S.NonEmptyString,
  profileIds: S.NonEmptyArray(S.NonEmptyString),
  currentEnforcement: S.NonEmptyArray(Conformance.InvariantEnforcement),
  targetEnforcement: S.NonEmptyArray(Conformance.InvariantEnforcement),
  positiveTestIds: S.Array(S.NonEmptyString),
  negativeTestIds: S.Array(S.NonEmptyString),
  status: CoverageStatus,
}).pipe(
  $I.annoteSchema("CoverageEntry", {
    description: "Current and target enforcement evidence for one registered invariant.",
  })
);

const CoverageLedger = S.Struct({
  ...LedgerHeader.fields,
  coverage: S.NonEmptyArray(CoverageEntry),
}).pipe(
  SchemaUtils.withStatics((schema) => {
    const fromJson = S.fromJsonString(schema);
    return {
      decodeUnknownEffectFromJsonString: S.decodeUnknownEffect(fromJson),
    };
  }),
  $I.annoteSchema("CoverageLedger", {
    description: "Package-owned invariant coverage and executable test evidence.",
  })
);

const decodeSourcesLedger = S.decodeUnknownEffect(S.fromJsonString(SourcesLedger), strictDecodeOptions);
const decodeInventoryLedger = S.decodeUnknownEffect(S.fromJsonString(InventoryLedger), strictDecodeOptions);
const decodeInvariantsLedger = S.decodeUnknownEffect(S.fromJsonString(InvariantsLedger), strictDecodeOptions);
const decodeCoverageLedger = S.decodeUnknownEffect(S.fromJsonString(CoverageLedger), strictDecodeOptions);
const decodeAnnotationType = S.decodeUnknownEffect(S.toType(Conformance.Annotation));
const sourceArrayEquivalence = S.toEquivalence(S.Array(Conformance.SpecificationSource));
const profileArrayEquivalence = S.toEquivalence(S.Array(Conformance.ConformanceProfile));
const invariantArrayEquivalence = S.toEquivalence(S.Array(Conformance.InvariantDescriptor));
const enforcementArrayEquivalence = S.toEquivalence(S.Array(Conformance.InvariantEnforcement));

/**
 * Schema, decoder, and equivalence internals shared by the conformance-ledger validators.
 *
 * **Example** (Recognize a ledger header)
 *
 * ```ts
 * import { conformanceLedgerSchemas } from "./ConformanceLedger.schema.ts"
 * import * as S from "effect/Schema"
 *
 * const isLedgerHeader = S.is(conformanceLedgerSchemas.LedgerHeader)
 * console.log(isLedgerHeader({ schemaVersion: 1, packageName: "@beep/example", profileIds: ["example"] }))
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const conformanceLedgerSchemas = {
  decodeAnnotationType,
  decodeCoverageLedger,
  decodeInvariantsLedger,
  decodeInventoryLedger,
  decodeSourcesLedger,
  enforcementArrayEquivalence,
  invariantArrayEquivalence,
  LedgerHeader,
  profileArrayEquivalence,
  sourceArrayEquivalence,
};
