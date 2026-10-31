/** Synthetic process-crash boundary; no providers, credentials or tools. */

import {
  AmbiguityResolution,
  Claim,
  Envelope,
  isMailboxLockTimeout,
  makeAgentMessageSqliteClient,
  makeAgentMessageStore,
  Receipt,
} from "@beep/repo-cli/test/AgentMessage";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

const EnvelopeJson = S.fromJsonString(Envelope);
const ResolutionJson = S.fromJsonString(AmbiguityResolution);
const ReceiptJson = S.fromJsonString(Receipt);
const decodeAmbiguityResolutionJson = S.decodeEffect(ResolutionJson);
const encodeReceiptJson = S.encodeEffect(ReceiptJson);

// The parent polls for the checkpoint and reads it as soon as it exists, so a
// plain write could be observed empty; write a sibling file, then rename it.
const writeCheckpoint = Effect.fnUntraced(function* (checkpoint: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const staged = `${checkpoint}.partial`;
  yield* fs.writeFileString(staged, content, { mode: 0o600 });
  yield* fs.rename(staged, checkpoint);
});

const program = Effect.scoped(
  Effect.gen(function* () {
    const filename = yield* Config.String("BEEP_MESSAGE_FIXTURE_DATABASE");
    const checkpoint = yield* Config.String("BEEP_MESSAGE_FIXTURE_CHECKPOINT");
    const stage = yield* Config.String("BEEP_MESSAGE_FIXTURE_STAGE");
    const client = yield* makeAgentMessageSqliteClient(filename, "100 millis");
    const store = yield* makeAgentMessageStore().pipe(
      Effect.provideService(SqlClient.SqlClient, client),
      // Concurrent children can exceed the deliberately short native busy timeout during
      // schema initialization. Retry only its classified lock error; other failures stay fatal.
      Effect.tapError((error) =>
        isMailboxLockTimeout(error) ? writeCheckpoint(`${checkpoint}.contended`, "contended") : Effect.void
      ),
      Effect.retry({ while: isMailboxLockTimeout, times: 8, schedule: Schedule.spaced("50 millis") })
    );
    const fs = yield* FileSystem.FileSystem;
    if (stage === "lock") {
      yield* client`BEGIN IMMEDIATE`;
      yield* writeCheckpoint(checkpoint, "locked");
      yield* fs
        .exists(`${checkpoint}.release`)
        .pipe(Effect.repeat({ schedule: Schedule.spaced("10 millis"), until: identity<boolean> }));
      yield* client`ROLLBACK`;
      return;
    }
    if (stage === "settle") {
      const input = yield* Config.String("BEEP_MESSAGE_FIXTURE_ENVELOPE");
      const request = yield* fs.readFileString(input).pipe(Effect.flatMap(decodeAmbiguityResolutionJson));
      yield* store.recordSettlement(
        Claim.make({
          envelope: yield* store.message(request.messageId),
          ownerId: request.attemptOwnerId,
          generation: request.attemptGeneration,
          leaseUntil: 201,
        }),
        request.runtimeEvidence,
        102
      );
      yield* writeCheckpoint(checkpoint, "settled");
      return yield* Effect.never;
    }
    if (stage === "resolve") {
      const input = yield* Config.String("BEEP_MESSAGE_FIXTURE_ENVELOPE");
      const request = yield* fs.readFileString(input).pipe(Effect.flatMap(decodeAmbiguityResolutionJson));
      const receipt = yield* store.resolveAmbiguity(request, 202);
      yield* writeCheckpoint(checkpoint, yield* encodeReceiptJson(receipt));
      return yield* Effect.never;
    }
    if (stage === "accept") {
      const input = yield* Config.String("BEEP_MESSAGE_FIXTURE_ENVELOPE");
      const message = yield* fs.readFileString(input).pipe(Effect.flatMap(S.decodeEffect(EnvelopeJson)));
      yield* store.accept(message, 100);
      yield* writeCheckpoint(checkpoint, "accepted");
    } else {
      // A racing child holds the write lock for its own claim; on a loaded host that can outlast
      // the short busy timeout. The claim is one transaction, so a retried lock timeout still
      // leaves exactly one winner.
      const claim = yield* store
        .claimNext("b", "b-owner", 101, 201)
        .pipe(Effect.retry({ while: isMailboxLockTimeout, times: 8, schedule: Schedule.spaced("50 millis") }));
      yield* writeCheckpoint(checkpoint, O.isSome(claim) ? "claimed" : "none");
    }
    return yield* Effect.never;
  })
);

const main = Effect.scoped(
  Layer.mergeAll(NodeServices.layer, Reactivity.layer).pipe(
    Layer.build,
    Effect.flatMap((context) => program.pipe(Effect.provide(context)))
  )
);

NodeRuntime.runMain(main);
