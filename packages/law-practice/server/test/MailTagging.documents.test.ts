/**
 * The Box document store adapter over the real `@beep/box` driver and a fake
 * SDK client. Every folder id, file name, and byte is synthetic.
 */

import { DocumentFolderId } from "@beep/law-practice-domain/values/MailTagging";
import { DocumentStoreBox, ProviderCallMeter } from "@beep/law-practice-server/MailTagging";
import { DocumentStore, MailTaggingPortError, UploadDocumentRequest } from "@beep/law-practice-use-cases/MailTagging";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import { Effect, Layer, Ref } from "effect";
import * as A from "effect/Array";
import * as N from "effect/Number";
import * as O from "effect/Option";
import { boxFiles, boxRejection, makeBoxStub, serviceOf } from "./MailTagging.adapters.fixture.ts";
import type { BoxUploadBody } from "./MailTagging.adapters.fixture.ts";

const pdf = UploadDocumentRequest.make({
  folderId: DocumentFolderId.make("9001"),
  fileName: "2026-07-01 office-action.pdf",
  contentType: O.some("application/pdf"),
  bytes: Uint8Array.of(1, 2, 3),
});
const untyped = UploadDocumentRequest.make({
  folderId: DocumentFolderId.make("9002"),
  fileName: "2026-07-01 notes",
  bytes: Uint8Array.of(4),
});

const storeOver = (calls: Ref.Ref<number>, uploadFile: (requestBody: BoxUploadBody) => Promise<unknown>) =>
  serviceOf(DocumentStore)(
    DocumentStoreBox.pipe(
      Layer.provide(
        Layer.merge(
          makeBoxStub(uploadFile),
          Layer.succeed(
            ProviderCallMeter,
            ProviderCallMeter.of({
              record: Effect.fn("FakeProviderCallMeter.record")((made) => Ref.update(calls, N.sum(made.calls))),
            })
          )
        )
      )
    )
  );

const failureOf = Effect.fn("MailTaggingDocumentsTest.failureOf")(function* (rejection: unknown) {
  const calls = yield* Ref.make(0);
  const store = yield* storeOver(calls, () => Promise.reject(rejection));
  const error = yield* Effect.flip(store.upload(pdf));
  assertInstanceOf(error, MailTaggingPortError);
  return [error.port, error.operation, error.failure, error.reason, yield* Ref.get(calls)];
});

describe("MailTagging Box document store", () => {
  it.effect(
    "creates one file with one driver call and meters it",
    Effect.fnUntraced(function* () {
      const calls = yield* Ref.make(0);
      const bodies: Array<BoxUploadBody> = [];
      const store = yield* storeOver(calls, (requestBody) => {
        bodies.push(requestBody);
        return Promise.resolve(boxFiles(`700${bodies.length}`));
      });
      const fileIds = [yield* store.upload(pdf), yield* store.upload(untyped)];

      expect(fileIds).toStrictEqual(["7001", "7002"]);
      expect(yield* Ref.get(calls)).toBe(2);
      expect(
        A.map(bodies, (body) => [
          body.attributes.name,
          body.attributes.parent.id,
          body.fileFileName,
          body.fileContentType,
        ])
      ).toStrictEqual([
        ["2026-07-01 office-action.pdf", "9001", "2026-07-01 office-action.pdf", "application/pdf"],
        ["2026-07-01 notes", "9002", "2026-07-01 notes", undefined],
      ]);
    })
  );

  it.effect(
    "reports a name conflict, a rate limit, and a quota refusal as distinct typed failures, each counted once",
    Effect.fnUntraced(function* () {
      expect(yield* failureOf(boxRejection({ statusCode: 409, code: "item_name_in_use" }))).toStrictEqual([
        "DocumentStore",
        "upload",
        "conflict",
        "response status 409",
        1,
      ]);
      expect(yield* failureOf(boxRejection({ statusCode: 429 }))).toStrictEqual([
        "DocumentStore",
        "upload",
        "throttled",
        "response status 429",
        1,
      ]);
      expect(yield* failureOf(boxRejection({ statusCode: 403, code: "storage_limit_exceeded" }))).toStrictEqual([
        "DocumentStore",
        "upload",
        "throttled",
        "response status 403",
        1,
      ]);
    })
  );

  it.effect(
    "reports any other driver failure, and an answer without a file, as unavailable",
    Effect.fnUntraced(function* () {
      const calls = yield* Ref.make(0);
      const empty = yield* storeOver(calls, () => Promise.resolve({ entries: [], totalCount: 0 }));
      const error = yield* Effect.flip(empty.upload(pdf));

      expect(yield* failureOf(boxRejection({ statusCode: 500, code: "internal_server_error" }))).toStrictEqual([
        "DocumentStore",
        "upload",
        "unavailable",
        "response status 500",
        1,
      ]);
      expect(yield* failureOf("connection reset")).toStrictEqual([
        "DocumentStore",
        "upload",
        "unavailable",
        "sdk thrown",
        1,
      ]);
      expect([error.failure, error.reason]).toStrictEqual(["unavailable", "upload answered without a file id"]);
    })
  );
});
