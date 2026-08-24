import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { KeyValueStore } from "effect/unstable/persistence";
import { StorageService, StorageServiceTest } from "../../Service/Storage.ts";
import { TicketService, TicketStorageError } from "../../Service/Ticket.ts";

const PersistFailureStorage = Layer.effect(
  StorageService,
  Effect.gen(function* () {
    const storage = yield* StorageService;
    return StorageService.of({
      ...storage,
      set: Effect.fn("TicketTest.Storage.set")((key) =>
        Effect.fail(
          new KeyValueStore.KeyValueStoreError({
            method: "set",
            key,
            message: "Injected ticket persistence failure",
          })
        )
      ),
    });
  })
).pipe(Layer.provide(StorageServiceTest));

const TicketPersistFailureLayer = TicketService.Default.pipe(Layer.provide(PersistFailureStorage));

describe("TicketService", () => {
  it.layer(TicketPersistFailureLayer)("with failing persistence", (it) => {
    it.effect(
      "does not issue a ticket when persistence fails",
      Effect.fnUntraced(function* () {
        const tickets = yield* TicketService;
        const error = yield* tickets.createTicket("ontology", "api-key").pipe(Effect.flip);

        assert.instanceOf(error, TicketStorageError);
        assert.strictEqual(error.operation, "persist");
      })
    );
  });
});
