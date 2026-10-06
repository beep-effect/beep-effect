import * as B from "@beep/box";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertNone, assertSome } from "@effect/vitest/utils";
import { pipe, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const encodeBoxError = S.encodeResult(S.fromJsonString(B.BoxError));
const encodeBoxApiFailureConflict = S.encodeResult(B.BoxApiFailureConflict);
const decodeBoxApiFailureConflictOption = S.decodeUnknownOption(B.BoxApiFailureConflict);

const emptySha1 = "da39a3ee5e6b4b0d3255bfef95601890afd80709";
const itemName = "Engagement Letter - Jane Doe.pdf";
const etag = "etag-sentinel-7";
const sequenceId = "sequence-sentinel-3";
const ownerLogin = "owner-sentinel@example.invalid";

type ConflictBody = {
  readonly code: string;
  readonly context_info: { readonly conflicts: unknown };
  readonly help_url: string;
  readonly message: string;
  readonly request_id: string;
  readonly status: number;
  readonly type: string;
};

const conflictBody = (conflicts: unknown): ConflictBody => ({
  code: "item_name_in_use",
  context_info: { conflicts },
  help_url: "http://developers.box.com/docs/#errors",
  message: "Item with the same name already exists",
  request_id: "abcdef123456",
  status: 409,
  type: "error",
});

/** Folder create (`POST /folders`): `context_info.conflicts` is an array of folder objects. */
const folderCreateConflictBody = conflictBody([
  {
    etag,
    id: "11446498",
    name: itemName,
    sequence_id: sequenceId,
    type: "folder",
  },
]);

/** File upload (`POST /files/content`): `context_info.conflicts` is one file object, not an array. */
const fileUploadConflictBody = conflictBody({
  etag,
  file_version: { id: "5550001", sha1: emptySha1, type: "file_version" },
  id: "987654321",
  name: itemName,
  owned_by: { login: ownerLogin },
  sequence_id: sequenceId,
  sha1: emptySha1,
  size: 629644,
  type: "file",
});

/**
 * Mirrors what `box-node-sdk` throws for a non-2xx response: `responseInfo.contextInfo` is the raw
 * `context_info` map from the body, never deserialized, so its keys keep their wire spelling.
 */
const sdkFailure = (body: ConflictBody) => ({
  message: `${body.status} ${body.message}`,
  name: "BoxApiError",
  responseInfo: {
    body,
    code: body.code,
    contextInfo: body.context_info,
    helpUrl: body.help_url,
    rawBody: "",
    requestId: body.request_id,
    statusCode: body.status,
  },
});

const conflictsOf = (error: B.BoxError): ReadonlyArray<B.BoxApiFailureConflict> =>
  pipe(
    error.context,
    O.map((context) => context.values.conflicts),
    O.getOrElse(A.empty<B.BoxApiFailureConflict>)
  );

const conflictCountOf = (error: B.BoxError): O.Option<number> =>
  O.map(error.context, (context) => context.values.conflictCount);

describe("@beep/box conflict detail", () => {
  it("keeps the id and type of a folder-create conflict array, with no hash or size", () => {
    const error = B.BoxError.fromUnknown("folders.createFolder", sdkFailure(folderCreateConflictBody));

    assertSome(error.status, 409);
    assertSome(error.code, "item_name_in_use");
    assertSome(conflictCountOf(error), 1);
    expect(conflictsOf(error)).toEqual([B.BoxApiFailureConflict.make({ id: "11446498", type: "folder" })]);
    expect(A.map(conflictsOf(error), (conflict) => [conflict.sha1._tag, conflict.size._tag])).toEqual([
      ["None", "None"],
    ]);
  });

  it("normalizes a single-object file-upload conflict to an array carrying sha1 and size", () => {
    const error = B.BoxError.fromUnknown("uploads.uploadFile", sdkFailure(fileUploadConflictBody));

    assertSome(conflictCountOf(error), 1);
    expect(conflictsOf(error)).toEqual([
      B.BoxApiFailureConflict.make({
        id: "987654321",
        sha1: O.some(emptySha1),
        size: O.some(629644),
        type: "file",
      }),
    ]);
  });

  it("keeps a file conflict whose hash or size is absent or unusable, dropping only that field", () => {
    const error = B.BoxError.fromUnknown(
      "uploads.uploadFile",
      sdkFailure(
        conflictBody([
          { id: "1", type: "file" },
          { id: "2", sha1: emptySha1, type: "file" },
          { id: "3", size: 12, type: "file" },
          { id: "4", sha1: "DA39A3EE5E6B4B0D3255BFEF95601890AFD80709", size: -1, type: "file" },
          { id: "5", sha1: 40, size: "12", type: "file" },
          { id: "6", sha1: itemName, size: 1.5, type: "web_link" },
        ])
      )
    );

    assertSome(conflictCountOf(error), 6);
    expect(
      A.map(conflictsOf(error), (conflict) => [conflict.id, O.getOrNull(conflict.sha1), O.getOrNull(conflict.size)])
    ).toEqual([
      ["1", null, null],
      ["2", emptySha1, null],
      ["3", null, 12],
      ["4", null, null],
      ["5", null, null],
      ["6", null, null],
    ]);
  });

  describe("degrades a malformed conflicts value without throwing", () => {
    it.each([
      { conflicts: "conflict", label: "a string" },
      { conflicts: null, label: "null" },
      { conflicts: 409, label: "a number" },
      { conflicts: true, label: "a boolean" },
    ])("$label yields no context", ({ conflicts }) => {
      const error = B.BoxError.fromUnknown("uploads.uploadFile", sdkFailure(conflictBody(conflicts)));

      assertNone(error.context);
      assertSome(error.status, 409);
    });

    it("counts junk array entries but exposes only the usable ones", () => {
      const error = B.BoxError.fromUnknown(
        "folders.createFolder",
        sdkFailure(
          conflictBody([
            "junk",
            null,
            7,
            [],
            {},
            { id: "not-numeric", type: "folder" },
            { id: "12", type: "collaboration" },
            { id: 12, type: "folder" },
            { id: "13", type: "folder" },
          ])
        )
      );

      assertSome(conflictCountOf(error), 9);
      expect(conflictsOf(error)).toEqual([B.BoxApiFailureConflict.make({ id: "13", type: "folder" })]);
    });

    it("treats an empty object as one unusable entry and an empty array as none", () => {
      const single = B.BoxError.fromUnknown("uploads.uploadFile", sdkFailure(conflictBody({})));
      const empty = B.BoxError.fromUnknown("uploads.uploadFile", sdkFailure(conflictBody([])));

      assertSome(conflictCountOf(single), 1);
      expect(conflictsOf(single)).toEqual([]);
      assertSome(conflictCountOf(empty), 0);
      expect(conflictsOf(empty)).toEqual([]);
    });

    it("survives a conflict whose property access throws", () => {
      const hostile = Object.defineProperty({ type: "file" }, "id", {
        enumerable: true,
        get: () => {
          throw new TypeError("hostile getter");
        },
      });

      const error = B.BoxError.fromUnknown("uploads.uploadFile", sdkFailure(conflictBody(hostile)));

      assertSome(conflictCountOf(error), 1);
      expect(conflictsOf(error)).toEqual([]);
    });
  });

  it("never carries the name or any unlisted conflict field into the encoded error", () => {
    const sentinels = [itemName, etag, sequenceId, ownerLogin, "file_version", "5550001", "owned_by", "already exists"];
    const rendered = A.flatMap([folderCreateConflictBody, fileUploadConflictBody], (body) => {
      const error = B.BoxError.fromUnknown("uploads.uploadFile", sdkFailure(body));
      return [
        Result.getOrThrow(encodeBoxError(error)),
        JSON.stringify(error),
        JSON.stringify(B.BoxError.toDiagnostic(error)),
        String(error),
        error.message,
      ];
    });

    pipe(
      A.some(rendered, (text) => A.some(sentinels, (sentinel) => pipe(text, Str.includes(sentinel)))),
      assertFalse
    );
    // The approved fields are what the encoded upload conflict does carry.
    expect(A.filter(rendered, Str.includes(`"sha1":"${emptySha1}","size":629644`)).length).toBeGreaterThan(0);
  });

  it.prop(
    "round-trips any conflict and sheds an injected name on the way back out",
    { conflict: Arbitrary.schema(B.BoxApiFailureConflict) },
    ({ conflict }) => {
      const encoded = Result.getOrThrow(encodeBoxApiFailureConflict(conflict));
      const redecoded = decodeBoxApiFailureConflictOption({ ...encoded, etag, name: itemName });

      assertSome(decodeBoxApiFailureConflictOption(encoded), conflict);
      assertSome(
        O.map(redecoded, (value) => Result.getOrThrow(encodeBoxApiFailureConflict(value))),
        encoded
      );
    },
    { arbitrary: fcRuns(25) }
  );

  it("encodes a conflict to exactly its approved keys and rejects an unsafe hash", () => {
    const withDetail = B.BoxApiFailureConflict.make({
      id: "987654321",
      sha1: O.some(emptySha1),
      size: O.some(0),
      type: "file",
    });

    expect(Result.getOrThrow(encodeBoxApiFailureConflict(withDetail))).toEqual({
      id: "987654321",
      sha1: emptySha1,
      size: 0,
      type: "file",
    });
    expect(
      Result.getOrThrow(encodeBoxApiFailureConflict(B.BoxApiFailureConflict.make({ id: "1", type: "folder" })))
    ).toEqual({ id: "1", type: "folder" });
    assertNone(decodeBoxApiFailureConflictOption({ id: "1", sha1: itemName, type: "file" }));
    assertNone(decodeBoxApiFailureConflictOption({ id: "1", size: -1, type: "file" }));
  });
});
