/**
 * The file-backed mail-tagging adapters over a scoped temporary directory:
 * the matter folder-id map, the known-documents index, and the Box API-call
 * ledger. Every key, id, and hash is synthetic.
 */

import { ContentSha256, MatterKey } from "@beep/law-practice-domain/values/MailTagging";
import {
  BoxCallLedgerConfig,
  BoxCallLedgerFile,
  BoxCallLedgerLocation,
  KnownDocumentsConfig,
  KnownDocumentsFile,
  KnownDocumentsLocation,
  MatterFolderDirectoryFile,
  MatterFolderMapConfig,
  MatterFolderMapLocation,
  ProviderCallMeter,
  ProviderCalls,
} from "@beep/law-practice-server/MailTagging";
import {
  KnownDocumentRequest,
  KnownDocuments,
  MailTaggingStateError,
  MatterFolderDirectory,
  MatterFolderRequest,
} from "@beep/law-practice-use-cases/MailTagging";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { linesOf, oneRun, Platform, serviceOf, temporaryDirectory, writeText } from "./MailTagging.adapters.fixture.ts";
import type { FilingDestination } from "@beep/law-practice-domain/values/MailTagging";

const acme = MatterKey.make("1234.10001");
const globex = MatterKey.make("5678.20002");
const sha = (digit: string) => ContentSha256.make(Str.repeat(64)(digit));

const foldersAt = (path: string) =>
  serviceOf(MatterFolderDirectory)(
    MatterFolderDirectoryFile.pipe(
      Layer.provide(Layer.succeed(MatterFolderMapLocation, MatterFolderMapConfig.make({ path })))
    )
  );

const knownAt = (path: string) =>
  serviceOf(KnownDocuments)(
    KnownDocumentsFile.pipe(Layer.provide(Layer.succeed(KnownDocumentsLocation, KnownDocumentsConfig.make({ path }))))
  );

const meterAt = (path: string, runLabel: string) =>
  serviceOf(ProviderCallMeter)(
    BoxCallLedgerFile.pipe(
      Layer.provide(Layer.succeed(BoxCallLedgerLocation, BoxCallLedgerConfig.make({ path, runLabel })))
    )
  );

const folderMap = (usptoIncomingFolderId: string) =>
  `[{"familyKey":"1234.10001","usptoIncomingFolderId":"${usptoIncomingFolderId}","fromClientFolderId":"9002","matterFolderId":"9000","clientName":"ignored"}]`;

const stateError = (error: unknown) => {
  assertInstanceOf(error, MailTaggingStateError);
  return [error.store, error.failure, error.file, O.getOrNull(error.line)];
};

// The folder id one run resolves; null when the matter has no folder.
const folderOfRun = (path: string, matterKey: MatterKey, destination: FilingDestination) =>
  oneRun(
    Effect.flatMap(foldersAt(path), (folders) =>
      folders.folderFor(MatterFolderRequest.make({ matterKey, destination }))
    )
  ).pipe(Effect.map(O.getOrNull));

const knownInRun = (path: string, contentSha256: ContentSha256, matterKey: MatterKey) =>
  oneRun(Effect.flatMap(knownAt(path), (known) => known.has(KnownDocumentRequest.make({ contentSha256, matterKey }))));

const box = (calls: number) => ProviderCalls.make({ provider: "box", calls });

