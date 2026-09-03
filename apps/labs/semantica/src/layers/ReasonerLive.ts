import { Effect, Equal, HashMap, HashSet, Layer, Match, Order } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { ReasoningFailed } from "@/schema/Errors";
import {
  makeInferenceEvent,
  makeRdfStatement,
  ProofDag,
  ProofNode,
  RDFS_RULES,
  RdfTriple,
  ReasoningResult,
} from "@/schema/Reasoning";
import { Reasoner } from "@/services/Reasoner";
import type { StatementId } from "@/schema/Ids";
import type { InferenceEvent, RdfStatement, RdfsRule } from "@/schema/Reasoning";

type RuleTerm = RdfsRule["premises"][number]["subject"];
type RuleVariableName = Extract<RuleTerm, { readonly kind: "Variable" }>["name"];
type Bindings = HashMap.HashMap<RuleVariableName, string>;

interface RuleMatch {
  readonly bindings: Bindings;
  readonly premises: ReadonlyArray<StatementId>;
}

interface WaveAddition {
  readonly event: InferenceEvent;
  readonly statement: RdfStatement;
}

const statementOrder = Order.mapInput(
  Order.String,
  (statement: RdfStatement) => `${statement.subject}\n${statement.predicate}\n${statement.object}`
);

const failed = (reason: ReasoningFailed["reason"], message: string): ReasoningFailed =>
  ReasoningFailed.make({ message, reason });

const uniqueStatements = (statements: ReadonlyArray<RdfStatement>): ReadonlyArray<RdfStatement> =>
  A.sort(
    A.dedupeWith(statements, (left, right) => Str.Equivalence(left.id, right.id)),
    statementOrder
  );

const matchTerm = (term: RuleTerm, value: string, bindings: Bindings): O.Option<Bindings> =>
  Match.value(term).pipe(
    Match.discriminatorsExhaustive("kind")({
      Constant: (constant) => (Str.Equivalence(constant.value, value) ? O.some(bindings) : O.none()),
      Variable: (variable) =>
        HashMap.get(bindings, variable.name).pipe(
          O.match({
            onNone: () => O.some(HashMap.set(bindings, variable.name, value)),
            onSome: (bound) => (Str.Equivalence(bound, value) ? O.some(bindings) : O.none()),
          })
        ),
    })
  );

const matchStatement = (
  pattern: RdfsRule["premises"][number],
  statement: RdfStatement,
  bindings: Bindings
): O.Option<Bindings> =>
  matchTerm(pattern.subject, statement.subject, bindings).pipe(
    O.flatMap((next) => matchTerm(pattern.predicate, statement.predicate, next)),
    O.flatMap((next) => matchTerm(pattern.object, statement.object, next))
  );

const ruleMatches = (rule: RdfsRule, statements: ReadonlyArray<RdfStatement>): ReadonlyArray<RuleMatch> => {
  const initial: ReadonlyArray<RuleMatch> = [
    { bindings: HashMap.empty<RuleVariableName, string>(), premises: A.empty<StatementId>() },
  ];
  return A.reduce(rule.premises, initial, (partial, premise) =>
    A.flatMap(partial, (matched) =>
      A.getSomes(
        A.map(statements, (statement) =>
          matchStatement(premise, statement, matched.bindings).pipe(
            O.map((bindings) => ({ bindings, premises: A.append(matched.premises, statement.id) }))
          )
        )
      )
    )
  );
};

const instantiateTerm = (term: RuleTerm, bindings: Bindings): O.Option<string> =>
  Match.value(term).pipe(
    Match.discriminatorsExhaustive("kind")({
      Constant: (constant) => O.some(constant.value),
      Variable: (variable) => HashMap.get(bindings, variable.name),
    })
  );

const instantiate = (rule: RdfsRule, bindings: Bindings): O.Option<RdfTriple> =>
  O.all({
    object: instantiateTerm(rule.conclusion.object, bindings),
    predicate: instantiateTerm(rule.conclusion.predicate, bindings),
    subject: instantiateTerm(rule.conclusion.subject, bindings),
  }).pipe(O.map((triple) => RdfTriple.make(triple)));

