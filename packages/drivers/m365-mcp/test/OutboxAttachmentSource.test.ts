import { OutboxAttachmentPolicy, OutboxAttachmentSource } from "@beep/m365-mcp";
import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { assert, describe } from "@effect/vitest";
import { Context, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, NodeCrypto.layer);

// SHA-256 of the three ASCII bytes "abc" (FIPS 180-2 test vector).
const ABC_SHA256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const encoder = new TextEncoder();

// root/abc.txt (3 bytes), root/big.bin (64 bytes), root/empty.txt, root/folder/,
// root/escape -> outside/secret.txt, root/alias -> root/abc.txt, root-evil/sibling.txt.
const stage = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const base = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "outbox-attachments-" }));
  const root = path.join(base, "root");
  const outside = path.join(base, "outside");
  const sibling = path.join(base, "root-evil");
  yield* Effect.forEach([root, outside, sibling, path.join(root, "folder")], (directory) =>
    fs.makeDirectory(directory, { recursive: true })
  );
  yield* fs.writeFile(path.join(root, "abc.txt"), encoder.encode("abc"));
  yield* fs.writeFile(path.join(root, "big.bin"), new Uint8Array(64).fill(7));
  yield* fs.writeFile(path.join(root, "empty.txt"), new Uint8Array(0));
  yield* fs.writeFile(path.join(outside, "secret.txt"), encoder.encode("synthetic"));
  yield* fs.writeFile(path.join(sibling, "sibling.txt"), encoder.encode("synthetic"));
  yield* fs.symlink(path.join(outside, "secret.txt"), path.join(root, "escape"));
  yield* fs.symlink(path.join(root, "abc.txt"), path.join(root, "alias"));
  return { at: (name: string) => path.join(root, name), outside, root, sibling };
});

const resolveWith = Effect.fnUntraced(function* (policy: OutboxAttachmentPolicy, paths: ReadonlyArray<string>) {
  const context = yield* Layer.build(OutboxAttachmentSource.layer(policy));
  return yield* Context.get(context, OutboxAttachmentSource).resolve(paths);
});

const reasonWith = (policy: OutboxAttachmentPolicy, paths: ReadonlyArray<string>) =>
  resolveWith(policy, paths).pipe(
    Effect.flip,
    Effect.map((error) => error.reason)
  );

describe("@beep/m365-mcp outbox attachment source", () => {
  it.layer(PlatformLayer, { timeout: "10 seconds" })("with a staged attachment root", (it) => {
    it.effect(
      "reads a file under the root and hashes its bytes",
      Effect.fnUntraced(function* () {
        const staged = yield* stage;
        const policy = OutboxAttachmentPolicy.make({ roots: [staged.root] });

        const attachments = yield* resolveWith(policy, [
          staged.at("abc.txt"),
          staged.at("alias"),
          staged.at("big.bin"),
        ]);

        assert.deepStrictEqual(
          A.map(attachments, (attachment) => [attachment.name, attachment.size, attachment.contentType]),
          [
            ["abc.txt", 3, "text/plain"],
            ["abc.txt", 3, "text/plain"],
            ["big.bin", 64, "application/octet-stream"],
          ]
        );
        assert.deepStrictEqual(
          A.map(A.take(attachments, 2), (attachment) => attachment.sha256),
          [ABC_SHA256, ABC_SHA256]
        );
        assert.deepStrictEqual(
          A.map(attachments, (attachment) => attachment.digest.sha256),
          A.map(attachments, (attachment) => attachment.sha256)
        );
      })
    );

    it.effect(
      "refuses relative paths, paths outside the roots, escaping symlinks and non-files",
      Effect.fnUntraced(function* () {
        const staged = yield* stage;
        const policy = OutboxAttachmentPolicy.make({ roots: [staged.root] });
        const reason = (candidate: string) => reasonWith(policy, [candidate]);

        assert.strictEqual(yield* reason("abc.txt"), "not-absolute");
        assert.strictEqual(yield* reason(`${staged.outside}/secret.txt`), "outside-roots");
        assert.strictEqual(yield* reason(`${staged.root}/../outside/secret.txt`), "outside-roots");
        assert.strictEqual(yield* reason(`${staged.sibling}/sibling.txt`), "outside-roots");
        assert.strictEqual(yield* reason(staged.at("escape")), "outside-roots");
        assert.strictEqual(yield* reason(staged.at("folder")), "not-a-file");
        assert.strictEqual(yield* reason(staged.root), "outside-roots");
        assert.strictEqual(yield* reason(staged.at("empty.txt")), "empty");
        assert.strictEqual(yield* reason(staged.at("missing.pdf")), "unreadable");
      })
    );

    it.effect(
      "enforces the per-file, count and total limits before reading",
      Effect.fnUntraced(function* () {
        const staged = yield* stage;
        const roots = [staged.root] as const;
        const abc = staged.at("abc.txt");

        assert.strictEqual(
          yield* reasonWith(OutboxAttachmentPolicy.make({ maxAttachmentBytes: 63, roots }), [staged.at("big.bin")]),
          "too-large"
        );
        assert.strictEqual(
          yield* reasonWith(OutboxAttachmentPolicy.make({ maxAttachments: 2, roots }), [abc, abc, abc]),
          "too-many"
        );
        assert.strictEqual(
          yield* reasonWith(OutboxAttachmentPolicy.make({ maxMessageAttachmentBytes: 66, roots }), [
            abc,
            staged.at("big.bin"),
          ]),
          "total-too-large"
        );
        assert.lengthOf(
          yield* resolveWith(OutboxAttachmentPolicy.make({ maxMessageAttachmentBytes: 67, roots }), [
            abc,
            staged.at("big.bin"),
          ]),
          2
        );
        // One bad path refuses the whole list.
        assert.strictEqual(
          yield* reasonWith(OutboxAttachmentPolicy.make({ roots }), [abc, staged.at("escape")]),
          "outside-roots"
        );
      })
    );

    it.effect(
      "does not start with a root it cannot enforce, and creates only the default root",
      Effect.fnUntraced(function* () {
        const staged = yield* stage;
        const fs = yield* FileSystem.FileSystem;
        const missing = `${staged.root}/not-there`;
        const build = (policy: OutboxAttachmentPolicy) => Layer.build(OutboxAttachmentSource.layer(policy));

        const missingRoot = yield* build(OutboxAttachmentPolicy.make({ roots: [missing] })).pipe(Effect.flip);
        const relativeRoot = yield* build(OutboxAttachmentPolicy.make({ roots: ["staging"] })).pipe(Effect.flip);
        const fileRoot = yield* build(OutboxAttachmentPolicy.make({ roots: [staged.at("abc.txt")] })).pipe(Effect.flip);
        assert.isFalse(yield* fs.exists(missing));
        yield* build(OutboxAttachmentPolicy.make({ createMissingRoots: true, roots: [missing] }));
        const created = yield* fs.stat(missing);

        assert.deepStrictEqual(
          [missingRoot.reason, relativeRoot.reason, fileRoot.reason],
          ["unreadable", "not-absolute", "not-a-file"]
        );
        assert.strictEqual(created.type, "Directory");
        assert.strictEqual(created.mode & 0o777, 0o700);
      })
    );
  });
});
