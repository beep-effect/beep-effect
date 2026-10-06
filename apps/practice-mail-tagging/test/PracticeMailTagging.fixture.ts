/**
 * Shared scaffolding of the mail-tagging app tests: an in-memory platform, a
 * one-message mailbox, and the real job and undo over the real file ledgers.
 * Every mailbox, matter, address, and credential here is synthetic.
 */

import { $PracticeMailTaggingId } from "@beep/identity/packages";
import {
  emptyTaggingRunReport,
  MailEnvelope,
  MailMessageId,
  MatterIndex,
} from "@beep/law-practice-domain/values/MailTagging";
import {
  MailTaggingJobLive,
  MailTaggingStateConfig,
  MailTaggingStateFile,
  MailTaggingStateLocation,
  MailTaggingUndoLive,
} from "@beep/law-practice-server/MailTagging";
import {
  AttachmentFiler,
  AttachmentFilerShape,
  Mailbox,
  MailboxShape,
  MailPage,
  MailTaggingPortError,
  MatterDirectory,
  MatterDirectoryShape,
} from "@beep/law-practice-use-cases/MailTagging";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { ConfigProvider, Context, Effect, Layer, Path, Ref, Stdio, Terminal } from "effect";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import { Command } from "effect/cli";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { makePracticeMailTaggingCommand } from "@/PracticeMailTagging.command";
import { MailTaggingPasses, MailTaggingPassSchedule, makeMailTaggingPasses } from "@/PracticeMailTagging.passes";
import type { FileSystem } from "effect";
import type { MailTaggingPassLayer } from "@/PracticeMailTagging.passes";

const $I = $PracticeMailTaggingId.create("test/PracticeMailTagging.fixture");

/** State directory every test reads and writes, inside the in-memory filesystem. */
export const stateDirectory = "/state/practice-mail-tagging";

/** Category the message carries before any run; never ours to remove. */
export const foreignCategory = "Personal";

/** Category a matched run adds to the one message. */
export const matterCategory = "M: acme.10001";

/** Start of the backfill in every test. */
export const since = DateTime.makeUnsafe("2026-07-01T00:00:00Z");

/** Pause between two watch passes in every test. */
export const pollInterval = Duration.minutes(5);

/** App settings as an environment would carry them; every path is in-memory. */
export const settingsEnvironment = {
  PRACTICE_MAIL_TAGGING_STATE_DIRECTORY: stateDirectory,
  PRACTICE_MAIL_TAGGING_MAILBOX_USER_ID: "attorney@example.test",
  PRACTICE_MAIL_TAGGING_KG_BUNDLE_DIRECTORY: "/bundle",
  PRACTICE_MAIL_TAGGING_FOLDER_MAP_PATH: "/private/matter-folders.json",
  PRACTICE_MAIL_TAGGING_KNOWN_DOCUMENTS_PATH: "/private/box-files.jsonl",
  PRACTICE_MAIL_TAGGING_BOX_CALL_LEDGER_PATH: "/private/box-api-calls.jsonl",
};

/** Placeholder provider credentials; none of them opens a connection. */
export const credentialEnvironment = {
  CLOUD_M365_DOCKET_TENANT_ID: "tenant-0001",
  CLOUD_M365_DOCKET_CLIENT_ID: "client-0001",
  CLOUD_M365_DOCKET_CERT_THUMBPRINT_SHA256: "AB12",
  CLOUD_M365_DOCKET_CERT_PRIVATE_KEY: "line-one\\nline-two",
  CLOUD_BOX_TOKEN: "placeholder-token",
};

/** A config provider layer over plain values. */
export const configOf = (values: Readonly<Record<string, string>>) =>
  ConfigProvider.layer(ConfigProvider.fromUnknown(values));

const testCrypto = Layer.succeed(
  Crypto.Crypto,
  Crypto.make({
    digest: (algorithm, data) =>
      Effect.promise(() => globalThis.crypto.subtle.digest(algorithm, Uint8Array.from(data))).pipe(
        Effect.map((buffer) => new Uint8Array(buffer))
      ),
    randomBytes: (size) => globalThis.crypto.getRandomValues(new Uint8Array(size)),
  })
);

/** Everything the command line needs from a platform, with no real file, terminal, or process. */
export const Platform = Layer.mergeAll(
  MemoryFileSystem.layer,
  Path.layer,
  testCrypto,
  TestConsole.layer,
  Stdio.layerTest({}),
  Layer.succeed(
    Terminal.Terminal,
    Terminal.make({
      columns: Effect.succeed(80),
      rows: Effect.succeed(24),
      readInput: Effect.die("unused"),
      readLine: Effect.die("unused"),
      display: () => Effect.void,
    })
  ),
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.die("unused"))
  )
);

/** What the fake mailbox holds and what the tests count. */
type Outlook = {
  readonly categories: ReadonlyArray<string>;
  readonly listCalls: number;
  readonly categoryWrites: number;
  readonly serviceBuilds: number;
  readonly listFailures: ReadonlyArray<MailTaggingPortError>;
};

type ScenarioShape = {
  readonly outlook: Ref.Ref<Outlook>;
  readonly passLayer: MailTaggingPassLayer;
};

