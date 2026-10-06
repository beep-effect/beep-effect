import { decodeBoxContentMigrationMap } from "@beep/box-provisioning";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";

const file = (folderPath: ReadonlyArray<string>, fileName: string, sourceRelativePath = "source/file.bin") => ({
  fileName,
  folderPath,
  sha256: "a".repeat(64),
  sizeBytes: 1,
  sourceRelativePath,
});

const mapInput = (files: ReadonlyArray<unknown>, folders: ReadonlyArray<ReadonlyArray<string>> = A.empty()) => ({
  expectedEnterpriseId: "enterprise-id",
  expectedSubjectId: "service-account-id",
  files,
  folders: A.map(folders, (path) => ({ path })),
  rootFolderId: "100",
  sourceRevision: "map-1",
  sourceRoot: "/srv/migration/source",
  version: "box-content-migration-map/v1",
});

describe("@beep/box-provisioning content migration map", () => {
  it.effect(
    "decodes a valid map and applies the optional rule default",
    Effect.fnUntraced(function* () {
      const map = yield* decodeBoxContentMigrationMap(
        mapInput(
          [file(["Clients", "Alpha"], "letter.pdf"), { ...file(["Clients"], "index.txt"), ruleId: "closed-matters" }],
          [["Clients", "Empty"]]
        )
      );

      expect(map.version).toBe("box-content-migration-map/v1");
      expect(A.map(map.files, (entry) => entry.ruleId._tag)).toEqual(["None", "Some"]);
    })
  );

  it.effect(
    "rejects two files that share one provider-equivalent destination",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(
        decodeBoxContentMigrationMap(
          mapInput([
            file(["Clients", "Alpha"], "Letter.PDF", "a.pdf"),
            file(["clients", "ALPHA"], "letter.pdf", "b.pdf"),
          ])
        )
      );

      expect(error).toMatchObject({
        _tag: "BoxContentMigrationMapError",
        reason: "duplicate-destination",
        violationCount: 1,
      });
    })
  );

  it.effect(
    "rejects a file whose name collides with a declared or implied sibling folder",
    Effect.fnUntraced(function* () {
      const declared = yield* Effect.flip(
        decodeBoxContentMigrationMap(mapInput([file(["Clients"], "Alpha")], [["Clients", "alpha"]]))
      );
      const implied = yield* Effect.flip(
        decodeBoxContentMigrationMap(
          mapInput([file(["Clients"], "alpha", "a.bin"), file(["Clients", "Alpha"], "letter.pdf", "b.bin")])
        )
      );

      expect(declared).toMatchObject({ _tag: "BoxContentMigrationMapError", reason: "file-folder-name-collision" });
      expect(implied).toMatchObject({ _tag: "BoxContentMigrationMapError", reason: "file-folder-name-collision" });
    })
  );

  describe("rejects names Box would refuse or silently rewrite", () => {
    it.effect.each(["", "a/b", "a\\b", ".", "..", " leading", "trailing ", "x".repeat(256), "tab\tname"])(
      "file name %j",
      Effect.fnUntraced(function* (fileName) {
        const error = yield* Effect.flip(decodeBoxContentMigrationMap(mapInput([file(["Clients"], fileName)])));

        expect(error).toMatchObject({ _tag: "BoxProvisioningSchemaError", stage: "migration-map" });
      })
    );

    it.effect.each([[], [""], ["Clients", ".."], ["Clients", "a/b"], ["trailing "]])(
      "folder path %j",
      Effect.fnUntraced(function* (folderPath) {
        const error = yield* Effect.flip(decodeBoxContentMigrationMap(mapInput([file(folderPath, "letter.pdf")])));

        expect(error).toMatchObject({ _tag: "BoxProvisioningSchemaError", stage: "migration-map" });
      })
    );
  });

  describe("rejects source paths that could leave the source root", () => {
    it.effect.each([
      "",
      "/etc/passwd",
      "../outside.txt",
      "a/../../outside.txt",
      "a/..",
      "..\\outside.txt",
      "C:\\x.txt",
    ])(
      "source path %j",
      Effect.fnUntraced(function* (sourceRelativePath) {
        const error = yield* Effect.flip(
          decodeBoxContentMigrationMap(mapInput([file(["Clients"], "letter.pdf", sourceRelativePath)]))
        );

        expect(error).toMatchObject({ _tag: "BoxProvisioningSchemaError", stage: "migration-map" });
      })
    );
  });

  it.effect(
    "rejects an unbounded rule identifier and a wrong version",
    Effect.fnUntraced(function* () {
      const badRule = yield* Effect.flip(
        decodeBoxContentMigrationMap(mapInput([{ ...file(["Clients"], "letter.pdf"), ruleId: "Closed Matters" }]))
      );
      const badVersion = yield* Effect.flip(
        decodeBoxContentMigrationMap({ ...mapInput(A.empty()), version: "box-content-migration-map/v2" })
      );

      expect(badRule._tag).toBe("BoxProvisioningSchemaError");
      expect(badVersion._tag).toBe("BoxProvisioningSchemaError");
    })
  );
});
