import { ProcessAttachmentKind, scanProcessAttachments } from "@beep/repo-cli/test/RepoRun";
import { provideScopedLayer } from "@beep/test-utils";
import { A, O, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";

const ownAttachments = (scan: O.Option<ReadonlyArray<{ readonly pid: number }>>) =>
  A.filter(O.getOrThrow(scan), (attachment) => attachment.pid === process.pid);

describe("scanProcessAttachments", () => {
  it.effect("finds the invoking process through its cwd and reports an idle directory empty", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const idle = yield* fs.makeTempDirectoryScoped({ prefix: "process-attachment-idle-" });

      const own = ownAttachments(yield* scanProcessAttachments({ directory: process.cwd(), kinds: ["cwd"] }));
      expect(A.map(own, (attachment) => attachment.kind)).toEqual(["cwd"]);

      const idleScan = yield* scanProcessAttachments({ directory: idle, kinds: ProcessAttachmentKind.Options });
      expect(O.getOrThrow(idleScan)).toEqual([]);
    }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer))
  );

  it.effect("finds an open descriptor through a symlinked directory and forgets it once closed", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "process-attachment-fd-" });
      const real = path.join(root, "real");
      const link = path.join(root, "link");
      yield* fs.makeDirectory(real);
      yield* fs.symlink(real, link);
      yield* fs.writeFileString(path.join(real, "held.log"), "");

      // The kernel resolves /proc link targets fully, so scanning through the symlink
      // must still see a descriptor opened under the real directory.
      const whileOpen = yield* Effect.scoped(
        Effect.gen(function* () {
          yield* fs.open(path.join(real, "held.log"), { flag: "r" });
          return yield* scanProcessAttachments({ directory: link, kinds: ["descriptor"] });
        })
      );
      const held = ownAttachments(whileOpen);
      expect(A.map(held, (attachment) => attachment.kind)).toEqual(["descriptor"]);
      expect(A.every(held, (attachment) => Str.endsWith("/real/held.log")(attachment.target))).toBe(true);

      const afterClose = yield* scanProcessAttachments({ directory: link, kinds: ["descriptor"] });
      expect(ownAttachments(afterClose)).toEqual([]);
    }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer))
  );

  it.effect("withholds the result when the directory cannot be resolved", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "process-attachment-missing-" });
      const scan = yield* scanProcessAttachments({ directory: path.join(root, "missing"), kinds: ["cwd"] });
      expect(O.isNone(scan)).toBe(true);
    }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer))
  );
});
