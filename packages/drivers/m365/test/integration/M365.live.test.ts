import {
  M365,
  M365ConfigInput,
  M365DownloadDriveItemContentRequest,
  M365DownloadedContent,
  M365GetMessageRequest,
  M365ListDrivesRequest,
} from "@beep/m365";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodeM365ConfigInputResult = S.decodeResult(M365ConfigInput);

const resolvedEnvText = (name: string): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(Bun.env[name]),
    O.map(Str.trim),
    O.filter((value) => Str.isNonEmpty(value) && !Str.startsWith("op://")(value))
  );

const liveEnv = O.all({
  clientId: resolvedEnvText("M365_CLIENT_ID"),
  driveId: resolvedEnvText("M365_LIVE_DRIVE_ID"),
  itemId: resolvedEnvText("M365_LIVE_ITEM_ID"),
  messageId: resolvedEnvText("M365_LIVE_MESSAGE_ID"),
  siteId: resolvedEnvText("M365_LIVE_SITE_ID"),
  tenantId: resolvedEnvText("M365_TENANT_ID"),
  tokenCachePath: resolvedEnvText("M365_TOKEN_CACHE_PATH"),
});
const liveUserId = resolvedEnvText("M365_LIVE_USER_ID");

pipe(
  liveEnv,
  O.match({
    onNone: () =>
      describe("@beep/m365 live integration (M365_*)", () => {
        it.skip("skips live Graph calls when required M365_* settings are absent, blank or unresolved op:// references", () => {
          assertNone(liveEnv);
        });
      }),
    onSome: (env) =>
      describe.concurrent("@beep/m365 live integration", () => {
        const LiveLayer = M365.makeLiveLayer(
          Result.getOrThrow(
            decodeM365ConfigInputResult({
              clientId: env.clientId,
              tenantId: env.tenantId,
              tokenCachePath: env.tokenCachePath,
            })
          )
        );

        it.layer(LiveLayer, { timeout: "60 seconds" })((it) => {
          it.effect(
            "lists a document library, downloads a file, and reads a message",
            Effect.fnUntraced(function* () {
              const m365 = yield* M365;
              yield* Effect.logInfo("M365 live: listing drives");
              const drives = yield* m365.listDrives(M365ListDrivesRequest.make({ siteId: O.some(env.siteId) }));
              yield* Effect.logInfo("M365 live: downloading content");
              const download = yield* m365.downloadDriveItemContent(
                M365DownloadDriveItemContentRequest.make({ driveId: env.driveId, itemId: env.itemId })
              );
              yield* Effect.logInfo("M365 live: reading message");
              const message = yield* m365.getMessage(
                M365GetMessageRequest.make({ messageId: env.messageId, userId: liveUserId })
              );

              yield* Effect.logInfo("M365 live: requests completed");

              expect(drives.value.length).toBeGreaterThan(0);
              expect(message.id.length).toBeGreaterThan(0);
              if (download._tag === "M365DownloadedContent") {
                expect(S.is(M365DownloadedContent)(download)).toBe(true);
                expect(download.bytes.byteLength).toBeGreaterThan(0);
              } else {
                expect(download.reason.length).toBeGreaterThan(0);
              }
            })
          );
        });
      }),
  })
);
