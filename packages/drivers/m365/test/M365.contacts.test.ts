import {
  GraphContact,
  GraphContactProperty,
  M365,
  M365_CONTACT_SEED_PROPERTY_ID,
  M365AppOnlyConfigInput,
  M365Auth,
  M365ClientSecretCredential,
  M365ConfigInput,
  M365ContactDraft,
  M365CreateContactFolderRequest,
  M365CreateContactRequest,
  M365DeleteContactFolderRequest,
  M365DeleteContactRequest,
  M365ListContactFoldersRequest,
  M365ListContactsRequest,
} from "@beep/m365";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import type { M365Error } from "@beep/m365";

class Capture extends S.Class<Capture>("@beep/m365/test/contacts/Capture")({
  method: S.String,
  url: S.String,
  headers: S.Record(S.String, S.String),
  body: S.Option(S.Unknown),
}) {}
class Captures extends Context.Service<Captures, Ref.Ref<ReadonlyArray<Capture>>>()(
  "@beep/m365/test/M365.contacts.test/Captures"
) {}
const CapturesLive = Layer.effect(Captures, Ref.make<ReadonlyArray<Capture>>([]));
const draft = M365ContactDraft.make({
  displayName: "Fixture person",
  emailAddresses: [],
  businessPhones: [],
  categories: ["beep-practice-contacts-seed"],
  singleValueExtendedProperties: [
    GraphContactProperty.make({ id: M365_CONTACT_SEED_PROPERTY_ID, value: "fixture-run" }),
  ],
});
const wire = {
  id: "contact-fixture",
  displayName: "Fixture person",
  givenName: null,
  mobilePhone: null,
  emailAddresses: [],
  categories: ["beep-practice-contacts-seed"],
  changeKey: "version-1",
  personalNotes: "Private synthetic backup field",
};
const base = "https://graph.microsoft.com/v1.0";
const fixturePayload = (method: string, url: string) => {
  if (method === "POST")
    return url.endsWith("contactFolders") ? { id: "folder-fixture", displayName: "Fixture folder" } : wire;
  const folders = url.includes("contactFolders") && !url.includes("/contacts");
  return { value: folders ? [{ id: "folder-fixture", displayName: null }] : [wire] };
};
const layer = (appOnly: boolean, status = 200, transport = false, retries = 0) => {
  const http = Layer.effect(
    HttpClient.HttpClient,
    Effect.gen(function* () {
      const captures = yield* Captures;
      return HttpClient.make(
        Effect.fnUntraced(function* (request) {
          const url = request.pipe(HttpClientRequest.toUrl, O.getOrThrow).toString();
          const body =
            request.body._tag === "Uint8Array"
              ? S.decodeOption(S.fromJsonString(S.Unknown))(new TextDecoder().decode(request.body.body))
              : O.none();
          yield* Ref.update(
            captures,
            A.append(Capture.make({ method: request.method, url, headers: request.headers, body }))
          );
          if (transport)
            return yield* new HttpClientError.HttpClientError({
              reason: new HttpClientError.TransportError({ request }),
            });
          const response =
            request.method === "DELETE"
              ? new Response(null, { status: 204 })
              : Response.json(fixturePayload(request.method, url), { status, headers: { "retry-after": "0" } });
          return HttpClientResponse.fromWeb(request, response);
        })
      );
    })
  );
  const config = M365ConfigInput.make({
    tenantId: "common",
    clientId: "fixture-client",
    maxRetries: S.Natural.make(retries),
  });
  const service = appOnly
    ? M365.makeAppOnlyLayer(
        M365AppOnlyConfigInput.make({
          tenantId: "fixture-tenant",
          clientId: "fixture-client",
          maxRetries: S.Natural.make(retries),
          credential: M365ClientSecretCredential.make({ clientSecret: Redacted.make("fixture-secret") }),
        })
      )
    : M365.makeLayer(config);
  return service.pipe(
    Layer.provide(M365Auth.layerStatic(Redacted.make("fixture-token"))),
    Layer.provide(http),
    Layer.provideMerge(CapturesLive)
  );
};
const failed = <A>(effect: Effect.Effect<A, M365Error>) =>
  Effect.exit(effect).pipe(
    Effect.map((exit) =>
      exit._tag === "Failure" ? O.map(Cause.findErrorOption(exit.cause), (error) => error.reason) : O.none()
    )
  );

