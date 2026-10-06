/**
 * The process wiring over stub drivers and an in-memory filesystem: settings
 * are read once, the real service is assembled per pass, and a missing
 * private file fails the pass. No test here reaches a provider.
 */

import { Box } from "@beep/box";
import { DuckDb } from "@beep/duckdb";
import { TaggingRunId } from "@beep/law-practice-domain/values/MailTagging";
import { RunMailTaggingRequest, TagLedger } from "@beep/law-practice-use-cases/MailTagging";
import { GraphMailFolder, M365, M365Error, M365MessageCollection } from "@beep/m365";
import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import { Config, Context, Effect, FileSystem, Layer } from "effect";
import * as Duration from "effect/Duration";
import { practiceMailTaggingConfig } from "@/PracticeMailTagging.config";
import { PracticeMailTaggingError } from "@/PracticeMailTagging.errors";
import { MailTaggingPasses } from "@/PracticeMailTagging.passes";
import {
  liveMailTaggingDrivers,
  MailTaggingPassesLive,
  MailTaggingStateLive,
  makeMailTaggingPassesLayer,
} from "@/runtime/Layer";
import {
  configOf,
  credentialEnvironment,
  Platform,
  settingsEnvironment,
  since,
} from "./PracticeMailTagging.fixture.ts";
import type { DuckDbClient } from "@beep/duckdb";
import type { M365Shape } from "@beep/m365";
import type { PracticeMailTaggingConfig } from "@/PracticeMailTagging.config";

const unused = () => Effect.fail(M365Error.fromReason("transport", { resource: "unused-by-this-test" }));

const makeM365Stub = (overrides: Partial<M365Shape>): Layer.Layer<M365> =>
  Layer.succeed(
    M365,
    M365.of({
      addMessageAttachment: unused,
      createDraftMessage: unused,
      createEvent: unused,
      createMasterCategory: unused,
      deleteDraftMessage: unused,
      deleteEvent: unused,
      deltaDriveItems: unused,
      downloadDriveItemContent: unused,
      downloadMessageAttachment: unused,
      ensureMasterCategories: unused,
      findEventsByIdempotencyKey: unused,
      getEvent: unused,
      getListItem: unused,
      getMailFolder: unused,
      getMessage: unused,
      getMessageAuthoredText: unused,
      getSite: unused,
      listDriveItemVersions: unused,
      listDrives: unused,
      listEvents: unused,
      listMasterCategories: unused,
      listMessageAttachments: unused,
      listMessages: unused,
      listSites: unused,
      sendDraftMessage: unused,
      updateEvent: unused,
      updateMessageCategories: unused,
      ...overrides,
    })
  );

// An empty mailbox, a Box client nothing calls, and a bundle with no matters.
const emptyMailbox: Partial<M365Shape> = {
  getMailFolder: (request) => Effect.succeed(GraphMailFolder.make({ id: `folder-${request.folder}` })),
  listMessages: () => Effect.succeed(M365MessageCollection.make({ value: [] })),
};

const emptyBundle: DuckDbClient = {
  copyTableToParquet: () => Effect.void,
  query: () => Effect.succeed([]),
  run: () => Effect.void,
  runMany: () => Effect.void,
  withTransaction: (use) => use(emptyBundle),
};

const stubDrivers = (mailbox: Partial<M365Shape>) => () =>
  Effect.succeed(Layer.mergeAll(makeM365Stub(mailbox), Box.makeLayerFromClient({}), DuckDb.makeLayer(emptyBundle)));

const settings = configOf({ ...settingsEnvironment, ...credentialEnvironment });

const overStubs = (mailbox: Partial<M365Shape>) =>
  makeMailTaggingPassesLayer(stubDrivers(mailbox)).pipe(Layer.provideMerge(Platform), Layer.provide(settings));

const seedPrivateFiles = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory("/private", { recursive: true });
  yield* fs.writeFileString(settingsEnvironment.PRACTICE_MAIL_TAGGING_FOLDER_MAP_PATH, "[]");
  yield* fs.writeFileString(settingsEnvironment.PRACTICE_MAIL_TAGGING_KNOWN_DOCUMENTS_PATH, "");
});

const dryRunRequest = RunMailTaggingRequest.make({ mode: "dry-run", since, runId: TaggingRunId.make("tag-0001") });

const dryRun = Effect.flatMap(MailTaggingPasses, (passes) => passes.runJob(dryRunRequest));

