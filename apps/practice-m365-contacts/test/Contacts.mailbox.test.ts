import { M365, M365Auth, M365ConfigInput } from "@beep/m365";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Str from "effect/String";
import { ContactsMailbox, contactsMailboxLayer } from "@/Contacts.mailbox";

class RecordedRequests extends Context.Service<RecordedRequests, Ref.Ref<ReadonlyArray<string>>>()(
  "@beep/practice-m365-contacts/test/Contacts.mailbox.test/RecordedRequests"
) {}

const http = Layer.effect(
  HttpClient.HttpClient,
  RecordedRequests.use((requests) =>
    Effect.succeed(
      HttpClient.make((request) =>
        Ref.update(requests, A.append(`${request.method} ${request.url}`)).pipe(
          Effect.as(
            HttpClientResponse.fromWeb(
              request,
              new Response('{"value":[]}', { status: 200, headers: { "content-type": "application/json" } })
            )
          )
        )
      )
    )
  )
);
const graph = M365.makeLayer(
  M365ConfigInput.make({ tenantId: "common", clientId: "fixture-client", maxRetries: 0 })
).pipe(Layer.provide(M365Auth.layerStatic(Redacted.make("fixture-token"))), Layer.provide(http));
const Mailbox = contactsMailboxLayer("synthetic@example.test").pipe(
  Layer.provide(graph),
  Layer.provideMerge(Layer.effect(RecordedRequests, Ref.make<ReadonlyArray<string>>([])))
);

it.layer(Mailbox, { timeout: "30 seconds" })("mailbox HTTP boundary", (it) => {
  it.effect("reads an empty named mailbox without making any write requests", () =>
    Effect.gen(function* () {
      const inventory = yield* ContactsMailbox.use((mailbox) => mailbox.inventory);
      expect(inventory.folders).toEqual([]);
      expect(inventory.contacts).toEqual([]);
      const requests = yield* RecordedRequests;
      const recorded = yield* Ref.get(requests);
      expect(recorded).toHaveLength(2);
      expect(A.every(recorded, Str.startsWith("GET "))).toBe(true);
    })
  );
});
