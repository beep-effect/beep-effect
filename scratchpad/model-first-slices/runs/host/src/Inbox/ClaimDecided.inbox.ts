import { byProcess, Cause } from "@proto/kernel/Invocation";
import { type FactEnvelope, inboxKey } from "@proto/kernel/Fact";
import { requestKey } from "@proto/kernel/RequestKey";
import { ClaimDecided } from "@proto/party-contract/Facts/ClaimDecided.fact";
import { PartyFactsFeed } from "@proto/party-contract/Facts/PartyFacts.gateway";
import { ConcludeRun } from "@proto/runs-contract/Run/ConcludeRun.command";
import { AgentRun } from "@proto/runs-model/Run/AgentRun.aggregate";
import { $RunsHostId } from "@proto/kernel/Identity";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import { liveRun } from "../Lineage.ts";
import { InboxStore } from "./Inbox.store.ts";

const $I = $RunsHostId.create("Inbox/ClaimDecided.inbox");

/**
 * The one `ClaimDecided` version this inbox consumes. A producer adding
 * versions changes nothing here; the runs descriptor declares it (D34).
 *
 * @category constants
 * @since 0.0.0
 */
export const ClaimDecidedVersion = 1;
const version = ClaimDecidedVersion;
const decode = S.decodeUnknownEffect(S.toCodecJson(ClaimDecided.versions[version]));
const process = "ClaimDecidedInbox";

/**
 * The runs context's inbox for Party's `ClaimDecided` fact, version 1: each
 * review run the decided claim opened is concluded, at the live run of its
 * lineage. Keyed by producer, fact id and version, with its own checkpoint.
 *
 * **Details**
 *
 * - A fact already acted on is skipped; a fact of another version is passed
 *   over and only moves the checkpoint.
 * - Each `ConcludeRun` carries a command id derived from the producer, the
 *   fact and the run, so a redelivery after a crash between the command and
 *   the checkpoint is answered from the first receipt and records nothing.
 * - Authority: the fact carries no provenance and the command is internal.
 *   The run concludes under its own provenance plus a `Fact` hop naming this
 *   inbox and the fact (see the phase 3 notes).
 *
 * @category services
 * @since 0.0.0
 */
export class ClaimDecidedInbox extends Context.Service<
  ClaimDecidedInbox,
  {
    /** Handle every fact after the checkpoint; returns how many were read. */
    readonly drain: Effect.Effect<number>;
  }
>()($I`ClaimDecidedInbox`) {}

/**
 * The inbox over Party's feed, the inbox store and the runs model.
 *
 * @category layers
 * @since 0.0.0
 */
export const ClaimDecidedInboxLive = Layer.effect(
  ClaimDecidedInbox,
  Effect.gen(function* () {
    const feed = yield* PartyFactsFeed;
    const store = yield* InboxStore;
    const runs = yield* AgentRun;
    const digest = yield* Digest.Digest;

    const handle = Effect.fnUntraced(function* (envelope: FactEnvelope) {
      const key = inboxKey(envelope);
      if (envelope.version !== version || (yield* store.seen(key))) {
        return yield* store.commit(envelope.producer, O.none(), envelope.seq);
      }
      const fact = yield* Effect.orDie(decode(envelope.payload));
      const hop = byProcess(
        process,
        Cause.cases.Fact.make({ producer: envelope.producer, contract: envelope.contract, version, fact: envelope.factId }),
      );
      yield* Effect.forEach(
        fact.reviewRuns,
        (run) =>
          Effect.gen(function* () {
            const live = yield* liveRun(runs, run);
            const commandId = yield* requestKey({
              tenant: fact.org,
              operation: ConcludeRun.tag,
              payload: { fact: key, run: live.run },
            }).pipe(Effect.provideService(Digest.Digest, digest));
            yield* runs.send(live.run, ConcludeRun.make({ outcome: fact.outcome, hop }), { commandId });
          }),
        { discard: true },
      );
      yield* store.commit(envelope.producer, O.some(key), envelope.seq);
    });

    const drain: Effect.Effect<number> = Effect.gen(function* () {
      const after = yield* store.checkpoint(ClaimDecided.producer);
      const facts = yield* feed.read({ after, take: 50 });
      yield* Effect.forEach(facts, handle, { discard: true });
      return A.isReadonlyArrayEmpty(facts) ? 0 : facts.length + (yield* drain);
    });

    return { drain };
  }),
).pipe(Layer.provide(Digest.layerWebCrypto));

/**
 * Drains the inbox on a schedule for as long as the Layer's scope lives. A
 * failed drain is logged and retried on the next tick.
 *
 * @category layers
 * @since 0.0.0
 */
export const ClaimDecidedInboxPoller = Effect.flatMap(Effect.service(ClaimDecidedInbox), (inbox) =>
  Effect.forkScoped(
    inbox.drain.pipe(
      Effect.tap((read) => (read > 0 ? Effect.logInfo(`ClaimDecided inbox: handled ${read} facts`) : Effect.void)),
      // A failed drain is reported and retried on the next tick; it never stops the poller.
      Effect.catchCause((cause) => Effect.logError("ClaimDecided inbox: drain failed", cause)),
      Effect.repeat(Schedule.spaced("250 millis")),
    ),
  ),
).pipe(Layer.effectDiscard);
