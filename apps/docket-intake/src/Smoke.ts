/**
 * Live smoke check of the mailbox connection. Read-only unless asked to
 * write; the write check creates one clearly labelled event and deletes it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocketIntakeId } from "@beep/identity/packages";
import { DocketCategory } from "@beep/law-practice-domain/values/DocketDeadline";
import { docketDayInZone } from "@beep/law-practice-server/DocketIntake";
import {
  M365,
  M365CreateEventRequest,
  M365DeleteEventRequest,
  M365EventDraft,
  M365FindEventsByIdempotencyKeyRequest,
  M365ListMasterCategoriesRequest,
  M365ListMessagesRequest,
  m365AllDayWindow,
} from "@beep/m365";
import { addDays } from "@beep/schema/LocalDate";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { M365Error, M365Shape } from "@beep/m365";
import type { DocketIntakeAppConfig } from "./Config.ts";

const $I = $DocketIntakeId.create("Smoke");

/**
 * **Example** (Report two failed smoke steps)
 *
 * ```ts
 * import { DocketIntakeSmokeFailed } from "../../src/Smoke.ts"
 *
 * console.log(DocketIntakeSmokeFailed.make({ failed: 2 }).failed) // 2
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DocketIntakeSmokeFailed extends S.TaggedError<DocketIntakeSmokeFailed, { readonly brand: unique symbol }>(
  $I`DocketIntakeSmokeFailed`
)(
  "DocketIntakeSmokeFailed",
  {
    failed: S.Natural.annotateKey({ description: "How many steps failed." }),
  },
  $I.annote("DocketIntakeSmokeFailed", { description: "At least one docket intake smoke step failed." })
) {}

const SMOKE_SUBJECT = "[beep live smoke] safe to delete";
const SMOKE_PAGE_SIZE = 10;
const SMOKE_KEY_BYTES = 8;

const errorLabel = (error: M365Error): string =>
  O.match(error.status, {
    onNone: () => error.reason,
    onSome: (status) => `${error.reason} ${status}`,
  });

const step = <A>(
  name: string,
  effect: Effect.Effect<A, M365Error>,
  describe: (value: A) => string
): Effect.Effect<O.Option<A>> =>
  effect.pipe(
    Effect.matchEffect({
      onFailure: (error) => Console.log(`FAIL ${name}: ${errorLabel(error)}`).pipe(Effect.as(O.none<A>())),
      onSuccess: (value) => Console.log(`PASS ${name}: ${describe(value)}`).pipe(Effect.as(O.some(value))),
    })
  );

const isDocketCategory = S.is(DocketCategory);

const readSteps = Effect.fnUntraced(function* (m365: M365Shape, config: DocketIntakeAppConfig) {
  const userId = O.some(config.mailbox);
  const messages = yield* step(
    "list messages",
    m365.listMessages(M365ListMessagesRequest.make({ top: O.some(SMOKE_PAGE_SIZE), userId })),
    (page) => `count=${A.length(page.value)}`
  );
  const categories = yield* step(
    "list master categories",
    m365.listMasterCategories(M365ListMasterCategoriesRequest.make({ userId })),
    (page) =>
      `count=${A.length(page.value)} docket=${A.length(A.filter(page.value, (category) => isDocketCategory(category.displayName)))}`
  );
  return [O.isSome(messages), O.isSome(categories)];
});

const writeSteps = Effect.fnUntraced(function* (m365: M365Shape, config: DocketIntakeAppConfig) {
  const crypto = yield* SecureRandom.SecureRandom;
  const userId = O.some(config.mailbox);
  const randomBytes1 = yield* crypto.randomBytes(SMOKE_KEY_BYTES);
  const key = `smoke:${Hex.encode(randomBytes1)}`;
  const now2 = yield* DateTime.now;
  const tomorrow = addDays(docketDayInZone(now2, config.timeZone), 1);

  const created = yield* step(
    "create event",
    m365.createEvent(
      M365CreateEventRequest.make({
        event: M365EventDraft.make({
          ...m365AllDayWindow(tomorrow, DateTime.zoneToString(config.timeZone)),
          isAllDay: true,
          isReminderOn: O.some(false),
          showAs: O.some("free"),
          subject: SMOKE_SUBJECT,
        }),
        idempotencyKey: O.some(key),
        userId,
      })
    ),
    (event) => `id=${event.id}`
  );
  const found = yield* step(
    "find event by key",
    m365.findEventsByIdempotencyKey(M365FindEventsByIdempotencyKeyRequest.make({ idempotencyKey: key, userId })),
    (page) => `count=${A.length(page.value)}`
  );
  const events = O.match(found, { onNone: A.empty<string>, onSome: (page) => A.map(page.value, (e) => e.id) });
  const deleted = yield* Effect.forEach(
    events,
    (eventId) =>
      step("delete event", m365.deleteEvent(M365DeleteEventRequest.make({ eventId, userId })), () => `id=${eventId}`),
    { concurrency: 1 }
  );
  return [O.isSome(created), A.isReadonlyArrayNonEmpty(events), A.every(deleted, O.isSome)];
});

/**
 * Run the smoke check and fail when any step failed.
 *
 * **Gotchas**
 *
 * Find the event by its idempotency key even if creation reported failure: the remote write may already have landed.
 *
 * **Example** (Reference the smoke check)
 *
 * ```ts
 * import { smoke } from "../../src/Smoke.ts"
 *
 * console.log(smoke)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const smoke = Effect.fn("DocketIntakeApp.smoke")(function* (config: DocketIntakeAppConfig, write: boolean) {
  const m365 = yield* M365;
  const read = yield* readSteps(m365, config);
  const written = write ? yield* writeSteps(m365, config) : A.empty<boolean>();
  const failed = A.length(A.filter(A.appendAll(read, written), (passed) => !passed));
  yield* Console.log(failed === 0 ? "PASS smoke" : `FAIL smoke: ${failed} step(s) failed`);
  if (failed > 0) {
    return yield* DocketIntakeSmokeFailed.make({ failed });
  }
});