describe("MailTagging file adapters", () => {
  it.layer(Platform, { timeout: "30 seconds" })("matter folder map", (it) => {
    it.effect(
      "resolves each destination to its column, tolerates extra keys, and has no folder for an unlisted matter",
      Effect.fnUntraced(function* () {
        const temporaryDirectory1 = yield* temporaryDirectory;
        const path = yield* writeText(temporaryDirectory1, "matter-folders.json", folderMap("9001"));

        const folderOfRun2 = yield* folderOfRun(path, acme, "uspto-incoming");
        expect(folderOfRun2).toBe("9001");
        const folderOfRun3 = yield* folderOfRun(path, acme, "from-client");
        expect(folderOfRun3).toBe("9002");
        const folderOfRun4 = yield* folderOfRun(path, globex, "uspto-incoming");
        expect(folderOfRun4).toBeNull();
      })
    );

    it.effect(
      "shows a regenerated map to the next run",
      Effect.fnUntraced(function* () {
        const directory = yield* temporaryDirectory;
        const path = yield* writeText(directory, "matter-folders.json", folderMap("9001"));
        const before = yield* folderOfRun(path, acme, "uspto-incoming");
        yield* writeText(directory, "matter-folders.json", folderMap("9777"));

        expect([before, yield* folderOfRun(path, acme, "uspto-incoming")]).toStrictEqual(["9001", "9777"]);
      })
    );

    it.effect(
      "fails closed on a map that does not decode or does not exist, naming the file only",
      Effect.fnUntraced(function* () {
        const directory = yield* temporaryDirectory;
        const path = yield* Path.Path;
        const corrupt = yield* writeText(directory, "matter-folders.json", '[{"familyKey":"1234.10001"}]');
        const missing = path.join(directory, "absent.json");

        const flip5 = yield* Effect.flip(folderOfRun(corrupt, acme, "from-client"));
        expect(stateError(flip5)).toStrictEqual(["matter-folders", "corrupt", "matter-folders.json", null]);
        const flip6 = yield* Effect.flip(folderOfRun(missing, acme, "from-client"));
        expect(stateError(flip6)).toStrictEqual(["matter-folders", "unavailable", "absent.json", null]);
      })
    );
  });

  it.layer(Platform, { timeout: "30 seconds" })("known documents", (it) => {
    it.effect(
      "knows a hash under its family key only, in either letter case, and ignores the other keys of a line",
      Effect.fnUntraced(function* () {
        const index = [
          `{"sha256":"${Str.repeat(64)("A")}","boxFileId":"7001","boxPath":"ignored","familyKey":"1234.10001"}`,
          "",
          `{"sha256":"${sha("b")}","familyKey":"5678.20002"}`,
        ];
        const temporaryDirectory7 = yield* temporaryDirectory;
        const path = yield* writeText(temporaryDirectory7, "box-files.jsonl", A.join(index, "\n"));

        const knownInRun8 = yield* knownInRun(path, sha("a"), acme);
        expect(knownInRun8).toBe(true);
        const knownInRun9 = yield* knownInRun(path, sha("a"), globex);
        expect(knownInRun9).toBe(false);
        const knownInRun10 = yield* knownInRun(path, sha("b"), globex);
        expect(knownInRun10).toBe(true);
        const knownInRun11 = yield* knownInRun(path, sha("c"), acme);
        expect(knownInRun11).toBe(false);
      })
    );

    it.effect(
      "ignores files held outside any matter, whether the family key is null or absent",
      Effect.fnUntraced(function* () {
        const temporaryDirectory12 = yield* temporaryDirectory;
        const path = yield* writeText(
          temporaryDirectory12,
          "box-files.jsonl",
          A.join(
            [
              `{"sha256":"${sha("a")}","familyKey":null,"boxFileId":"9001"}`,
              `{"sha256":"${sha("b")}","boxFileId":"9002"}`,
              `{"sha256":"${sha("c")}","familyKey":"1234.10001","boxFileId":"9003"}`,
            ],
            "\n"
          )
        );

        const knownInRun13 = yield* knownInRun(path, sha("a"), acme);
        expect(knownInRun13).toBe(false);
        const knownInRun14 = yield* knownInRun(path, sha("b"), acme);
        expect(knownInRun14).toBe(false);
        const knownInRun15 = yield* knownInRun(path, sha("c"), acme);
        expect(knownInRun15).toBe(true);
      })
    );

    it.effect(
      "shows a regenerated index to the next run",
      Effect.fnUntraced(function* () {
        const directory = yield* temporaryDirectory;
        const path = yield* writeText(directory, "box-files.jsonl", "");
        const before = yield* knownInRun(path, sha("a"), acme);
        yield* writeText(directory, "box-files.jsonl", `{"sha256":"${sha("a")}","familyKey":"1234.10001"}\n`);

        expect([before, yield* knownInRun(path, sha("a"), acme)]).toStrictEqual([false, true]);
      })
    );

    it.effect(
      "fails closed on a malformed line with the file and line number, and on a missing index",
      Effect.fnUntraced(function* () {
        const directory = yield* temporaryDirectory;
        const path = yield* Path.Path;
        const corrupt = yield* writeText(
          directory,
          "box-files.jsonl",
          `{"sha256":"${sha("a")}","familyKey":"1234.10001"}\n{"sha256":"not-a-hash","familyKey":"1234.10001"}\n`
        );
        const error = yield* Effect.flip(knownInRun(corrupt, sha("a"), acme));

        expect(stateError(error)).toStrictEqual(["known-documents", "corrupt", "box-files.jsonl", 2]);
        expect(error.message).toBe("box-files.jsonl line 2 did not decode");
        const flip16 = yield* Effect.flip(knownInRun(path.join(directory, "absent.jsonl"), sha("a"), acme));
        expect(stateError(flip16)).toStrictEqual(["known-documents", "unavailable", "absent.jsonl", null]);
      })
    );
  });

  it.layer(Platform, { timeout: "30 seconds" })("Box call ledger", (it) => {
    it.effect(
      "appends one line per run with the run's total, also when the run fails, and none for a run without calls",
      Effect.fnUntraced(function* () {
        const path = yield* Path.Path;
        const temporaryDirectory17 = yield* temporaryDirectory;
        const ledger = path.join(temporaryDirectory17, "shared", "box-api-calls.jsonl");
        yield* oneRun(
          Effect.gen(function* () {
            const meter = yield* meterAt(ledger, "run-0001");
            yield* meter.record(box(2));
            yield* meter.record(box(1));
            const linesOf18 = yield* linesOf(ledger);
            expect(linesOf18).toStrictEqual([]);
          })
        );
        const failed = yield* Effect.gen(function* () {
          const meter = yield* meterAt(ledger, "run-0002");
          yield* meter.record(box(4));
          return yield* Effect.fail("upload refused");
        }).pipe(oneRun, Effect.exit);
        yield* oneRun(meterAt(ledger, "run-0003"));

        expect(failed._tag).toBe("Failure");
        const linesOf19 = yield* linesOf(ledger);
        expect(linesOf19).toStrictEqual([
          '{"workstream":"email-tagging","runLabel":"run-0001","calls":3,"at":"1970-01-01T00:00:00.000Z","exact":true}',
          '{"workstream":"email-tagging","runLabel":"run-0002","calls":4,"at":"1970-01-01T00:00:00.000Z","exact":true}',
        ]);
      })
    );

    it.effect(
      "keeps the run's outcome when the ledger cannot be written",
      Effect.fnUntraced(function* () {
        const path = yield* Path.Path;
        const temporaryDirectory20 = yield* temporaryDirectory;
        const blocker = yield* writeText(temporaryDirectory20, "not-a-directory", "x");
        const outcome = yield* oneRun(
          Effect.gen(function* () {
            const meter = yield* meterAt(path.join(blocker, "box-api-calls.jsonl"), "run-0004");
            yield* meter.record(box(1));
            return "run finished";
          })
        );

        expect(outcome).toBe("run finished");
      })
    );
  });
});
