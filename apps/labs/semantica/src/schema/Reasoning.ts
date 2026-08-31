import { $SemanticaId } from "@beep/identity/packages";
import { LiteralKit, PosInt, Sha256Hex } from "@beep/schema";
import { Equal, identity, Result, Tuple } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { contentDigestSync, digestOmittingSync } from "@/schema/Digest";
import { InferenceEventId, StatementId } from "@/schema/Ids";
import { C1EvalReport } from "@/schema/Projection";

const $I = $SemanticaId.create("schema/Reasoning");

/**
 * Canonical serialized RDF terms used by the C2 rule program.
 *
 * **Example** (Inspect the RDFS subclass term)
 *
 * ```ts
 * import { reasoningVocabulary } from "@/schema/Reasoning"
 *
 * console.log(reasoningVocabulary.rdfsSubClassOf.includes("subClassOf")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const reasoningVocabulary = {
  rdfType: "<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>",
  rdfsDomain: "<http://www.w3.org/2000/01/rdf-schema#domain>",
  rdfsRange: "<http://www.w3.org/2000/01/rdf-schema#range>",
  rdfsSubClassOf: "<http://www.w3.org/2000/01/rdf-schema#subClassOf>",
  rdfsSubPropertyOf: "<http://www.w3.org/2000/01/rdf-schema#subPropertyOf>",
  skosBroaderTransitive: "<http://www.w3.org/2004/02/skos/core#broaderTransitive>",
};

/** Rule identifiers for the six rho-df rules and explicit SKOS transitivity. */
const RdfsRuleId = LiteralKit(["rdfs2", "rdfs3", "rdfs5", "rdfs7", "rdfs9", "rdfs11", "skos-broader-transitive"]).pipe(
  $I.annoteSchema("RdfsRuleId", {
    description: "Stable identifiers for the complete C2 rule program.",
  })
);

/**
 * Decoded identifier from {@link RdfsRuleId}.
 *
 * @see {@link RdfsRuleId} for the runtime literal domain.
 * @category type-level
 * @since 0.0.0
 */
export type RdfsRuleId = typeof RdfsRuleId.Type;

const RuleVariable = LiteralKit(["s", "p", "o", "c", "d", "e", "q", "r", "m"]);

class ConstantTerm extends S.Class<ConstantTerm>($I`ConstantTerm`)(
  { kind: S.tag("Constant"), value: S.NonEmptyString },
  $I.annote("ConstantTerm", {
    description: "One exact serialized RDF term in a declarative rule pattern.",
  })
) {}

class VariableTerm extends S.Class<VariableTerm>($I`VariableTerm`)(
  { kind: S.tag("Variable"), name: RuleVariable },
  $I.annote("VariableTerm", {
    description: "One named binding slot in a declarative rule pattern.",
  })
) {}

const TermKind = LiteralKit(["Constant", "Variable"]);

const TermPattern = TermKind.mapMembers(Tuple.evolve([() => ConstantTerm, () => VariableTerm])).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("TermPattern", {
    description: "Constant-or-variable RDF term used by the generic C2 matcher.",
  })
);

type TermPattern = typeof TermPattern.Type;

class StatementPattern extends S.Class<StatementPattern>($I`StatementPattern`)(
  { subject: TermPattern, predicate: TermPattern, object: TermPattern },
  $I.annote("StatementPattern", {
    description: "Declarative subject-predicate-object pattern for one rule premise or conclusion.",
  })
) {}

