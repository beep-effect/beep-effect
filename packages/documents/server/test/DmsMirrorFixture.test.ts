/** The deterministic DMS mirror fixture: every verb, nested trees and stream positions. */
import { RemoteItemId } from "@beep/documents-domain/values/Sync";
import {
  DmsMirrorFixtureHandle,
  DmsMirrorFixtureLayer,
  EchoClass,
  echoClassForEvent,
} from "@beep/documents-server/aggregates/Sync";
import {
  DmsMirror,
  EnsureFolderInput,
  MoveItemInput,
  PollEventsInput,
  RenameItemInput,
  UploadFileInput,
  UploadFileVersionInput,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import { describe, expect, it, layer } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";

const bytes = (text: string) => new TextEncoder().encode(text);

describe("DmsMirrorFixture", () => {
  layer(DmsMirrorFixtureLayer, { timeout: "30 seconds" })("verbs", (it) => {
    it.effect("folds nested folders, versions, moves and renames into the tree and the event stream", () =>
      Effect.gen(function* () {
        const mirror = yield* DmsMirror;
        const fixture = yield* DmsMirrorFixtureHandle;
        const start = yield* mirror.pollEvents(PollEventsInput.make({ streamPosition: O.none() }));
        expect(start.entries).toEqual([]);

        const outer = yield* mirror.ensureFolder(EnsureFolderInput.make({ name: "outer", parentRemoteId: O.none() }));
        const inner = yield* mirror.ensureFolder(
          EnsureFolderInput.make({ name: "inner", parentRemoteId: O.some(outer.remoteId) })
        );
        const again = yield* mirror.ensureFolder(
          EnsureFolderInput.make({ name: "inner", parentRemoteId: O.some(outer.remoteId) })
        );
        expect(again.remoteId).toBe(inner.remoteId);
        const file = yield* mirror.uploadFile(
          UploadFileInput.make({ name: "a.txt", parentRemoteId: O.some(inner.remoteId), content: bytes("one") })
        );
        const versioned = yield* mirror.uploadFileVersion(
          UploadFileVersionInput.make({ name: "a.txt", remoteId: file.remoteId, content: bytes("two") })
        );
        expect(versioned.remoteId).toBe(file.remoteId);
        yield* mirror.moveItem(
          MoveItemInput.make({ itemKind: "file", newParentRemoteId: O.some(outer.remoteId), remoteId: file.remoteId })
        );
        const renamed = yield* mirror.renameItem(
          RenameItemInput.make({ itemKind: "file", newName: "b.txt", remoteId: file.remoteId })
        );
        expect(renamed.name).toBe("b.txt");

        const tree = yield* fixture.snapshotTree;
        expect(A.sort(R.keys(tree), Str.Order)).toEqual(["outer", "outer/b.txt", "outer/inner"]);
        const page = yield* mirror.pollEvents(
          PollEventsInput.make({ streamPosition: O.some(start.nextStreamPosition) })
        );
        expect(A.map(page.entries, (entry) => entry.eventType)).toEqual([
          "created",
          "created",
          "created",
          "edited",
          "moved",
          "renamed",
        ]);
        const requested = yield* fixture.requestedStreamPositions;
        expect(requested).toHaveLength(2);
        const counts = yield* fixture.counts;
        expect(counts).toMatchObject({
          ensureFolder: 3,
          uploadFile: 1,
          uploadFileVersion: 1,
          moveItem: 1,
          renameItem: 1,
        });
      })
    );

    it.effect("refuses unknown items, unknown parents and non-numeric stream positions", () =>
      Effect.gen(function* () {
        const mirror = yield* DmsMirror;
        const missing = RemoteItemId.make("fx-missing");
        const version = yield* Effect.flip(
          mirror.uploadFileVersion(UploadFileVersionInput.make({ name: "x", remoteId: missing, content: bytes("x") }))
        );
        expect(version._tag).toBe("DmsMirrorUnavailable");
        const move = yield* Effect.flip(
          mirror.moveItem(
            MoveItemInput.make({ itemKind: "file", newParentRemoteId: O.some(missing), remoteId: missing })
          )
        );
        expect(move._tag).toBe("DmsMirrorUnavailable");
        const rename = yield* Effect.flip(
          mirror.renameItem(RenameItemInput.make({ itemKind: "file", newName: "y", remoteId: missing }))
        );
        expect(rename._tag).toBe("DmsMirrorUnavailable");
        const poll = yield* Effect.flip(mirror.pollEvents(PollEventsInput.make({ streamPosition: O.some("later") })));
        expect(poll._tag).toBe("DmsMirrorUnavailable");
      })
    );
  });

  it("classifies every remote event type as an echo class or none", () => {
    assertSome(echoClassForEvent("created"), EchoClass.Enum.content);
    assertSome(echoClassForEvent("edited"), EchoClass.Enum.content);
    assertSome(echoClassForEvent("moved"), EchoClass.Enum.moved);
    assertSome(echoClassForEvent("renamed"), EchoClass.Enum.renamed);
    assertNone(echoClassForEvent("deleted"));
    assertNone(echoClassForEvent("unknown"));
  });
});
