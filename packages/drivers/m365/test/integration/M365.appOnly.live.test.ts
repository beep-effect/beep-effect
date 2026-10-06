import {
  M365,
  M365AppOnlyConfigInput,
  M365CertificateCredential,
  M365CreateEventRequest,
  M365DeleteEventRequest,
  M365EventDraft,
  M365FindEventsByIdempotencyKeyRequest,
  M365ListMasterCategoriesRequest,
  M365ListMessagesRequest,
  m365AllDayWindow,
} from "@beep/m365";
import { addDays, todayEffect } from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { Clock, Effect, pipe, Redacted } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

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
            credential: M365CertificateCredential.make({
              privateKey: Redacted.make(S.NonEmptyString.make(env.privateKey)),
              thumbprintSha256: S.NonEmptyString.make(env.thumbprintSha256),
            }),
            tenantId: S.NonEmptyString.make(env.tenantId),
          })
        );

        it.layer(LiveLayer, { timeout: "60 seconds" })((it) => {
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
