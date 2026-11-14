/** Counted engine work for the citation install-once and regex worker goals.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { constant } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tracer from "effect/Tracer";
import type { CitationNativeExitCounts } from "./CitationNativeSpawner.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationEngineProbe");
/** Work one engine call performed, counted so the number does not move with host load.
 *
 * **Details**
 *
 * Each field counts spans of one name, except `nativeProcesses`, which counts
 * child processes the observed spawner started. `regexWorkerConstructions`
 * counts installed regex evaluators (`Citation.installRegexEvaluator`).
 * `regexDescriptorBindings` counts per-call descriptor registries for
 * request-generated patterns, `nativeProcessOwners` physical process owners and
 * `diffXmlWorkerConstructions` Diff and Xml worker constructions. The goals
 * installation and native-worker changes move these
 * numbers on purpose and update the recorded baseline in the same change.
 *
 * **Example** (A call that did no native work)
 * ```ts
 * import { CitationEngineWorkCounts } from "./CitationEngineProbe.fixtures.ts";
 * const idle = CitationEngineWorkCounts.make({
 *   metadataOperationInstalls: 0,
 *   configurationDetaches: 0,
 *   tokenizerBuilds: 0,
 *   regexWorkerConstructions: 0,
 *   regexEvaluations: 0,
 *   nativeProcesses: 0,
 *   regexDescriptorBindings: 0,
 *   nativeProcessOwners: 0,
 *   nativeLaneUnits: 0,
 *   diffXmlWorkerConstructions: 0,
 * });
 * ```
 * @internal @category models @since 0.0.0
 */
export class CitationEngineWorkCounts extends S.Opaque<CitationEngineWorkCounts, { readonly brand: unique symbol }>()(
  S.Struct({
    metadataOperationInstalls: S.Natural,
    configurationDetaches: S.Natural,
    tokenizerBuilds: S.Natural,
    regexWorkerConstructions: S.Natural,
    regexEvaluations: S.Natural,
    nativeProcesses: S.Natural,
    regexDescriptorBindings: S.Natural,
    nativeProcessOwners: S.Natural,
    nativeLaneUnits: S.Natural,
    diffXmlWorkerConstructions: S.Natural,
  }).pipe(
    $I.annoteSchema("CitationEngineWorkCounts", {
      description:
        "Stage installs, configuration detaches, tokenizer builds, regex work and child processes of one call.",
    })
  )
) {}

const spanNames = {
  metadataOperationInstalls: ["Citation.makeMetadataOperation"],
  configurationDetaches: ["Citation.ownConfiguration"],
  tokenizerBuilds: ["Citation.makeTokenizer"],
  regexWorkerConstructions: ["Citation.installRegexEvaluator"],
  regexEvaluations: ["Citation.evaluateRegexProcess"],
  regexDescriptorBindings: ["Citation.bindRegexDescriptors"],
  nativeProcessOwners: ["Citation.makeNativeProcessOwner"],
  nativeLaneUnits: ["Citation.acquireNativeLane"],
  diffXmlWorkerConstructions: ["Citation.makeDiffWorker", "Citation.makeXmlWorker"],
} satisfies Record<Exclude<keyof typeof CitationEngineWorkCounts.fields, "nativeProcesses">, ReadonlyArray<string>>;
const zero = constant(0);

/** Count named engine spans and child processes around a piece of work.
 *
 * **Details**
 *
 * The recorder is an Effect `Tracer` that counts every span by name and hands
 * back a native span, so the engine runs unchanged. `measure` reads the totals
 * before and after and returns the difference, which makes consecutive calls on
 * one shared engine independent measurements.
 *
 * **Example** (Measuring one extraction)
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { makeCitationEngineProbe } from "./CitationEngineProbe.fixtures.ts";
 * import { CitationNativeExitCounts } from "./CitationNativeSpawner.fixtures.ts";
 * const measured = Effect.gen(function* () {
 *   const probe = yield* makeCitationEngineProbe(
 *     Effect.succeed(CitationNativeExitCounts.make({ spawned: 0, confirmed: 0 }))
 *   );
 *   return yield* probe.measure(Effect.void);
 * });
 * ```
 * @internal @category testing @since 0.0.0
 */
export const makeCitationEngineProbe = Effect.fn("EngineProbeTest.make")(function* (
  native: Effect.Effect<CitationNativeExitCounts>
) {
  const seen = MutableHashMap.empty<string, number>();
  const count = (name: string) => O.getOrElse(MutableHashMap.get(seen, name), zero);
  const total = (names: ReadonlyArray<string>) => A.reduce(names, 0, (sum, name) => sum + count(name));
  const tracer = Tracer.make({
    span: (options) => {
      MutableHashMap.set(seen, options.name, count(options.name) + 1);
      return new Tracer.NativeSpan(options);
    },
  });
  const read = Effect.map(native, (processes) =>
    CitationEngineWorkCounts.make({
      metadataOperationInstalls: total(spanNames.metadataOperationInstalls),
      configurationDetaches: total(spanNames.configurationDetaches),
      tokenizerBuilds: total(spanNames.tokenizerBuilds),
      regexWorkerConstructions: total(spanNames.regexWorkerConstructions),
      regexEvaluations: total(spanNames.regexEvaluations),
      nativeProcesses: processes.spawned,
      regexDescriptorBindings: total(spanNames.regexDescriptorBindings),
      nativeProcessOwners: total(spanNames.nativeProcessOwners),
      nativeLaneUnits: total(spanNames.nativeLaneUnits),
      diffXmlWorkerConstructions: total(spanNames.diffXmlWorkerConstructions),
    })
  );
  const measure = Effect.fn("EngineProbeTest.measure")(function* <A, E, R>(work: Effect.Effect<A, E, R>) {
    const before = yield* read;
    const [elapsed, value] = yield* Effect.timed(work.pipe(Effect.withTracer(tracer)));
    const after = yield* read;
    const counts = CitationEngineWorkCounts.make({
      metadataOperationInstalls: after.metadataOperationInstalls - before.metadataOperationInstalls,
      configurationDetaches: after.configurationDetaches - before.configurationDetaches,
      tokenizerBuilds: after.tokenizerBuilds - before.tokenizerBuilds,
      regexWorkerConstructions: after.regexWorkerConstructions - before.regexWorkerConstructions,
      regexEvaluations: after.regexEvaluations - before.regexEvaluations,
      nativeProcesses: after.nativeProcesses - before.nativeProcesses,
      regexDescriptorBindings: after.regexDescriptorBindings - before.regexDescriptorBindings,
      nativeProcessOwners: after.nativeProcessOwners - before.nativeProcessOwners,
      nativeLaneUnits: after.nativeLaneUnits - before.nativeLaneUnits,
      diffXmlWorkerConstructions: after.diffXmlWorkerConstructions - before.diffXmlWorkerConstructions,
    });
    return { value, counts, elapsedMillis: Duration.toMillis(elapsed) };
  });
  return { measure };
});
