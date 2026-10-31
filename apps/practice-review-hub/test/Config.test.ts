import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Terminal from "effect/Terminal";
import { decodeReviewHubConfig, ReviewNoticeConfig, reviewNoticeFlags } from "@/Config";
import { Platform } from "./Hub.fixture.ts";

// What a command line needs to run in a test: the real file system and paths, and no terminal or processes.
const CommandEnvironment = Layer.mergeAll(
  Platform,
  Stdio.layerTest({}),
  Layer.succeed(
    Terminal.Terminal,
    Terminal.make({
      columns: Effect.succeed(80),
      rows: Effect.succeed(24),
      size: Effect.die("Unexpected terminal size subscription"),
      readInput: Effect.die("Unexpected terminal input"),
      readLine: Effect.die("Unexpected terminal input"),
      display: () => Effect.void,
    })
  ),
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.die("Unexpected process execution"))
  )
);

const noticeConfig = (claudeFolder: O.Option<string>) =>
  S.decodeEffect(ReviewNoticeConfig)({ claudeFolder, dataDirectory: "/synthetic/review-hub", timeZone: "UTC" });

// Runs `notice` with the given extra arguments and environment, and returns the Claude Code folder it resolved.
const resolvedFolder = Effect.fnUntraced(function* (
  args: ReadonlyArray<string>,
  environment: Readonly<Record<string, string>>
) {
  const seen = yield* Ref.make<ReadonlyArray<string>>([]);
  const notice = Command.make("notice", reviewNoticeFlags, (flags) =>
    Effect.flatMap(S.decodeEffect(ReviewNoticeConfig)(flags), ({ claudeFolder }) =>
      Ref.update(seen, A.append(O.getOrElse(claudeFolder, () => "none")))
    )
  );
  yield* Command.runWith(notice, { version: "0.0.0" })([
    "--data-dir",
    "/synthetic/review-hub",
    "--time-zone",
    "UTC",
    ...args,
  ]).pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(environment)));
  return yield* Ref.get(seen);
});

describe("review hub configuration", () => {
  it.effect("trims the login allow-list and preserves the configured server settings", () =>
    Effect.gen(function* () {
      const config = yield* decodeReviewHubConfig({
        allowedLogins: " attorney@example.test, , paralegal@example.test ",
        dataDirectory: "/synthetic/review-hub",
        port: 8787,
      }).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ PRACTICE_REVIEW_HUB_API_TOKEN: "synthetic-test-token-with-32-characters" })
        )
      );
      expect(config.allowedLogins).toEqual(["attorney@example.test", "paralegal@example.test"]);
      expect(config.dataDirectory).toBe("/synthetic/review-hub");
      expect(config.port).toBe(8787);
    })
  );

  it.effect("rejects an empty allow-list, an empty data directory, and an invalid port", () =>
    Effect.gen(function* () {
      const valid = {
        allowedLogins: "attorney@example.test",
        dataDirectory: "/synthetic/review-hub",
        port: 8787,
      };
      for (const invalid of [
        { ...valid, allowedLogins: " , " },
        { ...valid, dataDirectory: "" },
        { ...valid, port: 65536 },
      ]) {
        expect(
          (yield* decodeReviewHubConfig(invalid).pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromUnknown({ PRACTICE_REVIEW_HUB_API_TOKEN: "synthetic-test-token-with-32-characters" })
            ),
            Effect.result
          ))._tag
        ).toBe("Failure");
      }
    })
  );

  it.effect("accepts an absolute Windows review folder with either separator, or none", () =>
    Effect.gen(function* () {
      const folders = yield* Effect.forEach(
        [O.some("C:\\Users\\attorney\\Review"), O.some("C:/Users/attorney/Review"), O.none()],
        noticeConfig
      );
      expect(A.map(folders, ({ claudeFolder }) => O.getOrElse(claudeFolder, () => "none"))).toStrictEqual([
        "C:\\Users\\attorney\\Review",
        "C:/Users/attorney/Review",
        "none",
      ]);
    })
  );

  it.effect("rejects a relative, drive-relative, POSIX, dot-segment or invisible-character review folder", () =>
    Effect.gen(function* () {
      const folders = [
        "Review",
        "Users\\attorney\\Review",
        "C:Review",
        "/srv/review",
        "C:/Users/attorney/../Review",
        "C:/Users/./Review",
        "C:/Users/attorney/Review\u202E",
      ];
      const results = yield* Effect.forEach(folders, (folder) => O.some(folder).pipe(noticeConfig, Effect.result));
      expect(A.map(results, ({ _tag }) => _tag)).toStrictEqual(A.map(folders, () => "Failure"));
    })
  );

  it.layer(CommandEnvironment, { timeout: "10 seconds" })("notice flags", (it) => {
    it.effect("reads --claude-folder, then PRACTICE_REVIEW_NOTICE_CLAUDE_FOLDER, and is none without either", () =>
      Effect.gen(function* () {
        const fromFlag = yield* resolvedFolder(["--claude-folder", "C:/Users/attorney/Review"], {});
        const fromEnvironment = yield* resolvedFolder([], {
          PRACTICE_REVIEW_NOTICE_CLAUDE_FOLDER: "C:\\Users\\attorney\\Review",
        });
        const flagFirst = yield* resolvedFolder(["--claude-folder", "C:/Users/attorney/Review"], {
          PRACTICE_REVIEW_NOTICE_CLAUDE_FOLDER: "D:/Elsewhere",
        });
        const neither = yield* resolvedFolder([], {});

        expect([fromFlag, fromEnvironment, flagFirst, neither]).toStrictEqual([
          ["C:/Users/attorney/Review"],
          ["C:\\Users\\attorney\\Review"],
          ["C:/Users/attorney/Review"],
          ["none"],
        ]);
      })
    );
  });
});
