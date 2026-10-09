/** Synthetic process-crash boundary; no providers, credentials or tools. */
import { Envelope, makeAgentMessageStore } from "@beep/repo-cli/commands/AgentMessage";
import { BunServices } from "@effect/platform-bun";
import * as SqliteClient from "@effect/sql-sqlite-bun/SqliteClient";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

const EnvelopeJson = S.fromJsonString(Envelope);

const program = Effect.scoped(
  Effect.gen(function* () {
    const filename = yield* Config.String("BEEP_MESSAGE_FIXTURE_DATABASE");
    const checkpoint = yield* Config.String("BEEP_MESSAGE_FIXTURE_CHECKPOINT");
    const stage = yield* Config.String("BEEP_MESSAGE_FIXTURE_STAGE");
    const client = yield* SqliteClient.make({ filename, busyTimeout: "100 millis" });
    const store = yield* makeAgentMessageStore().pipe(Effect.provideService(SqlClient.SqlClient, client));
    const fs = yield* FileSystem.FileSystem;
    if (stage === "accept") {
      const input = yield* Config.String("BEEP_MESSAGE_FIXTURE_ENVELOPE");
      const message = yield* fs.readFileString(input).pipe(Effect.flatMap(S.decodeEffect(EnvelopeJson)));
      yield* store.accept(message, 100);
      yield* fs.writeFileString(checkpoint, "accepted", { mode: 0o600 });
    } else {
      const claim = yield* store.claimNext("b", "b-owner", 101, 201);
      yield* fs.writeFileString(checkpoint, O.isSome(claim) ? "claimed" : "none", { mode: 0o600 });
    }
    yield* Effect.never;
  })
);

await Effect.runPromise(program.pipe(Effect.provide(Layer.mergeAll(BunServices.layer, Reactivity.layer))));
