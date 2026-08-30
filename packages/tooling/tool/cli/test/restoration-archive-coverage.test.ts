import { restorationArchiveTesting as RA } from "@beep/repo-cli/test/Corpus";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";

const provideTestLayer = provideScopedLayer(NodeServices.layer);

describe("restoration archive boundary helpers", () => {
  it.effect(
    "fails closed for canonical type, containment, crash, and prefix mismatches",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "restoration-archive-boundaries-" });
        const source = path.join(root, "source.bin");
        const equal = path.join(root, "equal.bin");
        const different = path.join(root, "different.bin");
        const short = path.join(root, "short.bin");
        yield* fs.writeFileString(source, "abcdef");
        yield* fs.writeFileString(equal, "abcdef");
        yield* fs.writeFileString(different, "abcxef");
        yield* fs.writeFileString(short, "abc");

        expect(
          yield* RA.inspectCanonicalPath(source, "File", "wrong type", "symbolic link").pipe(Effect.exit)
        ).toMatchObject({ _tag: "Success" });
        expect(
          yield* RA.inspectCanonicalPath(source, "Directory", "wrong type", "symbolic link").pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });
        expect(yield* RA.requireContainedPath(path, root, source, "outside", true)).toBe(source);
        expect(yield* RA.requireContainedPath(path, root, root, "equal", false).pipe(Effect.exit)).toMatchObject({
          _tag: "Failure",
        });
        expect(
          yield* RA.requireContainedPath(path, root, path.dirname(root), "outside", true).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });
        expect(yield* RA.prefixMatches(source, equal, 0, 2)).toBe(true);
        expect(yield* RA.prefixMatches(source, equal, 6, 2)).toBe(true);
        expect(yield* RA.prefixMatches(source, different, 6, 2)).toBe(false);
        expect(yield* RA.prefixMatches(source, short, 6, 2)).toBe(false);
        expect(yield* RA.maybeCrash("before-copy", "after-copy")).toBeUndefined();
        expect(yield* RA.maybeCrash("before-copy", "before-copy").pipe(Effect.exit)).toMatchObject({
          _tag: "Failure",
        });
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "derives stable inventory and writer-coordination identities",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "restoration-archive-identity-" });
        const info = yield* fs.stat(root);
        const identity = RA.sourceIdentity(info);
        const directory = {
          destinationRelativePath: "tree",
          expectedInfo: identity,
          objectId: "directory-id",
          sourceLabel: "tree",
          sourceRelativePath: ".",
        };
        const file = {
          destinationRelativePath: "tree/file.bin",
          expectedInfo: { ...identity, sizeBytes: 6, type: "File" as const },
          expectedSizeBytes: 6,
          objectId: "file-id",
          objectKind: "file" as const,
          sourceLabel: "tree",
          sourcePath: "/source/file.bin",
          sourceRelativePath: "file.bin",
        };
        const signature = RA.archiveInventorySignature([directory], [file]);
        expect(signature).toHaveLength(64);
        expect(RA.archiveInventorySignature([directory], [{ ...file, sourceRelativePath: "other.bin" }])).not.toBe(
          signature
        );

        expect(RA.reapedCoordinationPath("/tmp/claim")).toContain(".reaped-");
        const reapClaim = RA.writerReapClaimPath("/tmp/claim", "observed");
        expect(reapClaim).toContain(".reap-");
        expect(RA.writerReapClaimTombstonePath(reapClaim, "observed")).toContain(".claim.reap-");
      },
      Effect.scoped,
      provideTestLayer
    )
  );
});
