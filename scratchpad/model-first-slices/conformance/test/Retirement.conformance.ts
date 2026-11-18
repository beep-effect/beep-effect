import { expect, it } from "@effect/vitest";
import { AuthorityDeployment } from "@proto/authority-host/Authority.descriptor";
import { ConformanceDeployment } from "@proto/conformance/Conformance.descriptor";
import { StreamPin } from "@proto/kernel/PublishedStream";
import { ClaimDecided } from "@proto/party-contract/Facts/ClaimDecided.fact";
import { PartyDeployment } from "@proto/party-host/Party.descriptor";
import { partyStreamPins } from "@proto/party-model/Facts/StreamPins";
import { RunsDeployment } from "@proto/runs-host/Runs.descriptor";
import { checkGenerationRetirement, RetirementRefusal } from "@proto/tooling/GenerationRetirement";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as O from "@beep/utils/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type * as Scope from "effect/Scope";
import { lastLine } from "./HostBacklog.ts";
import { psql, record, registration, services } from "./Stack.ts";

// Phase 11 (D51): the generation-retirement check, run against the cluster's state after P10 (with
// RESTORE_PHASE=retirement, on the data the `across` case left, phase 6's dump under the current
// code). It reports its verdict for retiring generation 1 (`PartyFacts`); nothing is retired.

/** A stream generation's entries, as the cluster stores them: position, and the event as encoded. */
const entriesOf = (stream: string) => `SELECT coalesce(json_agg(json_build_object(
    'position', (value::json->'envelope'->>'seq')::int, 'event', value::json->'event') ORDER BY key), '[]'::json)
  FROM alchemy_domain_objects WHERE object = 'Practice/Party.${stream}Stream/claims' AND key LIKE 'entry:%'`;

const StoredEntry = S.Struct({ position: S.Int, event: S.Unknown });
const decodeEntries = S.Array(StoredEntry).pipe(S.fromJsonString, S.decodeEffect);
const decodeFact = S.decodeUnknownOption(S.Struct({ _tag: S.String, factId: S.String }));

/** The fact version an event's tag names (`ClaimDecided.versions`). */
const versionOf = (tag: string): O.Option<number> =>
  O.map(
    A.findFirst(R.toEntries(ClaimDecided.versions), ([, version]) => version.tag === tag),
    ([version]) => Number(version),
  );

/**
 * A generation read from the cluster: each entry with its fact version and, as its payload, the
 * event as stored, compared whole; and the positions it held (its last entry's).
 */
const generation = Effect.fn("generation")(function* (stream: string) {
  const out = yield* psql(entriesOf(stream));
  const stored = yield* decodeEntries(lastLine(out));
  const entries = A.getSomes(
    A.map(stored, ({ position, event }) =>
      O.flatMap(decodeFact(event), (fact) =>
        O.map(versionOf(fact._tag), (version) => ({ position, factId: fact.factId, version, payload: event })),
      ),
    ),
  );
  const length = A.reduce(stored, 0, (last, entry) => Num.max(last, entry.position));
  return { live: { stream, entries }, length, unreadable: A.length(stored) - A.length(entries) };
});

/** Runs' checkpoint on Party's feed, where its inbox keeps it (`PgInboxStore`). */
const runsCheckpoint = Effect.map(
  psql(`SELECT coalesce(max(seq), -1) FROM runs_inbox_checkpoints WHERE producer = '${ClaimDecided.producer}'`),
  (out) => Number(lastLine(out)),
);

/** A case against the deployed stack, with the stack's clients built into the case's scope. */
const live = <E>(name: string, body: Effect.Effect<void, E, Layer.Success<typeof services> | Scope.Scope>) =>
  it.live(name, () => Effect.flatMap(Layer.build(services), (context) => Effect.provideContext(body, context)), 600_000);

if (O.contains(registration.restorePhase, "retirement")) {
  live("the retirement check's verdict for generation 1 on the cluster after P10 (nothing is retired)", Effect.gen(function* () {
    const { live: gen1, length, unreadable: unreadable1 } = yield* generation("PartyFacts");
    const { live: gen2, unreadable: unreadable2 } = yield* generation("PartyFacts2");
    const checkpoint = yield* runsCheckpoint;
    const next = [StreamPin.cases.Retired.make({ stream: "PartyFacts", length }), ...A.drop(partyStreamPins, 1)];
    const verdict = yield* checkGenerationRetirement({
      feed: { producer: ClaimDecided.producer, contract: ClaimDecided.contract },
      current: partyStreamPins,
      next,
      descriptors: [AuthorityDeployment, PartyDeployment, RunsDeployment, ConformanceDeployment],
      generations: [gen1, gen2],
      checkpoints: checkpoint < 0 ? [] : [{ consumer: "runs", position: checkpoint }],
    }).pipe(
      Effect.map((retirements) => ({ allowed: true, retirements, refusals: A.empty<RetirementRefusal>() })),
      Effect.catchTag("RetirementRefused", ({ refusals }) => Effect.succeed({ allowed: false, retirements: [], refusals })),
    );
    yield* record("retirement", {
      gen1: A.map(gen1.entries, ({ position, factId, version }) => ({ position, factId, version })),
      gen2: A.map(gen2.entries, ({ position, factId, version }) => ({ position, factId, version })),
      length,
      checkpoint,
      verdict,
    });
    // Every stored entry is a fact version the contract names.
    expect([unreadable1, unreadable2]).toEqual([0, 0]);
    // The verdict is reported, not asserted; the check must have read everything it needs.
    expect(A.filter(verdict.refusals, (refusal) => RetirementRefusal.guards.Unread(refusal))).toEqual([]);
    expect(A.length(gen1.entries)).toBeGreaterThan(0);
    // Generation 1 is still served: the deployed pins keep it closed.
    expect(A.findFirst(partyStreamPins, (pin) => pin.stream === "PartyFacts")).toEqual(StreamPin.cases.Closed.makeOption({ stream: "PartyFacts" }));
  }));
}
