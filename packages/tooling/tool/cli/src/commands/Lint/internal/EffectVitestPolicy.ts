/**
 * Built-in P0c rule metadata pending the complete P0d primitive graph.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { Effect, HashMap, Schema } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import { EffectVitestPrimitiveGraphError } from "../Lint.errors.ts";
import { EffectVitestFinding, EffectVitestReplacement, EffectVitestRuleId } from "../Lint.schemas.ts";
import { indexEffectVitestPrimitives } from "./EffectVitestPrimitives.ts";
import type { EffectVitestPrimitiveGraphDocument, EffectVitestSeverity } from "../Lint.schemas.ts";

type RulePolicy = {
  readonly className: string;
  readonly primitive: string;
  readonly sketch: string;
  readonly severity: EffectVitestSeverity;
};

const isEffectVitestRuleId = Schema.is(EffectVitestRuleId);

const entries: ReadonlyArray<readonly [EffectVitestRuleId, RulePolicy]> = [
  [
    "EV001",
    {
      className: "runtime-boundary-in-test",
      primitive: "it.effect",
      sketch: "Return the Effect from an Effect tester; reserve it.live for genuine live services.",
      severity: "major",
    },
  ],
  [
    "EV002",
    {
      className: "per-test-layer-provide",
      primitive: "it.layer",
      sketch:
        "Build the effectful or unresolved Layer once with it.layer; pure Layer.succeed/mock stubs remain permitted.",
      severity: "major",
    },
  ],
  [
    "EV003",
    {
      className: "resource-wrapper",
      primitive: "it.layer",
      sketch: "Replace the resource wrapper with it.layer and keep only the inner per-test resource scoped.",
      severity: "major",
    },
  ],
  [
    "EV004",
    {
      className: "redundant-whole-body-scope",
      primitive: "readme.resource-safety",
      sketch: "Delete only a whole-body Effect.scoped; retain deliberate shorter lifetimes for judgment.",
      severity: "major",
    },
  ],
  [
    "EV005",
    {
      className: "result-outcome-assertion",
      primitive: "utils.assertExitSuccess",
      sketch: "Replace Effect.result with Effect.exit and assert the Exit success or failure branch.",
      severity: "minor",
    },
  ],
  [
    "EV006",
    {
      className: "hand-rolled-data-assertion",
      primitive: "utils.assertSome",
      sketch: "Use the matching Option, Result, or Exit helper from @effect/vitest/utils.",
      severity: "minor",
    },
  ],
  [
    "EV007",
    {
      className: "direct-fast-check-assert",
      primitive: "it.effect.prop",
      sketch: "Move the property to it.prop/it.effect.prop and preserve fcRuns floors in arbitrary options.",
      severity: "major",
    },
  ],
  [
    "EV008",
    {
      className: "test-clock-stall-risk",
      primitive: "readme.testclock",
      sketch: "Drive TestClock in the same test, or use it.live only with a recorded reason.",
      severity: "major",
    },
  ],
  [
    "EV009",
    {
      className: "unjustified-live-test",
      primitive: "it.effect",
      sketch: "Use it.effect unless a live clock, console, OS, or network dependency is evidenced.",
      severity: "info",
    },
  ],
  [
    "EV010",
    {
      className: "platform-filesystem-candidate",
      primitive: "it.layer",
      sketch: "Judge whether MemoryFileSystem.layer can replace the platform filesystem without changing the subject.",
      severity: "info",
    },
  ],
  [
    "EV011",
    {
      className: "plain-vitest-with-effect",
      primitive: "module.@effect/vitest",
      sketch: "Import the Vitest API through @effect/vitest when the test also imports Effect.",
      severity: "minor",
    },
  ],
  [
    "EV012",
    {
      className: "effect-service-mock-candidate",
      primitive: "Layer.mock",
      sketch: "Judge whether Layer.mock or Layer.succeed can replace the vi mock/spy.",
      severity: "info",
    },
  ],
  [
    "EV013",
    {
      className: "retry-loop-candidate",
      primitive: "it.flakyTest",
      sketch: "Find the root cause; use it.flakyTest only for external nondeterminism with a required reason.",
      severity: "info",
    },
  ],
  [
    "EV014",
    {
      className: "resource-layer-without-hook-timeout",
      primitive: "it.layer.option.timeout",
      sketch: "Give container/server/scoped acquisition an explicit hook timeout such as 30 seconds.",
      severity: "major",
    },
  ],
  [
    "EV015",
    {
      className: "shared-test-clock-adjustment",
      primitive: "it.layer.option.excludeTestServices",
      sketch: "Reset time per test or isolate test services; nested it.layer blocks reuse the parent TestClock.",
      severity: "info",
    },
  ],
];

/**
 * Map EV001 through EV015 to their detector class, preferred primitive, and severity.
 *
 * **Details**
 *
 * Detectors use this metadata while recognizing syntax. Before findings leave
 * the scanner, {@link applyEffectVitestPrimitiveGraph} validates every preferred
 * primitive and replaces the staging sketch with graph-authored guidance.
 *
 * **Example** (Read the runtime-boundary replacement)
 *
 * ```ts
 * import { EffectVitestRulePolicies } from "@beep/repo-cli/commands/Lint"
 * import { HashMap } from "effect"
 * import * as O from "effect/Option"
 *
 * console.log(O.map(HashMap.get(EffectVitestRulePolicies, "EV001"), ({ primitive }) => primitive)) // Some("it.effect")
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const EffectVitestRulePolicies = HashMap.fromIterable(entries);

/**
 * Validate policy edges and replace staging sketches with pinned graph guidance.
 *
 * **Details**
 *
 * Every preferred policy primitive must exist, name the rule in `replaces`, and
 * describe the corresponding repository candidate class in `whenToUse`.
 * Findings retain their identity, evidence, confidence, and mechanization.
 *
 * **Example** (Build graph-backed remediation)
 *
 * ```ts
 * import { applyEffectVitestPrimitiveGraph, readEffectVitestPrimitiveGraph } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 *
 * const program = readEffectVitestPrimitiveGraph(process.cwd()).pipe(
 *   Effect.flatMap((graph) => applyEffectVitestPrimitiveGraph([], graph))
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const applyEffectVitestPrimitiveGraph: {
  (
    findings: ReadonlyArray<EffectVitestFinding>,
    graph: EffectVitestPrimitiveGraphDocument
  ): Effect.Effect<ReadonlyArray<EffectVitestFinding>, EffectVitestPrimitiveGraphError>;
  (
    graph: EffectVitestPrimitiveGraphDocument
  ): (
    findings: ReadonlyArray<EffectVitestFinding>
  ) => Effect.Effect<ReadonlyArray<EffectVitestFinding>, EffectVitestPrimitiveGraphError>;
} = dual(2, (findings: ReadonlyArray<EffectVitestFinding>, graph: EffectVitestPrimitiveGraphDocument) =>
  Effect.gen(function* () {
    const primitives = indexEffectVitestPrimitives(graph.entries);
    yield* Effect.forEach(entries, ([ruleId, policy]) => {
      const candidates = A.filter(graph.entries, (primitive) => A.contains(primitive.replaces, ruleId));
      return O.match(HashMap.get(primitives, policy.primitive), {
        onNone: () =>
          Effect.fail(
            EffectVitestPrimitiveGraphError.new(`Policy ${ruleId} references missing primitive ${policy.primitive}.`)
          ),
        onSome: (preferred) =>
          A.contains(preferred.replaces, ruleId) &&
          !A.isReadonlyArrayEmpty(candidates) &&
          A.every(candidates, (candidate) => Str.includes(policy.className)(candidate.whenToUse))
            ? Effect.void
            : Effect.fail(
                EffectVitestPrimitiveGraphError.new(
                  `Graph replacements for ${ruleId} must include preferred primitive ${preferred.id} and name candidate class ${policy.className}.`
                )
              ),
      });
    });
    return yield* Effect.forEach(findings, (finding) => {
      if (!isEffectVitestRuleId(finding.ruleId)) {
        return Effect.fail(
          EffectVitestPrimitiveGraphError.new(`Finding ${finding.id} uses unknown policy ID ${finding.ruleId}.`)
        );
      }
      return O.match(HashMap.get(EffectVitestRulePolicies, finding.ruleId), {
        onNone: () =>
          Effect.fail(
            EffectVitestPrimitiveGraphError.new(`Finding ${finding.id} uses unknown policy ID ${finding.ruleId}.`)
          ),
        onSome: (policy) => {
          const candidates = A.filter(graph.entries, (primitive) => A.contains(primitive.replaces, finding.ruleId));
          return Effect.succeed(
            EffectVitestFinding.make({
              ...finding,
              replacement: EffectVitestReplacement.make({
                primitive: policy.primitive,
                sketch: A.join(
                  A.map(candidates, (candidate) => `${candidate.id}: ${candidate.whenToUse}`),
                  " "
                ),
              }),
            })
          );
        },
      });
    });
  })
);