const proofNodesFor = (
  premises: A.NonEmptyReadonlyArray<StatementId>,
  inferredByConclusion: HashMap.HashMap<StatementId, InferenceEvent>
): ReadonlyArray<ProofNode> =>
  A.flatMap(premises, (premise) =>
    HashMap.get(inferredByConclusion, premise).pipe(
      O.match({
        onNone: () => [ProofNode.cases.Asserted.make({ kind: "Asserted", statement: premise })],
        onSome: (event) => event.proof.nodes,
      })
    )
  );

const makeAddition = Effect.fn("Reasoner.makeAddition")(function* (
  rule: RdfsRule,
  matched: RuleMatch,
  inferredByConclusion: HashMap.HashMap<StatementId, InferenceEvent>
) {
  const triple = yield* instantiate(rule, matched.bindings).pipe(
    Effect.fromOption(() => failed("rule-invalid", `Rule ${rule.id} left its conclusion unbound.`))
  );
  const statement = yield* Effect.fromResult(makeRdfStatement(triple)).pipe(
    Effect.mapError(() => failed("rule-invalid", `Rule ${rule.id} produced a statement that did not encode.`))
  );
  const premises = yield* A.match(matched.premises, {
    onEmpty: () => Effect.fail(failed("rule-invalid", `Rule ${rule.id} matched without premises.`)),
    onNonEmpty: Effect.succeed,
  });
  const root = ProofNode.cases.Inferred.make({
    kind: "Inferred",
    premises,
    rule: rule.id,
    statement: statement.id,
  });
  const nodes = A.dedupeWith(A.append(proofNodesFor(premises, inferredByConclusion), root), (left, right) =>
    Str.Equivalence(left.statement, right.statement)
  );
  const nonEmptyNodes = yield* A.match(nodes, {
    onEmpty: () => Effect.fail(failed("event-invalid", "An inference proof DAG had no nodes.")),
    onNonEmpty: Effect.succeed,
  });
  const event = yield* Effect.fromResult(
    makeInferenceEvent({
      conclusion: statement.id,
      engine: "semantica-rhodf/1",
      premises,
      proof: ProofDag.make({ nodes: nonEmptyNodes, root: statement.id }),
      rule: rule.id,
    })
  ).pipe(Effect.mapError(() => failed("event-invalid", "An inference event did not encode.")));
  return { event, statement } satisfies WaveAddition;
});

const deriveWave = Effect.fn("Reasoner.deriveWave")(function* (
  closure: ReadonlyArray<RdfStatement>,
  inferredByConclusion: HashMap.HashMap<StatementId, InferenceEvent>
) {
  let seen = HashSet.fromIterable(A.map(closure, (statement) => statement.id));
  const additions = yield* Effect.forEach(
    RDFS_RULES,
    Effect.fnUntraced(function* (rule) {
      const ruleAdditions = yield* Effect.forEach(
        ruleMatches(rule, closure),
        Effect.fnUntraced(function* (matched) {
          const addition = yield* makeAddition(rule, matched, inferredByConclusion);
          if (HashSet.has(seen, addition.statement.id)) {
            return O.none<WaveAddition>();
          }
          seen = HashSet.add(seen, addition.statement.id);
          return O.some(addition);
        }),
        { concurrency: 1 }
      );
      return A.getSomes(ruleAdditions);
    }),
    { concurrency: 1 }
  );
  return A.flatMap(additions, (values) => values);
});

const ruleFor = (event: InferenceEvent): O.Option<RdfsRule> =>
  A.findFirst(RDFS_RULES, (rule) => Str.Equivalence(rule.id, event.rule));

const statementFor = (statements: ReadonlyArray<RdfStatement>, id: StatementId): O.Option<RdfStatement> =>
  A.findFirst(statements, (statement) => Str.Equivalence(statement.id, id));

const validateProof = (
  event: InferenceEvent,
  closureIds: HashSet.HashSet<StatementId>
): Effect.Effect<void, ReasoningFailed> => {
  const rootIsPresent = A.some(event.proof.nodes, (node) =>
    ProofNode.match(node, {
      Asserted: () => false,
      Inferred: (inferred) =>
        Str.Equivalence(inferred.statement, event.conclusion) &&
        Str.Equivalence(inferred.rule, event.rule) &&
        Equal.equals(inferred.premises, event.premises),
    })
  );
  const allNodesResolve = A.every(event.proof.nodes, (node) => HashSet.has(closureIds, node.statement));
  return Str.Equivalence(event.proof.root, event.conclusion) && rootIsPresent && allNodesResolve
    ? Effect.void
    : Effect.fail(failed("event-invalid", `Inference event ${event.id} has an invalid proof DAG.`));
};