describe("contact verbs", () => {
  it.effect(
    "accepts only approved delegated read scopes",
    Effect.fnUntraced(function* () {
      const config = { tenantId: "common", clientId: "fixture-client" };
      const accepted = yield* S.decodeEffect(M365ConfigInput)({ ...config, scopes: ["User.Read", "Mail.Read"] });
      expect(accepted.scopes).toEqual(["User.Read", "Mail.Read"]);
      for (const scope of ["Contacts.ReadWrite", "Mail.Send", "Files.ReadWrite.All", "unlisted-scope"]) {
        const result = yield* Effect.exit(S.decodeUnknownEffect(M365ConfigInput)({ ...config, scopes: [scope] }));
        expect(result._tag).toBe("Failure");
      }
    })
  );
  for (const appOnly of [false, true]) {
    const userId = appOnly ? O.some("fixture-mailbox") : O.none();
    const route = appOnly ? `${base}/users/fixture-mailbox` : `${base}/me`;
    it.layer(layer(appOnly))((it) => {
      it.effect(
        `creates and deletes contacts and folders on ${appOnly ? "app-only" : "delegated"}`,
        Effect.fnUntraced(function* () {
          const m365 = yield* M365;
          const contact = yield* m365.createContact(
            M365CreateContactRequest.make({ userId, contact: draft, folderId: O.some("folder-fixture") })
          );
          const folder = yield* m365.createContactFolder(
            M365CreateContactFolderRequest.make({ userId, displayName: "Fixture folder" })
          );
          yield* m365.deleteContact(
            M365DeleteContactRequest.make({
              userId,
              folderId: O.some(folder.id),
              contactId: contact.id,
              changeKey: O.some("version-1"),
            })
          );
          yield* m365.deleteContactFolder(M365DeleteContactFolderRequest.make({ userId, folderId: folder.id }));
          assertNone(contact.givenName);
          assertNone(contact.mobilePhone);
          assertSome(contact.changeKey, "version-1");
          assertSome(contact.rawJson, wire);
          const captures = yield* Ref.get(yield* Captures);
          expect(A.map(captures, (capture) => `${capture.method} ${capture.url}`)).toEqual([
            `POST ${route}/contactFolders/folder-fixture/contacts`,
            `POST ${route}/contactFolders`,
            `DELETE ${route}/contactFolders/folder-fixture/contacts/contact-fixture`,
            `DELETE ${route}/contactFolders/folder-fixture`,
          ]);
          assertSome(
            O.flatMap(A.head(captures), (capture) => capture.body),
            {
              displayName: "Fixture person",
              emailAddresses: [],
              businessPhones: [],
              categories: ["beep-practice-contacts-seed"],
              singleValueExtendedProperties: [{ id: M365_CONTACT_SEED_PROPERTY_ID, value: "fixture-run" }],
            }
          );
          assertSome(
            O.map(A.head(captures), (capture) => capture.headers["content-type"]),
            "application/json"
          );
          assertSome(
            O.map(A.get(captures, 2), (capture) => capture.headers["if-match"]),
            'W/"version-1"'
          );
        })
      );
    });

    it.layer(layer(appOnly))((it) => {
      it.effect(
        `lists default, folder and child resources on ${appOnly ? "app-only" : "delegated"}`,
        Effect.fnUntraced(function* () {
          const m365 = yield* M365;
          const contacts = yield* m365.listContacts(M365ListContactsRequest.make({ userId, expandMarker: true }));
          const folders = yield* m365.listContactFolders(
            M365ListContactFoldersRequest.make({ userId, parentFolderId: O.some("parent-fixture") })
          );
          yield* m365.listContacts(M365ListContactsRequest.make({ userId, folderId: O.some("folder-fixture") }));
          expect(contacts.value).toHaveLength(1);
          assertNone(O.getOrThrow(A.head(folders.value)).displayName);
          const captures = yield* Ref.get(yield* Captures);
          const url = new URL(O.getOrThrow(A.head(captures)).url);
          expect(url.pathname).toBe(`${new URL(route).pathname}/contacts`);
          expect(url.searchParams.get("$expand")).toBe(
            `singleValueExtendedProperties($filter=id eq '${M365_CONTACT_SEED_PROPERTY_ID}')`
          );
          assertSome(
            O.map(A.get(captures, 1), (capture) => capture.url),
            `${route}/contactFolders/parent-fixture/childFolders`
          );
          assertSome(
            O.map(A.get(captures, 2), (capture) => capture.url),
            `${route}/contactFolders/folder-fixture/contacts`
          );
        })
      );
    });

    for (const [status, transport, reason] of [
      [429, false, "throttled"],
      [503, false, "ambiguous write"],
      [200, true, "ambiguous write"],
    ] satisfies ReadonlyArray<readonly [number, boolean, string]>) {
      it.layer(layer(appOnly, status, transport, 3))((it) => {
        it.effect(
          `never replays ${appOnly ? "app-only" : "delegated"} contact POST after ${reason} ${status}`,
          Effect.fnUntraced(function* () {
            const m365 = yield* M365;
            assertSome(
              yield* failed(m365.createContact(M365CreateContactRequest.make({ userId, contact: draft }))),
              reason
            );
            expect(yield* Ref.get(yield* Captures)).toHaveLength(1);
          })
        );
      });
    }
  }
  it.layer(layer(true))((it) => {
    it.effect(
      "accepts same-mailbox continuation with equivalent path encoding",
      Effect.fnUntraced(function* () {
        const m365 = yield* M365;
        const page = yield* m365.listContacts(
          M365ListContactsRequest.make({
            userId: O.some("fixture@example.test"),
            nextLink: O.some(`${base}/users/fixture@example.test/contacts?$skiptoken=fixture-page`),
          })
        );
        expect(page.value).toHaveLength(1);
        expect(yield* Ref.get(yield* Captures)).toHaveLength(1);
      })
    );
  });
  it.layer(layer(true))((it) => {
    it.effect(
      "refuses all app-only /me addressing and cross-mailbox pagination",
      Effect.fnUntraced(function* () {
        const m365 = yield* M365;
        const failures = yield* Effect.all(
          [
            failed(m365.createContact(M365CreateContactRequest.make({ contact: draft }))),
            failed(m365.createContactFolder(M365CreateContactFolderRequest.make({ displayName: "Fixture folder" }))),
            failed(m365.listContacts(M365ListContactsRequest.make({}))),
            failed(m365.listContactFolders(M365ListContactFoldersRequest.make({}))),
            failed(m365.deleteContact(M365DeleteContactRequest.make({ contactId: "fixture" }))),
            failed(
              m365.listContacts(
                M365ListContactsRequest.make({
                  userId: O.some("fixture-mailbox"),
                  nextLink: O.some(`${base}/users/other-fixture/contacts`),
                })
              )
            ),
            failed(
              m365.listContacts(
                M365ListContactsRequest.make({
                  userId: O.some("fixture-mailbox"),
                  nextLink: O.some(`${base}/me/contacts`),
                })
              )
            ),
          ],
          { concurrency: 1 }
        );
        for (const failure of failures) assertSome(failure, "request encoding");
        expect(yield* Ref.get(yield* Captures)).toHaveLength(0);
      })
    );
  });
  it.effect(
    "round-trips null-safe response models",
    Effect.fnUntraced(function* () {
      const contact = yield* S.decodeEffect(GraphContact)(wire);
      const encoded = yield* S.encodeEffect(GraphContact)(contact);
      expect(encoded).not.toHaveProperty("givenName");
      assertNone(contact.givenName);
    })
  );
});
