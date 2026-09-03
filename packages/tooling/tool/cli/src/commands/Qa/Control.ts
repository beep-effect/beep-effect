/**
 * Out-of-band control of a live capture session (`beep qa stop` / `qa mark`).
 *
 * Both commands find the running collector through the `.beep/qa/current.json`
 * handle the recorder writes while it serves, then talk to it over the same
 * loopback HTTP surface the in-page witness posts to. Nothing here touches the
 * round directory: the recorder owns those writes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { MarkAccepted, SessionStore } from "@beep/qa-capture";
import { O } from "@beep/utils";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { HttpBody, HttpClient, HttpClientResponse } from "effect/unstable/http";
import { QaCommandError } from "./Qa.errors.ts";
import type { CollectorHandle } from "@beep/qa-capture";

const MarkPayload = S.Struct({ label: S.String });
const MarkPayloadJson = S.fromJsonString(MarkPayload);

/**
 * Read the live collector handle, failing politely when no session is running.
 *
 * **Example** (Verify Effect return)
 *
 * ```ts
 * import { requireLiveHandle } from "@beep/repo-cli/commands/Qa/Control"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(requireLiveHandle("/repo/.beep/qa"))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const requireLiveHandle = Effect.fn("QaControl.requireLiveHandle")(function* (
  qaRoot: string
): Effect.fn.Return<CollectorHandle, QaCommandError, SessionStore> {
  const store = yield* SessionStore;
  const handle = yield* store
    .readCollectorHandle(qaRoot)
    .pipe(QaCommandError.mapError("qa could not read the collector handle at .beep/qa/current.json."));
  return yield* Effect.fromOption(handle, () =>
    QaCommandError.make({
      message: "No live QA session: .beep/qa/current.json is absent. Start one with `bun run beep qa record` first.",
    })
  );
});

const collectorUrl = (handle: CollectorHandle, path: string): string => `http://127.0.0.1:${handle.port}${path}`;

const postToCollector = Effect.fn("QaControl.postToCollector")(function* (
  handle: CollectorHandle,
  path: string,
  body: HttpBody.HttpBody
): Effect.fn.Return<HttpClientResponse.HttpClientResponse, QaCommandError, HttpClient.HttpClient> {
  const url = collectorUrl(handle, path);
  const response = yield* HttpClient.post(url, { body }).pipe(
    QaCommandError.mapError(
      `qa could not reach the collector at ${url} (recorder pid ${handle.pid}). The session may have already exited; remove .beep/qa/current.json if it is stale.`
    )
  );
  return yield* HttpClientResponse.filterStatusOk(response).pipe(
    QaCommandError.mapError(`qa collector rejected ${path} (recorder pid ${handle.pid}).`)
  );
});

/**
 * Ask the live collector to stop, releasing the recorder from its wait.
 *
 * **Example** (Verify Effect return)
 *
 * ```ts
 * import { stopLiveSession } from "@beep/repo-cli/commands/Qa/Control"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(stopLiveSession("/repo/.beep/qa"))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const stopLiveSession = Effect.fn("QaControl.stopLiveSession")(function* (
  qaRoot: string
): Effect.fn.Return<CollectorHandle, QaCommandError, HttpClient.HttpClient | SessionStore> {
  const handle = yield* requireLiveHandle(qaRoot);
  yield* postToCollector(handle, "/stop", HttpBody.empty);
  return handle;
});

/**
 * Append a semantic marker to the live session's witness log.
 *
 * **Details**
 *
 * The witness marker model carries a label only, so `data` is appended to the
 * label rather than travelling in a separate field.
 *
 * **Example** (Mark session with label)
 *
 * ```ts
 * import { markLiveSession } from "@beep/repo-cli/commands/Qa/Control"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * console.log(Effect.isEffect(markLiveSession("/repo/.beep/qa", "gesture:sash-drag", O.none()))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const markLiveSession = Effect.fn("QaControl.markLiveSession")(function* (
  qaRoot: string,
  label: string,
  data: O.Option<string>
): Effect.fn.Return<MarkAccepted, QaCommandError, HttpClient.HttpClient | SessionStore> {
  const handle = yield* requireLiveHandle(qaRoot);
  const fullLabel = O.match(data, {
    onNone: () => label,
    onSome: (value) => `${label} ${value}`,
  });
  const json = yield* S.encodeEffect(MarkPayloadJson)({ label: fullLabel }).pipe(
    QaCommandError.mapError("qa could not encode the marker payload.")
  );
  const response = yield* postToCollector(handle, "/mark", HttpBody.text(json, "application/json"));
  const body = yield* response.json.pipe(QaCommandError.mapError("qa could not read the marker acknowledgement."));
  return yield* S.decodeUnknownEffect(MarkAccepted)(body).pipe(
    QaCommandError.mapError("qa could not decode the marker acknowledgement.")
  );
});
