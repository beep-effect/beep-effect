import {
  GraphContactProperty,
  M365,
  M365_CONTACT_SEED_PROPERTY_ID,
  M365AppOnlyConfigInput,
  M365CertificateCredential,
  M365ContactDraft,
  M365CreateContactRequest,
  M365CreateEventRequest,
  M365DeleteContactRequest,
  M365DeleteEventRequest,
  M365EventDraft,
  M365FindEventsByIdempotencyKeyRequest,
  M365ListContactFoldersRequest,
  M365ListContactsRequest,
  M365ListMasterCategoriesRequest,
  M365ListMessagesRequest,
  m365AllDayWindow,
} from "@beep/m365";
import { addDays, todayEffect } from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";

// Absent, blank, or unresolved `op://` values count as absent, so the suite
// skips instead of authenticating with a placeholder.
const envText = (name: string): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(Bun.env[name]),
    O.map(Str.trim),
    O.filter((value) => Str.isNonEmpty(value) && !Str.startsWith("op://")(value))
  );

const liveEnv = O.all({
  clientId: envText("M365_APP_ONLY_CLIENT_ID"),
  mailbox: envText("M365_APP_ONLY_MAILBOX"),
  privateKey: envText("M365_APP_ONLY_CERT_PRIVATE_KEY"),
  tenantId: envText("M365_APP_ONLY_TENANT_ID"),
  thumbprintSha256: envText("M365_APP_ONLY_CERT_THUMBPRINT_SHA256"),
});

// Reading needs credentials only. Writing a calendar entry into a real mailbox
// needs this second, explicit opt-in.
const liveContactsWrite = O.exists(envText("M365_LIVE_CONTACTS_WRITE"), (value) => value === "1");
const liveWrite = O.exists(envText("M365_LIVE_WRITE"), (value) => value === "1");

pipe(
  liveEnv,
  O.match({
    onNone: () =>
      describe("@beep/m365 app-only live integration (M365_APP_ONLY_*)", () => {
        it.skip("skips live Graph calls when the M365_APP_ONLY_* settings are absent", () => {
          assertNone(liveEnv);
        });
      }),
    onSome: (env) =>
      describe("@beep/m365 app-only live integration", () => {
        const userId = O.some(env.mailbox);
        const LiveLayer = M365.makeAppOnlyLiveLayer(
          M365AppOnlyConfigInput.make({
            clientId: S.NonEmptyString.make(env.clientId),
            maxRetries: S.Natural.make(0),
            credential: M365CertificateCredential.make({
              privateKey: Redacted.make(S.NonEmptyString.make(env.privateKey)),
              thumbprintSha256: S.NonEmptyString.make(env.thumbprintSha256),
            }),
            tenantId: S.NonEmptyString.make(env.tenantId),
          })
        );

        it.layer(LiveLayer, { timeout: "60 seconds" })((it) => {
          it.effect(
            "contacts smoke: lists the contact folders of the scoped mailbox",
            Effect.fnUntraced(function* () {
              const m365 = yield* M365;
              const page = yield* m365.listContactFolders(M365ListContactFoldersRequest.make({ userId }));
              yield* Effect.logInfo("Contacts folder probe passed", { count: A.length(page.value) });
              expect(A.length(page.value)).toBeGreaterThanOrEqual(0);
            })
          );
          (liveContactsWrite ? it.effect : it.effect.skip)(
            "contacts smoke: creates one marked synthetic contact, reads it back, and deletes it (M365_LIVE_CONTACTS_WRITE=1)",
            Effect.fnUntraced(function* () {
              const m365 = yield* M365;
              const marker = `smoke-${yield* TestClock.withLive(Clock.currentTimeMillis)}`;
              const created = yield* m365.createContact(
                M365CreateContactRequest.make({
                  userId,
                  contact: M365ContactDraft.make({
                    displayName: "[beep contacts smoke] safe to delete",
                    emailAddresses: [],
                    businessPhones: [],
                    categories: ["beep-practice-contacts-seed"],
                    singleValueExtendedProperties: [
                      GraphContactProperty.make({ id: M365_CONTACT_SEED_PROPERTY_ID, value: marker }),
                    ],
                  }),
                })
              );
              yield* Effect.gen(function* () {
                let nextLink: O.Option<string> = O.none();
                let found = false;
                do {
                  const page = yield* m365.listContacts(
                    M365ListContactsRequest.make({ userId, nextLink, expandMarker: true })
                  );
                  found ||= A.some(
                    page.value,
                    (contact) =>
                      contact.id === created.id &&
                      O.exists(contact.singleValueExtendedProperties, (properties) =>
                        A.some(
                          properties,
                          (property) => property.id === M365_CONTACT_SEED_PROPERTY_ID && property.value === marker
                        )
                      ) &&
                      O.exists(contact.categories, A.contains("beep-practice-contacts-seed"))
                  );
                  nextLink = page["@odata.nextLink"];
                } while (O.isSome(nextLink) && !found);
                expect(found).toBe(true);
              }).pipe(
                Effect.ensuring(
                  m365
                    .deleteContact(M365DeleteContactRequest.make({ userId, contactId: created.id }))
                    .pipe(Effect.orDie)
                )
              );
              yield* Effect.logInfo("Contacts smoke completed", { created: 1, deleted: 1 });
            })
          );

          it.effect(
            "reads one page of messages and the master categories of the scoped mailbox",
            Effect.fnUntraced(function* () {
              const m365 = yield* M365;
              const messages = yield* m365.listMessages(
                M365ListMessagesRequest.make({ orderby: O.some("receivedDateTime desc"), userId })
              );
              const categories = yield* m365.listMasterCategories(M365ListMasterCategoriesRequest.make({ userId }));

              yield* Effect.logInfo("M365 app-only live: read completed", {
                categoryCount: A.length(categories.value),
                messageCount: A.length(messages.value),
              });
              expect(A.length(messages.value)).toBeGreaterThanOrEqual(0);
            })
          );

          (liveWrite ? it.effect : it.effect.skip)(
            "creates one uniquely keyed test event, finds it by key, and deletes it (M365_LIVE_WRITE=1)",
            Effect.fnUntraced(function* () {
              const m365 = yield* M365;
              const today = yield* todayEffect;
              const idempotencyKey = `beep-live-smoke:${yield* Clock.currentTimeMillis}`;
              const created = yield* m365.createEvent(
                M365CreateEventRequest.make({
                  event: M365EventDraft.make({
                    ...m365AllDayWindow(addDays(today, 1), "UTC"),
                    isAllDay: true,
                    showAs: O.some("free"),
                    subject: "[beep live smoke] safe to delete",
                  }),
                  idempotencyKey: O.some(idempotencyKey),
                  userId,
                })
              );

              const found = yield* m365
                .findEventsByIdempotencyKey(M365FindEventsByIdempotencyKeyRequest.make({ idempotencyKey, userId }))
                .pipe(
                  Effect.ensuring(
                    m365.deleteEvent(M365DeleteEventRequest.make({ eventId: created.id, userId })).pipe(Effect.ignore)
                  )
                );

              expect(A.map(found.value, (event) => event.id)).toStrictEqual([created.id]);
            })
          );
        });
      }),
  })
);
