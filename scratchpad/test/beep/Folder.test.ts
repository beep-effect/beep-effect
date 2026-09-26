import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  BulkMoveConversationsRequest,
  BulkMoveConversationsResponse,
  CreateFolderRequest,
  CreateFolderRequestWire,
  Folder,
  FolderMutationResponse,
  FolderWire,
  MoveConversationRequest,
  MoveConversationRequestWire,
  ReorderFoldersRequest,
  ReorderFoldersRequestWire,
  UpdateFolderRequest,
  UpdateFolderRequestWire,
  rejectDuplicateFolderIds,
} from "../../beep/Folder.ts";

const decode = <A extends S.Top & S.Codec<unknown, unknown, never, unknown>>(schema: A, input: unknown): A["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const fails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

describe("Folder", () => {
  it("decodes a stored folder and constructs color and icon defaults", () => {
    const at = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z");
    const made = Folder.make({ id: "f1", name: "Work", createdAt: at, updatedAt: at });
    assert.strictEqual(made.color, "#6B7280");
    assert.strictEqual(made.icon, "folder");
    assert.strictEqual(made.order, 0);
    const decoded = decode(FolderWire, {
      id: "f1",
      name: "Work",
      description: null,
      color: "#000",
      icon: "box",
      created_at: "2020-01-02T03:04:05.000Z",
      updated_at: "2020-01-02T03:04:05.000Z",
      order: 1,
      is_default: false,
      is_system: true,
      category_mapping: null,
      conversation_count: 2,
    });
    assert.strictEqual(O.isNone(decoded.description), true);
    assert.strictEqual(O.isNone(decoded.categoryMapping), true);
    assert.strictEqual(decoded.isSystem, true);
  });

  it("treats create color null and update omission as none", () => {
    const created = decode(CreateFolderRequestWire, { name: "Work", description: null, color: null, icon: null });
    assert.strictEqual(O.isNone(created.color), true);
    assert.strictEqual(O.isNone(created.icon), true);
    const updated = decode(UpdateFolderRequestWire, {});
    assert.strictEqual(O.isNone(updated.name), true);
    assert.strictEqual(O.isNone(updated.order), true);
    const named = decode(UpdateFolderRequestWire, { name: "Work", order: null });
    assert.strictEqual(O.getOrElse(named.name, () => ""), "Work");
    assert.strictEqual(O.isNone(named.order), true);
  });

  it("covers duplicate folder ids and a null move destination", () => {
    assert.strictEqual(Effect.runSync(rejectDuplicateFolderIds(["a", "b"])).length, 2);
    assert.strictEqual(Effect.runSyncExit(rejectDuplicateFolderIds(["a", "a"]))._tag, "Failure");
    assert.strictEqual(fails(ReorderFoldersRequestWire, { folder_ids: ["a", "a"] }), true);
    assert.strictEqual(fails(ReorderFoldersRequestWire, { folder_ids: [] }), true);
    const moved = decode(MoveConversationRequestWire, { folder_id: null });
    assert.strictEqual(O.isNone(moved.folderId), true);
    const present = decode(MoveConversationRequestWire, {});
    assert.strictEqual(O.isNone(present.folderId), true);
    assert.strictEqual(BulkMoveConversationsResponse.make({ status: "ok" }).movedCount, 0);
  });

  it("derives an arbitrary for each model", () => {
    for (const schema of [
      Folder,
      CreateFolderRequest,
      UpdateFolderRequest,
      MoveConversationRequest,
      BulkMoveConversationsRequest,
      ReorderFoldersRequest,
      FolderMutationResponse,
      BulkMoveConversationsResponse,
    ]) {
      assert.strictEqual(Arbitrary.isArbitrary(schema.pipe(Arbitrary.schema)), true);
    }
  });
});

