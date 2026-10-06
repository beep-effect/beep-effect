/**
 * Shared scaffolding of the mail-tagging adapter tests: the platform layer,
 * the one place an `M365` or `Box` stub is built, a scoped temporary
 * directory, and the helper that builds a layer and hands back its service.
 * Every mailbox, matter, address, and byte in these tests is synthetic.
 */

import { Box } from "@beep/box";
import { GraphMailFolder, M365, M365Error } from "@beep/m365";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { Context, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as Str from "effect/String";
import type { M365Shape } from "@beep/m365";
import type { Scope } from "effect";

/** Real filesystem, path, and digest services for a scoped temporary directory. */
export const Platform = Layer.mergeAll(BunFileSystem.layer, BunPath.layer, BunCrypto.layer);

/** Answers the two well-known folders the mailbox adapter resolves when it is built. */
export const wellKnownFolders: M365Shape["getMailFolder"] = (request) =>
  Effect.succeed(GraphMailFolder.make({ id: `folder-${request.folder}` }));

/** The mailbox every adapter test addresses. */
export const mailboxUserId = "attorney@example.test";

const unused = () => Effect.fail(M365Error.fromReason("transport", { resource: "unused-by-mail-tagging" }));

/**
 * The only constructor of an `M365` stub. Every verb fails unless a test
 * overrides it, so a verb the driver gains is one line here.
 */
export const makeM365Stub = (overrides: Partial<M365Shape>): Layer.Layer<M365> =>
  Layer.succeed(
    M365,
    M365.of({
      createEvent: unused,
      createMasterCategory: unused,
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
      getSite: unused,
      listDriveItemVersions: unused,
      listDrives: unused,
      listEvents: unused,
      listMasterCategories: unused,
      listMessageAttachments: unused,
      listMessages: unused,
      listSites: unused,
      updateEvent: unused,
      updateMessageCategories: unused,
      ...overrides,
    })
  );

/** What the Box SDK's `uploads.uploadFile` receives from the driver. */
export type BoxUploadBody = {
  readonly attributes: { readonly name: string; readonly parent: { readonly id: string } };
  readonly fileContentType?: string;
  readonly fileFileName?: string;
};

/**
 * The only constructor of a `Box` stub: the real driver over a fake SDK client
 * that has just the upload manager the adapter calls.
 */
export const makeBoxStub = (uploadFile: (requestBody: BoxUploadBody) => Promise<unknown>): Layer.Layer<Box> =>
  Box.makeLayerFromClient({ uploads: { uploadFile } });

/** A Box SDK rejection carrying an HTTP status and, optionally, an API error code. */
export const boxRejection = (responseInfo: {
  readonly statusCode: number;
  readonly code?: string;
  readonly contextInfo?: { readonly conflicts: unknown };
}) => ({
  responseInfo,
});

/** The SDK's answer for one created file. */
export const boxFiles = (id: string) => ({ entries: [{ id, type: "file" }], totalCount: 1 });

/** Builds a layer in the current scope and answers the service it provides. */
export const serviceOf =
  <I, S>(tag: Context.Key<I, S>) =>
  <E, R>(layer: Layer.Layer<I, E, R>) =>
    Effect.map(Layer.build(layer), Context.get(tag));

/**
 * One run of the service: the scope an entry point builds the layers in and
 * closes when the run ends. A test that needs two runs opens two of these, so
 * a layer that reads a file at build time is built again for the second.
 */
export const oneRun = <A, E, R>(run: Effect.Effect<A, E, R>): Effect.Effect<A, E, Exclude<R, Scope.Scope>> =>
  Effect.scoped(run);

/** A fresh temporary directory that is removed when the test's scope closes. */
export const temporaryDirectory = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.makeTempDirectoryScoped({ prefix: "mail-tagging-adapters-" });
});

/** Writes one text file under a directory and answers its full path. */
export const writeText = Effect.fn("MailTaggingAdaptersFixture.writeText")(function* (
  directory: string,
  name: string,
  text: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(directory, name);
  yield* fs.writeFileString(target, text);
  return target;
});

/** The non-empty lines of a file; none when it does not exist. */
export const linesOf = Effect.fn("MailTaggingAdaptersFixture.linesOf")(function* (target: string) {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(target);
  return exists ? A.filter(Str.split(yield* fs.readFileString(target), "\n"), Str.isNonEmpty) : [];
});