describe("makeMailTaggingPassesLayer", () => {
  it.layer(overStubs(emptyMailbox), { timeout: "30 seconds" })((it) => {
    it.effect("assembles the real service over the drivers and reports an empty mailbox", () =>
      Effect.gen(function* () {
        yield* seedPrivateFiles;
        const passes = yield* MailTaggingPasses;
        const report = yield* dryRun;
        const fs = yield* FileSystem.FileSystem;

        expect(Duration.toMinutes(passes.schedule.pollInterval)).toBe(5);
        expect(report.scanned).toBe(0);
        expect(report.wrote).toBe(false);
        expect(yield* fs.exists(settingsEnvironment.PRACTICE_MAIL_TAGGING_BOX_CALL_LEDGER_PATH)).toBe(false);
      })
    );
  });

  it.layer(overStubs(emptyMailbox), { timeout: "30 seconds" })((it) => {
    it.effect("fails the pass before any listing when the folder-id map is missing", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(dryRun);

        expect(error.kind).toBe("failed");
        expect(error.source).toBe("MailTaggingStateError");
      })
    );
  });

  it.layer(overStubs({ getMailFolder: () => Effect.fail(M365Error.fromReason("throttled")) }), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("reports a throttled mailbox as a throttled pass", () =>
      Effect.gen(function* () {
        yield* seedPrivateFiles;
        const error = yield* Effect.flip(dryRun);

        expect(error.kind).toBe("throttled");
      })
    );
  });

  it.layer(Platform, { timeout: "30 seconds" })((it) => {
    it.effect("fails to build when a required setting is missing", () =>
      Effect.gen(function* () {
        const error = yield* MailTaggingPassesLive.pipe(
          Layer.provide(configOf(credentialEnvironment)),
          Layer.build,
          Effect.flip
        );

        assertInstanceOf(error, PracticeMailTaggingError);
        expect(error.source).toBe("ConfigError");
      })
    );
  });
});

describe("liveMailTaggingDrivers", () => {
  const liveDrivers = (values: Readonly<Record<string, string>>) =>
    Effect.gen(function* () {
      const config: PracticeMailTaggingConfig = yield* practiceMailTaggingConfig;
      return yield* liveMailTaggingDrivers(config);
    }).pipe(provideScopedLayer(configOf(values)));

  it.layer(Platform, { timeout: "30 seconds" })((it) => {
    it.effect("builds the three drivers from the shared credentials without calling a provider", () =>
      Effect.gen(function* () {
        const withToken = yield* Layer.build(yield* liveDrivers({ ...settingsEnvironment, ...credentialEnvironment }));
        const withGrant = yield* Layer.build(
          yield* liveDrivers({
            ...settingsEnvironment,
            ...credentialEnvironment,
            DMS_BOX_CLIENT_ID: "box-client-0001",
            DMS_BOX_CLIENT_SECRET: "placeholder-secret",
            DMS_BOX_ENTERPRISE_ID: "enterprise-0001",
          })
        );

        expect(Context.getOption(withToken, M365)._tag).toBe("Some");
        expect(Context.getOption(withToken, Box)._tag).toBe("Some");
        expect(Context.getOption(withToken, DuckDb)._tag).toBe("Some");
        expect(Context.getOption(withGrant, Box)._tag).toBe("Some");
      })
    );
  });

  it.effect("fails when a credential is missing", () =>
    Effect.gen(function* () {
      assertInstanceOf(yield* Effect.flip(liveDrivers(settingsEnvironment)), Config.ConfigError);
    })
  );
});

describe("MailTaggingStateLive", () => {
  it.layer(Layer.provideMerge(MailTaggingStateLive.pipe(Layer.provide(configOf(settingsEnvironment))), Platform), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("reads the ledgers of the configured state directory", () =>
      Effect.gen(function* () {
        const records = yield* Effect.flatMap(TagLedger, (ledger) => ledger.records);

        expect(records).toEqual([]);
      })
    );
  });

  it.layer(Platform, { timeout: "30 seconds" })((it) => {
    it.effect("fails when neither a state directory nor HOME is set", () =>
      Effect.gen(function* () {
        const error = yield* MailTaggingStateLive.pipe(Layer.provide(configOf({})), Layer.build, Effect.flip);

        assertInstanceOf(error, PracticeMailTaggingError);
      })
    );
  });
});