/**
 * One declarative rule consumed by the generic naive fixpoint.
 *
 * **Details**
 *
 * Rules carry only data. Matching and instantiation belong to the Reasoner
 * Layer, so the committed program is inspectable and replay-stable.
 *
 * **Example** (Inspect a rule premise)
 *
 * ```ts
 * import { RDFS_RULES } from "@/schema/Reasoning"
 *
 * console.log(RDFS_RULES[0]?.id) // "rdfs2"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RdfsRule extends S.Class<RdfsRule>($I`RdfsRule`)(
  {
    id: RdfsRuleId,
    premises: S.NonEmptyArray(StatementPattern),
    conclusion: StatementPattern,
  },
  $I.annote("RdfsRule", {
    description: "A named rho-df or SKOS rule represented as premise and conclusion patterns.",
  })
) {}

const variable = (name: typeof RuleVariable.Type): VariableTerm => VariableTerm.make({ kind: "Variable", name });
const constant = (value: string): ConstantTerm => ConstantTerm.make({ kind: "Constant", value });
const pattern = (subject: TermPattern, predicate: TermPattern, object: TermPattern): StatementPattern =>
  StatementPattern.make({ subject, predicate, object });

const s = variable("s");
const p = variable("p");
const o = variable("o");
const c = variable("c");
const d = variable("d");
const e = variable("e");
const q = variable("q");
const r = variable("r");
const m = variable("m");
const rdfType = constant(reasoningVocabulary.rdfType);
const rdfsDomain = constant(reasoningVocabulary.rdfsDomain);
const rdfsRange = constant(reasoningVocabulary.rdfsRange);
const rdfsSubClassOf = constant(reasoningVocabulary.rdfsSubClassOf);
const rdfsSubPropertyOf = constant(reasoningVocabulary.rdfsSubPropertyOf);
const skosBroaderTransitive = constant(reasoningVocabulary.skosBroaderTransitive);

/**
 * Ordered C2 rule program: rdfs2, 3, 5, 7, 9, 11 and SKOS transitivity.
 *
 * **Example** (Inspect the complete rule set)
 *
 * ```ts
 * import { RDFS_RULES } from "@/schema/Reasoning"
 *
 * console.log(RDFS_RULES.map((rule) => rule.id))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RDFS_RULES: A.NonEmptyReadonlyArray<RdfsRule> = [
  RdfsRule.make({
    id: "rdfs2",
    premises: [pattern(p, rdfsDomain, c), pattern(s, p, o)],
    conclusion: pattern(s, rdfType, c),
  }),
  RdfsRule.make({
    id: "rdfs3",
    premises: [pattern(p, rdfsRange, c), pattern(s, p, o)],
    conclusion: pattern(o, rdfType, c),
  }),
  RdfsRule.make({
    id: "rdfs5",
    premises: [pattern(p, rdfsSubPropertyOf, q), pattern(q, rdfsSubPropertyOf, r)],
    conclusion: pattern(p, rdfsSubPropertyOf, r),
  }),
  RdfsRule.make({
    id: "rdfs7",
    premises: [pattern(p, rdfsSubPropertyOf, q), pattern(s, p, o)],
    conclusion: pattern(s, q, o),
  }),
  RdfsRule.make({
    id: "rdfs9",
    premises: [pattern(c, rdfsSubClassOf, d), pattern(s, rdfType, c)],
    conclusion: pattern(s, rdfType, d),
  }),
  RdfsRule.make({
    id: "rdfs11",
    premises: [pattern(c, rdfsSubClassOf, d), pattern(d, rdfsSubClassOf, e)],
    conclusion: pattern(c, rdfsSubClassOf, e),
  }),
  RdfsRule.make({
    id: "skos-broader-transitive",
    premises: [pattern(s, skosBroaderTransitive, m), pattern(m, skosBroaderTransitive, o)],
    conclusion: pattern(s, skosBroaderTransitive, o),
  }),
];

/**
 * Canonical subject-predicate-object input before content addressing.
 *
 * **Example** (Create a triple)
 *
 * ```ts
 * import { RdfTriple } from "@/schema/Reasoning"
 *
 * const triple = RdfTriple.make({ subject: "<urn:s>", predicate: "<urn:p>", object: "<urn:o>" })
 * console.log(triple.predicate) // "<urn:p>"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RdfTriple extends S.Class<RdfTriple>($I`RdfTriple`)(
  { subject: S.NonEmptyString, predicate: S.NonEmptyString, object: S.NonEmptyString },
  $I.annote("RdfTriple", {
    description: "Canonical serialized RDF terms used as one reasoning input or conclusion.",
  })
) {}

const RdfStatementFields = S.Struct({ id: StatementId, ...RdfTriple.fields });

const RdfStatementIdCheck = S.makeFilter(
  (statement: typeof RdfStatementFields.Type) =>
    contentDigestSync(RdfTriple)(
      RdfTriple.make({ object: statement.object, predicate: statement.predicate, subject: statement.subject })
    ).pipe(
      Result.match({
        onFailure: () => false,
        onSuccess: (digest) => Str.Equivalence(digest, statement.id),
      })
    ),
  {
    identifier: $I`RdfStatementIdCheck`,
    title: "RDF statement identity",
    description: "Requires the statement id to hash its complete canonical triple without truncation.",
    message: "RdfStatement id must match its canonical triple.",
  }
);

/**
 * Content-addressed RDF statement referenced by inference events.
 *
 * **Example** (Inspect the identity field)
 *
 * ```ts
 * import { RdfStatement } from "@/schema/Reasoning"
 *
 * console.log(RdfStatement.fields.id !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RdfStatement extends S.Class<RdfStatement>($I`RdfStatement`)(
  RdfStatementFields.mapFields(identity).check(RdfStatementIdCheck),
  $I.annote("RdfStatement", {
    description: "A complete canonical RDF triple with a full content-addressed identity.",
  })
) {}

/**
 * Content-addresses a canonical RDF triple without throwing.
 *
 * **Example** (Build a statement)
 *
 * ```ts
 * import { makeRdfStatement, RdfTriple } from "@/schema/Reasoning"
 * import { Result } from "effect"
 *
 * const result = makeRdfStatement(RdfTriple.make({ subject: "<urn:s>", predicate: "<urn:p>", object: "<urn:o>" }))
 * console.log(Result.isSuccess(result)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeRdfStatement = (triple: RdfTriple): Result.Result<RdfStatement, S.SchemaError> =>
  Result.map(contentDigestSync(RdfTriple)(triple), (id) => RdfStatement.make({ ...triple, id: StatementId.make(id) }));

class AssertedProofNode extends S.Class<AssertedProofNode>($I`AssertedProofNode`)(
  { kind: S.tag("Asserted"), statement: StatementId },
  $I.annote("AssertedProofNode", {
    description: "Proof leaf referring to one statement present before closure.",
  })
) {}

class InferredProofNode extends S.Class<InferredProofNode>($I`InferredProofNode`)(
  {
    kind: S.tag("Inferred"),
    statement: StatementId,
    rule: RdfsRuleId,
    premises: S.NonEmptyArray(StatementId),
  },
  $I.annote("InferredProofNode", {
    description: "Proof node recording one rule application and its premise statement references.",
  })
) {}

const ProofNodeKind = LiteralKit(["Asserted", "Inferred"]);

/**
 * Asserted and inferred nodes retained in an explanation DAG.
 *
 * **Example** (Construct an asserted proof node)
 *
 * ```ts
 * import { ProofNode } from "@/schema/Reasoning"
 * import { StatementId } from "@/schema/Ids"
 *
 * const node = ProofNode.cases.Asserted.make({ kind: "Asserted", statement: StatementId.make("0".repeat(64)) })
 * console.log(node.kind) // "Asserted"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProofNode = ProofNodeKind.mapMembers(
  Tuple.evolve([() => AssertedProofNode, () => InferredProofNode])
).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("ProofNode", {
    description: "Node variants in a replay-stable explanation DAG.",
  })
);

/**
 * Decoded node from {@link ProofNode}.
 *
 * @see {@link ProofNode} for constructors and matching helpers.
 * @category type-level
 * @since 0.0.0
 */