const validateEvent = Effect.fn("Reasoner.validateEvent")(function* (
  closure: ReadonlyArray<RdfStatement>,
  closureIds: HashSet.HashSet<StatementId>,
  event: InferenceEvent
) {
  const rule = yield* ruleFor(event).pipe(
    Effect.fromOption(() => failed("event-invalid", `Inference event ${event.id} names an unknown rule.`))
  );
  const premises = yield* Effect.forEach(
    event.premises,
    (id) =>
      statementFor(closure, id).pipe(
        Effect.fromOption(() => failed("event-invalid", `Inference event ${event.id} has a missing premise.`))
      ),
    { concurrency: 1 }
  );
  if (!Equal.equals(A.length(rule.premises), A.length(premises))) {
    return yield* failed("event-invalid", `Inference event ${event.id} has the wrong premise count.`);
  }
  const bindings = A.reduce(
    A.zip(rule.premises, premises),
    O.some(HashMap.empty<RuleVariableName, string>()),
    (current, [pattern, premise]) => current.pipe(O.flatMap((bound) => matchStatement(pattern, premise, bound)))
  );
  const bound = yield* bindings.pipe(
    Effect.fromOption(() => failed("event-invalid", `Inference event ${event.id} is not a valid rule instance.`))
  );
  const triple = yield* instantiate(rule, bound).pipe(
    Effect.fromOption(() => failed("event-invalid", `Inference event ${event.id} is not a valid rule instance.`))
  );
  const conclusion = yield* Effect.fromResult(makeRdfStatement(triple)).pipe(
    Effect.mapError(() => failed("event-invalid", `Inference event ${event.id} has a malformed conclusion.`))
  );
  if (!Str.Equivalence(conclusion.id, event.conclusion) || !HashSet.has(closureIds, conclusion.id)) {
    return yield* failed("event-invalid", `Inference event ${event.id} has an invalid conclusion.`);
  }
  yield* validateProof(event, closureIds);
});

const makeReasoner = Effect.fn("Reasoner.make")(function* () {
  return Reasoner.of({
    close: Effect.fn("Reasoner.close")(function* (input) {
      const asserted = uniqueStatements(input);
      let closure = asserted;
      let derived: ReadonlyArray<RdfStatement> = [];
      let events: ReadonlyArray<InferenceEvent> = [];
      let inferredByConclusion = HashMap.empty<StatementId, InferenceEvent>();
      let running = true;

      yield* Effect.whileLoop({
        while: () => running,
        body: () => deriveWave(closure, inferredByConclusion),
        step: (wave) => {
          running = A.isReadonlyArrayNonEmpty(wave);
          closure = uniqueStatements(
            A.appendAll(
              closure,
              A.map(wave, (addition) => addition.statement)
            )
          );
          derived = A.appendAll(
            derived,
            A.map(wave, (addition) => addition.statement)
          );
          events = A.appendAll(
            events,
            A.map(wave, (addition) => addition.event)
          );
          inferredByConclusion = A.reduce(wave, inferredByConclusion, (index, addition) =>
            HashMap.set(index, addition.statement.id, addition.event)
          );
        },
      });

      return ReasoningResult.make({
        asserted,
        closure,
        derived: uniqueStatements(derived),
        events,
      });
    }),

    validate: Effect.fn("Reasoner.validate")(function* (result) {
      const closureIds = HashSet.fromIterable(A.map(result.closure, (statement) => statement.id));
      yield* Effect.forEach(result.events, (event) => validateEvent(result.closure, closureIds, event), {
        concurrency: 1,
        discard: true,
      });
    }),
  });
});

/**
 * Pure declarative rho-df fixpoint with replay-stable inference proof DAGs.
 *
 * **Example** (Inspect the Reasoner Layer)
 *
 * ```ts
 * import { ReasonerLive } from "@/layers/ReasonerLive"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(ReasonerLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ReasonerLive = Layer.effect(Reasoner, makeReasoner());
