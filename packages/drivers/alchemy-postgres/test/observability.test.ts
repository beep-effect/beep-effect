/**
 * What the driver tells tracers and loggers: catalogued span names, bounded
 * attributes, an outbox delivery span that continues the commit's trace, and
 * failure logs that carry a tag instead of the cause.
 */
import * as Domain from "@alchemy.run/domain";
import { AlchemyPostgresPlatform } from "@beep/alchemy-postgres";
import {
  AggregateAttribute,
  AlchemyPostgresInstruments,
  BackfillRunJobSpan,
  JobRoleAttribute,
  OutboxDeliverSpan,
  PlatformSendSpan,
  TargetKindAttribute,
  TargetNameAttribute,
} from "@beep/alchemy-postgres/AlchemyPostgres.instruments";
import { PgliteTestLayer } from "@beep/pglite/Pglite.test-layer";
import { describe, layer } from "@effect/vitest";
import { deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Formatter from "effect/Formatter";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as References from "effect/References";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tracer from "effect/Tracer";

const ProbeId = S.String.pipe(S.brand("ObservedProbeId"));
class ProbeOpened extends Domain.Event("ProbeOpened", { note: S.String }) {}
class OpenProbe extends Domain.Command("OpenProbe", {
  target: ProbeId,
  input: { note: S.String },
  events: [ProbeOpened],
}) {}
class Probe extends Domain.Aggregate("Probe", {
  id: ProbeId,
  state: S.Union([S.TaggedStruct("Closed", {}), S.TaggedStruct("Open", { note: S.String })]),
  initial: { _tag: "Closed" },
  commands: [OpenProbe],
  decide: { OpenProbe: (_state, command) => [ProbeOpened.make({ note: command.note })] },
  evolve: { ProbeOpened: (_state, event) => ({ _tag: "Open" as const, note: event.note }) },
}) {}

/** Reaction runs by probe id; the first run for a `fail-*` probe dies with secret text. */
const reactions = MutableHashMap.empty<string, number>();
const reactionsOf = (id: string) => O.getOrElse(MutableHashMap.get(reactions, id), () => 0);
const secretDefect = "secret defect text for /vault/client/matter.md";
class ProbeWatch extends Domain.Policy("ProbeWatch", { from: Probe, on: [ProbeOpened] }) {}
const ProbeWatchLive = ProbeWatch.toLayer(
  Effect.succeed(
    Effect.fn(function* ({ source }) {
      const run = reactionsOf(source.id) + 1;
      MutableHashMap.set(reactions, source.id, run);
      if (Str.startsWith("fail-")(source.id) && run === 1) return yield* Effect.die(secretDefect);
    })
  )
);
class Observed extends Domain.Model("Observed", { aggregates: [Probe], policies: [ProbeWatch] }) {}

/** Every span the tracer started, in start order. */
const spans: Array<Tracer.NativeSpan> = [];
const tracer = Tracer.make({
  span: (options) => {
    const span = new Tracer.NativeSpan(options);
    spans.push(span);
    return span;
  },
});

interface LoggedLine {
  readonly annotations: Readonly<Record<string, unknown>>;
  readonly causeEmpty: boolean;
  readonly text: string;
}
/** Every line the driver logged, with its annotations. */
const lines: Array<LoggedLine> = [];
const recorder = Logger.make(({ cause, fiber, message }) => {
  const text = A.join(A.map(A.ensure(message), String), " ");
  if (!Str.startsWith("alchemy-postgres")(text)) return;
  lines.push({
    text,
    annotations: fiber.getRef(References.CurrentLogAnnotations),
    causeEmpty: cause.reasons.length === 0,
  });
});

const hosted = Observed.layer(ProbeWatchLive).pipe(
  Layer.provideMerge(AlchemyPostgresPlatform.layer()),
  Layer.provideMerge(PgliteTestLayer),
  Layer.provideMerge(Layer.succeed(Tracer.Tracer, tracer)),
  Layer.provideMerge(Logger.layer([recorder]))
);

const named = (name: string) => A.filter(spans, (span) => span.name === name);
const attributesOf = (span: Tracer.NativeSpan) => R.fromEntries(A.fromIterable(span.attributes));
const parentIdOf = (span: Tracer.NativeSpan) =>
  span.parent.pipe(
    O.map((parent) => parent.spanId),
    O.getOrNull
  );
/** Wait until `done` holds, polling every 20 ms for up to 15 seconds. */
const eventually = (done: () => boolean) =>
  Effect.sync(done).pipe(
    Effect.repeat({ until: P.isTruthy, schedule: Schedule.spaced(Duration.millis(20)) }),
    Effect.timeout(Duration.seconds(15))
  );

describe("AlchemyPostgres observability", () => {
  layer(hosted, { timeout: "30 seconds", excludeTestServices: true, concurrent: false })("on PGlite", (it) => {
    it.effect("labels a send by aggregate name only", () =>
      Effect.gen(function* () {
        const probes = yield* Probe;
        const id = ProbeId.make("raw-instance-id-0001");
        yield* probes.send(id, OpenProbe.make({ note: "n" }));
        const sends = A.filter(named("AlchemyPostgresPlatform.send"), (span) =>
          A.some(A.fromIterable(span.attributes.values()), (value) => value === "Probe")
        );
        strictEqual(sends.length, 1);
        deepStrictEqual(A.map(sends, attributesOf), [{ [AggregateAttribute]: "Probe" }]);
        const leaked = A.filter(spans, (span) =>
          A.some(A.fromIterable(span.attributes.values()), (value) => value === id)
        );
        deepStrictEqual(
          A.map(
            A.filter(leaked, (span) => Str.startsWith("AlchemyPostgres")(span.name)),
            (span) => span.name
          ),
          []
        );
      })
    );

    it.effect("parents each outbox delivery to the commit's stored trace", () =>
      Effect.gen(function* () {
        const probes = yield* Probe;
        const id = ProbeId.make("traced-probe");
        yield* probes.send(id, OpenProbe.make({ note: "n" })).pipe(Effect.withSpan("Test.request"));
        yield* eventually(
          () => reactionsOf(id) === 1 && A.isReadonlyArrayNonEmpty(named("AlchemyPostgres.Outbox.deliver"))
        );
        const request = yield* Effect.fromOption(A.last(named("Test.request")));
        const deliver = yield* Effect.fromOption(A.last(named("AlchemyPostgres.Outbox.deliver")));
        strictEqual(deliver.kind, "consumer");
        strictEqual(deliver.traceId, request.traceId);
        deepStrictEqual(attributesOf(deliver), {
          [TargetKindAttribute]: "policy",
          [TargetNameAttribute]: "ProbeWatch",
        });
        // The stored trace is the span current at commit: a descendant of the request.
        const byId = R.fromEntries(A.map(spans, (span) => [span.spanId, span] as const));
        const ancestors = (span: Tracer.NativeSpan): ReadonlyArray<string> =>
          O.match(
            O.flatMap(O.fromNullishOr(parentIdOf(span)), (parentId) => R.get(byId, parentId)),
            {
              onNone: () => [],
              onSome: (parent) => [parent.spanId, ...ancestors(parent)],
            }
          );
        strictEqual(A.contains(ancestors(deliver), request.spanId), true);
        // Its direct parent is the kernel's decide span, whose trace the commit stored.
        const parent = yield* Effect.fromOption(
          O.flatMap(O.fromNullishOr(parentIdOf(deliver)), (parentId) => R.get(byId, parentId))
        );
        strictEqual(parent.name, "Domain.decide Probe.OpenProbe");
      })
    );

    it.effect("logs a failed delivery by tag, position and target, never the cause or ids", () =>
      Effect.gen(function* () {
        const probes = yield* Probe;
        const id = ProbeId.make("fail-secret-instance-77");
        yield* probes.send(id, OpenProbe.make({ note: "n" }));
        yield* eventually(() => reactionsOf(id) === 2);
        const retried = A.filter(lines, (line) => Str.includes("delivery failed; retrying")(line.text));
        strictEqual(A.isReadonlyArrayNonEmpty(retried), true);
        for (const line of retried) {
          strictEqual(line.causeEmpty, true);
          strictEqual(line.annotations.failure, "UntaggedDefect");
          strictEqual(line.annotations.targetKind, "policy");
          strictEqual(line.annotations.targetName, "ProbeWatch");
          strictEqual(P.isNumber(line.annotations.position), true);
        }
        const everything = Formatter.format(lines);
        strictEqual(Str.includes(id)(everything), false);
        strictEqual(Str.includes("secret defect")(everything), false);
        strictEqual(Str.includes("/vault/")(everything), false);
      })
    );

    it.effect("declares the send, deliver and backfill job spans and their keys", () =>
      Effect.sync(() => {
        deepStrictEqual(
          A.map(AlchemyPostgresInstruments.instruments, (instrument) => instrument.name),
          [PlatformSendSpan.name, OutboxDeliverSpan.name, BackfillRunJobSpan.name]
        );
        deepStrictEqual(
          A.take(
            A.map(AlchemyPostgresInstruments.attributes, (attribute) => attribute.key),
            4
          ),
          [AggregateAttribute, TargetKindAttribute, TargetNameAttribute, JobRoleAttribute]
        );
      })
    );

    it.effect("declares kernel names at shape-only and kernel identifiers only from standard up", () =>
      Effect.sync(() => {
        const tierOf = (key: string) =>
          O.map(
            A.findFirst(AlchemyPostgresInstruments.attributes, (attribute) => attribute.key === key),
            (attribute) => attribute.minTier
          );
        for (const key of ["domain.aggregate", "domain.command", "domain.outcome", "domain.events"])
          deepStrictEqual(tierOf(key), O.some("shape-only"));
        for (const key of ["domain.id", "domain.key", "domain.stream", "domain.command_id", "domain.correlation_id"])
          deepStrictEqual(tierOf(key), O.some("standard"));
      })
    );
  });
});
