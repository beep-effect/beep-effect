import {
  M365,
  M365ConfigInput,
  M365DownloadDriveItemContentRequest,
  M365DownloadedContent,
  M365GetMessageRequest,
  M365ListDrivesRequest,
} from "@beep/m365";
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, pipe, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// Treat absent, blank, or unresolved `op://` reference values (present when
// secrets are not resolved, e.g. no local `op` session) as absent so the suite
// skips live Graph calls instead of authenticating with a non-token.
const envText = (name: string): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(Bun.env[name]),
    O.map(Str.trim),
    O.filter((value) => Str.isNonEmpty(value) && !Str.startsWith("op://")(value))
  );

const liveEnv = O.all({
  clientId: envText("M365_CLIENT_ID"),
  driveId: envText("M365_LIVE_DRIVE_ID"),
  itemId: envText("M365_LIVE_ITEM_ID"),
  messageId: envText("M365_LIVE_MESSAGE_ID"),
  siteId: envText("M365_LIVE_SITE_ID"),
  tenantId: envText("M365_TENANT_ID"),
  tokenCachePath: envText("M365_TOKEN_CACHE_PATH"),
});
const liveUserId = envText("M365_LIVE_USER_ID");

pipe(
  liveEnv,
  O.match({
    onNone: () =>
      describe("@beep/m365 live integration (M365_*)", () => {
        it("skips live Graph calls when required M365_* env or token cache settings are absent", () => {
          expect(O.isNone(liveEnv)).toBe(true);
        });
      }),
    onSome: (env) =>
      describe.concurrent("@beep/m365 live integration", () => {
        const LiveLayer = M365.makeLiveLayer(
          Result.getOrThrow(
            S.decodeUnknownResult(M365ConfigInput)({
              clientId: env.clientId,
              tenantId: env.tenantId,
              tokenCachePath: env.tokenCachePath,
            })
          )
        );

        layer(LiveLayer, { timeout: "60 seconds" })((it) => {
          it.effect(
            "lists a document library, downloads a file, and reads a message",
            Effect.fnUntraced(function* () {
              const m365 = yield* M365;
              const drives = yield* m365.listDrives(M365ListDrivesRequest.make({ siteId: O.some(env.siteId) }));
              const download = yield* m365.downloadDriveItemContent(
                M365DownloadDriveItemContentRequest.make({ driveId: env.driveId, itemId: env.itemId })
              );
              const message = yield* m365.getMessage(
                M365GetMessageRequest.make({ messageId: env.messageId, userId: liveUserId })
              );

              expect(drives.value.length).toBeGreaterThan(0);
              expect(message.id.length).toBeGreaterThan(0);
              if (download._tag === "M365DownloadedContent") {
                expect(download).toBeInstanceOf(M365DownloadedContent);
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