export type ProofNode = typeof ProofNode.Type;

/**
 * Explanation DAG rooted at one inferred conclusion.
 *
 * **Example** (Inspect the root field)
 *
 * ```ts
 * import { ProofDag } from "@/schema/Reasoning"
 *
 * console.log(ProofDag.fields.root !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofDag extends S.Class<ProofDag>($I`ProofDag`)(
  { root: StatementId, nodes: S.NonEmptyArray(ProofNode) },
  $I.annote("ProofDag", {
    description: "Replay-stable asserted leaves and inferred nodes for one conclusion.",
  })
) {}

const InferenceEngine = S.Literal("semantica-rhodf/1");

const InferenceEventBody = S.Struct({
  conclusion: StatementId,
  engine: InferenceEngine,
  premises: S.NonEmptyArray(StatementId),
  proof: ProofDag,
  rule: RdfsRuleId,
});

const InferenceEventFields = S.Struct({ id: InferenceEventId, ...InferenceEventBody.fields });

const InferenceEventIdCheck = S.makeFilter(
  (event: typeof InferenceEventFields.Type) =>
    contentDigestSync(InferenceEventBody)(
      InferenceEventBody.make({
        conclusion: event.conclusion,
        engine: event.engine,
        premises: event.premises,
        proof: event.proof,
        rule: event.rule,
      })
    ).pipe(
      Result.match({
        onFailure: () => false,
        onSuccess: (digest) => Str.Equivalence(digest, event.id),
      })
    ),
  {
    identifier: $I`InferenceEventIdCheck`,
    title: "Inference event identity",
    description: "Requires the event id to hash the rule, conclusion, premises, engine, and proof DAG.",
    message: "InferenceEvent id must match its complete replay-stable body.",
  }
);

/**
 * Content-addressed rule application with statement refs and a proof DAG.
 *
 * **Example** (Inspect the rule field)
 *
 * ```ts
 * import { InferenceEvent } from "@/schema/Reasoning"
 *
 * console.log(InferenceEvent.fields.rule !== undefined) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class InferenceEvent extends S.Class<InferenceEvent>($I`InferenceEvent`)(
  InferenceEventFields.mapFields(identity).check(InferenceEventIdCheck),
  $I.annote("InferenceEvent", {
    description: "A replay-stable C2 inference with rule, engine, premise refs, and explanation DAG.",
  })
) {}

/**
 * Builds a content-addressed inference event without throwing.
 *
 * **Example** (Inspect the constructor)
 *
 * ```ts
 * import { makeInferenceEvent } from "@/schema/Reasoning"
 *
 * console.log(typeof makeInferenceEvent) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeInferenceEvent = (
  event: typeof InferenceEventBody.Type
): Result.Result<InferenceEvent, S.SchemaError> =>
  Result.map(contentDigestSync(InferenceEventBody)(event), (id) =>
    InferenceEvent.make({ ...event, id: InferenceEventId.make(id) })
  );

/**
 * Asserted statements, derived conclusions, events, and complete closure.
 *
 * **Example** (Inspect the closure field)
 *
 * ```ts
 * import { ReasoningResult } from "@/schema/Reasoning"
 *
 * console.log(ReasoningResult.fields.closure !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReasoningResult extends S.Class<ReasoningResult>($I`ReasoningResult`)(
  {
    asserted: S.Array(RdfStatement),
    closure: S.Array(RdfStatement),
    derived: S.Array(RdfStatement),
    events: S.Array(InferenceEvent),
  },
  $I.annote("ReasoningResult", {
    description: "Deterministically ordered asserted data, inferred statements, proof events, and closure.",
  })
) {}

class EyeOracleIdentity extends S.Class<EyeOracleIdentity>($I`EyeOracleIdentity`)(
  {
    engine: S.Literal("EYE"),
    eyeVersion: S.NonEmptyString,
    package: S.Literal("eyereasoner"),
    packageVersion: S.NonEmptyString,
    restricted: S.Literal(true),
  },
  $I.annote("EyeOracleIdentity", {
    description: "Pinned EYE and eye-js identities used to produce the committed C2 gold.",
  })
) {}

class GEntailmentProof extends S.Class<GEntailmentProof>($I`GEntailmentProof`)(
  {
    conclusion: RdfTriple,
    eyeProofDigest: Sha256Hex,
    premises: S.NonEmptyArray(RdfTriple),
    rule: RdfsRuleId,
  },
  $I.annote("GEntailmentProof", {
    description: "Expected rule support plus the normalized digest of EYE's proof output.",
  })
) {}

class GEntailmentCase extends S.Class<GEntailmentCase>($I`GEntailmentCase`)(
  {
    id: S.NonEmptyString,
    asserted: S.NonEmptyArray(RdfTriple),
    expectedDerived: S.NonEmptyArray(RdfTriple),
    proofs: S.NonEmptyArray(GEntailmentProof),
  },
  $I.annote("GEntailmentCase", {
    description: "One fixed rho-df or SKOS case with EYE-derived conclusions and proof digests.",
  })
) {}

/**
 * Committed EYE-backed gold for the C2 rho-df and SKOS gate.
 *
 * **Example** (Inspect the fixed schema version)
 *
 * ```ts
 * import { GEntailmentExpectation } from "@/schema/Reasoning"
 *
 * console.log(GEntailmentExpectation.fields.schemaVersion.literals[0]) // "g-entailment-rdfs/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GEntailmentExpectation extends S.Class<GEntailmentExpectation>($I`GEntailmentExpectation`)(
  {
    schemaVersion: S.Literal("g-entailment-rdfs/v1"),
    oracle: EyeOracleIdentity,
    rulesSha256: Sha256Hex,
    cases: S.NonEmptyArray(GEntailmentCase),
  },
  $I.annote("GEntailmentExpectation", {
    description: "Pinned EYE identity, rules artifact digest, conclusions, and proof digests for C2.",
  })
) {}

class GEntailmentCaseWitness extends S.Class<GEntailmentCaseWitness>($I`GEntailmentCaseWitness`)(
  {
    caseId: S.NonEmptyString,
    derived: S.NonEmptyArray(RdfStatement),
    events: S.NonEmptyArray(InferenceEvent),
  },
  $I.annote("GEntailmentCaseWitness", {
    description: "One passing runtime closure and its independently validated inference events.",
  })
) {}

/**
 * Passing runtime witnesses for every committed EYE-backed gold case.
 *
 * **Example** (Inspect the expectation digest)
 *
 * ```ts
 * import { GEntailmentWitness } from "@/schema/Reasoning"
 *
 * console.log(GEntailmentWitness.fields.expectationDigest !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GEntailmentWitness extends S.Class<GEntailmentWitness>($I`GEntailmentWitness`)(
  { expectationDigest: Sha256Hex, cases: S.NonEmptyArray(GEntailmentCaseWitness) },
  $I.annote("GEntailmentWitness", {
    description: "Gold fixture digest and passing closure/event witnesses for all C2 cases.",
  })
) {}

/**
 * Projection digests before and after the ledger-commit crash checkpoint.
 *
 * **Example** (Inspect the checkpoint literal)
 *
 * ```ts
 * import { CrashIdentityWitness } from "@/schema/Reasoning"
 *
 * console.log(CrashIdentityWitness.fields.checkpoint.literals[0]) // "after-ledger-commit-before-projection"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CrashIdentityWitness extends S.Class<CrashIdentityWitness>($I`CrashIdentityWitness`)(
  {
    afterRestartDigest: Sha256Hex,
    beforeCrashDigest: Sha256Hex,
    checkpoint: S.Literal("after-ledger-commit-before-projection"),
  },
  $I.annote("CrashIdentityWitness", {
    description: "Equal projection digests around the exact C2 process-kill checkpoint.",
  })
) {}

/**
 * Bounded full-projection closure retained in the C2 report.
 *
 * **Example** (Inspect the event count field)
 *
 * ```ts
 * import { ProjectionReasoningWitness } from "@/schema/Reasoning"
 *
 * console.log(ProjectionReasoningWitness.fields.eventCount !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProjectionReasoningWitness extends S.Class<ProjectionReasoningWitness>($I`ProjectionReasoningWitness`)(
  {
    assertedCount: PosInt,
    closureCount: PosInt,
    closureDigest: Sha256Hex,
    derived: S.NonEmptyArray(RdfStatement),
    eventCount: PosInt,
    events: S.NonEmptyArray(InferenceEvent),
  },
  $I.annote("ProjectionReasoningWitness", {
    description: "Full RDF input counts, closure digest, derived statements, and proof events for one C2 run.",
  })
) {}

/**
 * Replay-stable C2 reasoning, crash, and EYE-gold evidence.
 *
 * **Example** (Inspect the crash witness field)
 *
 * ```ts
 * import { ReasoningWitness } from "@/schema/Reasoning"
 *
 * console.log(ReasoningWitness.fields.crash !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReasoningWitness extends S.Class<ReasoningWitness>($I`ReasoningWitness`)(
  { crash: CrashIdentityWitness, gold: GEntailmentWitness, projection: ProjectionReasoningWitness },
  $I.annote("ReasoningWitness", {
    description: "C2 evidence for oracle-backed closure, event proofs, and crash-safe rebuild identity.",
  })
) {}

const C2EvalReportFields = S.Struct({
  schemaVersion: S.Literal("c2-eval-report/v1"),
  base: C1EvalReport,
  reasoning: ReasoningWitness,
  reportDigest: Sha256Hex,
  stage: S.Literal("c2"),
});

const C2EvalReportChecks = S.makeFilterGroup([
  S.makeFilter(
    (report: typeof C2EvalReportFields.Type) =>
      Str.Equivalence(report.reasoning.crash.beforeCrashDigest, report.reasoning.crash.afterRestartDigest) &&
      A.isReadonlyArrayNonEmpty(report.reasoning.gold.cases) &&
      A.isReadonlyArrayNonEmpty(report.reasoning.projection.derived) &&
      A.isReadonlyArrayNonEmpty(report.reasoning.projection.events) &&
      Equal.equals(report.reasoning.projection.eventCount, A.length(report.reasoning.projection.events)),
    {
      identifier: $I`C2EvalReportReasoningChecks`,
      title: "C2 reasoning pass evidence",
      description: "Requires crash identity plus non-empty gold and full-projection proof events.",
      message: "C2EvalReport must retain only passing reasoning and crash evidence.",
    }
  ),
  S.makeFilter(
    (report: typeof C2EvalReportFields.Type) =>
      digestOmittingSync(
        C2EvalReportFields,
        "reportDigest"
      )(report).pipe(
        Result.match({
          onFailure: () => false,
          onSuccess: (digest) => Str.Equivalence(digest, report.reportDigest),
        })
      ),
    {
      identifier: $I`C2EvalReportDigestCheck`,
      title: "C2 evaluation report digest",
      description: "Requires reportDigest to hash the canonical C2 report after omitting only itself.",
      message: "C2EvalReport reportDigest must match its canonical body.",
    }
  ),
]);

/**
 * Content-addressed C2 report containing C1 evidence and reasoning proof.
 *
 * **Example** (Inspect the self-digest field)
 *
 * ```ts
 * import { C2EvalReport } from "@/schema/Reasoning"
 *
 * console.log(C2EvalReport.fields.reportDigest !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class C2EvalReport extends S.Class<C2EvalReport>($I`C2EvalReport`)(
  C2EvalReportFields.mapFields(identity).check(C2EvalReportChecks),
  $I.annote("C2EvalReport", {
    description: "Replay-stable C2 evaluation report with C1 evidence and validated inference proof events.",
  })
) {}