/** One mailbox with one message, and the pass layer that reads and writes it. */
class Scenario extends Context.Service<Scenario, ScenarioShape>()($I`Scenario`) {}

const decodeIndex = S.decodeUnknownEffect(MatterIndex);

const matterIndex = decodeIndex({
  entries: [{ matterKey: "acme.10001", clientKey: "acme", applicationNumbers: ["16123456"] }],
  builtAt: "2026-07-01T00:00:00.000Z",
});

const envelopeOf = (outlook: Outlook): MailEnvelope =>
  MailEnvelope.make({
    messageId: MailMessageId.make("msg-1"),
    subject: "Office action for 16/123,456",
    receivedAt: DateTime.add(since, { minutes: 1 }),
    categories: outlook.categories,
    hasAttachments: false,
    changeKey: O.some(`ck-${outlook.categoryWrites}`),
  });

const unusedAttachmentCall = () => Effect.fail(MailTaggingPortError.during("Mailbox", "attachments", "unused"));

const makeMailbox = (outlook: Ref.Ref<Outlook>) =>
  MailboxShape.make({
    listMessagesSince: () =>
      Ref.modify(outlook, (current) => [
        A.head(current.listFailures),
        { ...current, listCalls: current.listCalls + 1, listFailures: A.drop(current.listFailures, 1) },
      ]).pipe(
        Effect.flatMap(
          O.match({
            onNone: () =>
              Effect.map(Ref.get(outlook), (current) => MailPage.make({ envelopes: [envelopeOf(current)] })),
            onSome: (failure) => Effect.fail(failure),
          })
        )
      ),
    getEnvelope: () => Effect.map(Ref.get(outlook), (current) => O.some(envelopeOf(current))),
    setCategories: (request) =>
      Ref.update(outlook, (current) => ({
        ...current,
        categories: request.categories,
        categoryWrites: current.categoryWrites + 1,
      })),
    ensureMasterCategories: () => Effect.succeed(0),
    listAttachments: unusedAttachmentCall,
    downloadAttachment: unusedAttachmentCall,
  });

const stateLocation = Layer.succeed(MailTaggingStateLocation, MailTaggingStateConfig.make({ stateDirectory }));

const makeScenario = Effect.gen(function* () {
  const outlook = yield* Ref.make<Outlook>({
    categories: [foreignCategory],
    listCalls: 0,
    categoryWrites: 0,
    serviceBuilds: 0,
    listFailures: [],
  });
  const index = yield* Effect.orDie(matterIndex);
  const platform = Layer.succeedContext(yield* Effect.context<FileSystem.FileSystem | Path.Path>());
  const ports = Layer.mergeAll(
    Layer.succeed(Mailbox, makeMailbox(outlook)),
    Layer.succeed(MatterDirectory, MatterDirectoryShape.make({ snapshot: Effect.succeed(index) })),
    Layer.succeed(
      AttachmentFiler,
      AttachmentFilerShape.make({
        file: (request) => Effect.succeed(emptyTaggingRunReport(request.mode, request.runId)),
      })
    ),
    MailTaggingStateFile.pipe(Layer.provide(stateLocation), Layer.provide(platform))
  );
  const countBuild = Layer.effectDiscard(
    Ref.update(outlook, (current) => ({ ...current, serviceBuilds: current.serviceBuilds + 1 }))
  );
  return {
    outlook,
    passLayer: Layer.mergeAll(MailTaggingJobLive, MailTaggingUndoLive, countBuild).pipe(Layer.provide(ports)),
  };
});

const PassesOverScenario = Layer.effect(
  MailTaggingPasses,
  Effect.map(Scenario, (scenario) =>
    makeMailTaggingPasses(
      MailTaggingPassSchedule.make({ since, pollInterval, maxBackoff: Duration.hours(1) }),
      () => scenario.passLayer
    )
  )
);

/**
 * The platform plus a fresh scenario. Each test gets its own `it.layer` block, so
 * no two tests share a mailbox, a ledger, or the test clock.
 */
export const World = Layer.provideMerge(Layer.effect(Scenario, makeScenario), Platform);

/** Runs the real command line over the scenario's mailbox and the in-memory state directory. */
export const run = Command.runWith(
  makePracticeMailTaggingCommand({
    passes: PassesOverScenario,
    state: MailTaggingStateFile.pipe(Layer.provide(stateLocation)),
  }),
  { version: "0.0.0" }
);

/** Current state of the scenario's mailbox and counters. */
export const outlookNow = Effect.flatMap(Scenario, (scenario) => Ref.get(scenario.outlook));

/** Makes the next mailbox listings fail, one failure per call, in order. */
export const failNextListings = (failures: ReadonlyArray<MailTaggingPortError>) =>
  Effect.flatMap(Scenario, (scenario) =>
    Ref.update(scenario.outlook, (current) => ({ ...current, listFailures: failures }))
  );

/** Every line written to standard output so far. */
export const outputLines = TestConsole.logLines.pipe(
  Effect.map(A.filter(P.isString)),
  Effect.map(A.flatMap(Str.split("\n")))
);
