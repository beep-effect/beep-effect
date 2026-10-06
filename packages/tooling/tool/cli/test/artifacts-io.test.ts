import {
  assertExclusiveModeFlags,
  checkGeneratedFile,
  formatJsonc,
  readArtifact,
  syncGeneratedFile,
  writeArtifact,
  writeGeneratedFile,
} from "@beep/repo-cli/test/Artifacts";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { describe, expect, it } from "@effect/vitest";
import { Data, Effect, FileSystem, Layer, Path, Ref } from "effect";
import * as S from "effect/Schema";

const testLayer = Layer.mergeAll(MemoryFileSystem.layer, Path.layer);

class ArtifactTestError extends Data.TaggedError("ArtifactTestError")<{ readonly message: string }> {}
const toArtifactError = (cause: unknown): ArtifactTestError => new ArtifactTestError({ message: String(cause) });

const withTempDir = Effect.fn("withTempDir")(function* <A, E, R>(use: (dir: string) => Effect.Effect<A, E, R>) {
  const fs = yield* FileSystem.FileSystem;
  const dir = yield* fs.makeTempDirectoryScoped();
  return yield* use(dir);
});

const ExampleDocument = S.Struct({ schema_version: S.Literal(1), total: S.Finite });

describe("internal/artifacts/ArtifactIo formatJsonc", () => {
  it.effect(
    "renders deterministic two-space JSONC ending in a single newline",
    Effect.fnUntraced(function* () {
      const text = yield* formatJsonc({ schema_version: 1, total: 3 });
      expect(text).toBe(`{\n  "schema_version": 1,\n  "total": 3\n}\n`);
    })
  );
});

describe("internal/artifacts/ArtifactIo readArtifact / writeArtifact", () => {
  it.layer(Layer.fresh(testLayer), { timeout: "30 seconds" })((it) => {
    it.effect("writes header + body verbatim and reads the document back", () =>
      withTempDir(
        Effect.fnUntraced(function* (dir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const filePath = path.join(dir, "nested", "artifact.jsonc");
          const body = yield* formatJsonc({ schema_version: 1, total: 7 });

          yield* writeArtifact({
            path: filePath,
            header: "// Do not edit by hand.\n",
            body,
            onError: toArtifactError,
          });

          const raw = yield* fs.readFileString(filePath);
          expect(raw).toBe(`// Do not edit by hand.\n{\n  "schema_version": 1,\n  "total": 7\n}\n`);

          const decoded = yield* readArtifact({
            path: filePath,
            schema: ExampleDocument,
            onReadError: toArtifactError,
            onDecodeError: toArtifactError,
          });
          expect(decoded.total).toBe(7);
        })
      )
    );

    it.effect("maps the read failure with the caller's factory when the file is absent", () =>
      withTempDir(
        Effect.fnUntraced(function* (dir) {
          const path = yield* Path.Path;
          const failure = yield* readArtifact({
            path: path.join(dir, "missing.jsonc"),
            schema: ExampleDocument,
            onReadError: toArtifactError,
            onDecodeError: toArtifactError,
          }).pipe(Effect.flip);

          expect(failure).toBeInstanceOf(ArtifactTestError);
        })
      )
    );
  });
});

describe("internal/artifacts/GeneratedFileDrift", () => {
  it.layer(Layer.fresh(testLayer), { timeout: "30 seconds" })((it) => {
    it.effect(
      "rejects the mutually-exclusive --write/--check combination",
      Effect.fnUntraced(function* () {
        const conflict = Effect.fail(new ArtifactTestError({ message: "conflict" }));
        const failure = yield* assertExclusiveModeFlags({
          write: true,
          check: true,
          onConflict: conflict,
        }).pipe(Effect.flip);
        expect(failure.message).toBe("conflict");

        yield* assertExclusiveModeFlags({
          write: true,
          check: false,
          onConflict: conflict,
        });
      })
    );

    it.effect("writes rendered content and runs the post-write effect", () =>
      withTempDir(
        Effect.fnUntraced(function* (dir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const filePath = path.join(dir, "generated", "catalog.jsonc");
          const wrote = yield* Ref.make(false);

          yield* writeGeneratedFile({
            path: filePath,
            content: "// generated\n{}\n",
            onWrote: Ref.set(wrote, true),
            onError: toArtifactError,
          });

          expect(yield* fs.readFileString(filePath)).toBe("// generated\n{}\n");
          expect(yield* Ref.get(wrote)).toBe(true);
        })
      )
    );

    it.effect("routes the current, stale, and missing branches of the check", () =>
      withTempDir(
        Effect.fnUntraced(function* (dir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const filePath = path.join(dir, "catalog.jsonc");
          const content = "// generated\n{}\n";

          const missing = yield* checkGeneratedFile({
            path: filePath,
            content,
            onMissing: Effect.fail(new ArtifactTestError({ message: "missing" })),
            onStale: Effect.fail(new ArtifactTestError({ message: "stale" })),
            onCurrent: Effect.void,
            onError: toArtifactError,
          }).pipe(Effect.flip);
          expect(missing.message).toBe("missing");

          yield* fs.writeFileString(filePath, '// generated\n{ "old": true }\n');
          const stale = yield* checkGeneratedFile({
            path: filePath,
            content,
            onMissing: Effect.fail(new ArtifactTestError({ message: "missing" })),
            onStale: Effect.fail(new ArtifactTestError({ message: "stale" })),
            onCurrent: Effect.void,
            onError: toArtifactError,
          }).pipe(Effect.flip);
          expect(stale.message).toBe("stale");

          yield* fs.writeFileString(filePath, content);
          const current = yield* checkGeneratedFile({
            path: filePath,
            content,
            onMissing: Effect.fail(new ArtifactTestError({ message: "missing" })),
            onStale: Effect.fail(new ArtifactTestError({ message: "stale" })),
            onCurrent: Effect.succeed("current"),
            onError: toArtifactError,
          });
          expect(current).toBe("current");
        })
      )
    );

    it.effect("dispatches syncGeneratedFile to write mode when write is set", () =>
      withTempDir(
        Effect.fnUntraced(function* (dir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const filePath = path.join(dir, "boundaries.jsonc");

          yield* syncGeneratedFile({
            write: true,
            path: filePath,
            content: "{}\n",
            onWrote: Effect.void,
            onMissing: Effect.fail(new ArtifactTestError({ message: "missing" })),
            onStale: Effect.fail(new ArtifactTestError({ message: "stale" })),
            onCurrent: Effect.void,
            onError: toArtifactError,
          });

          expect(yield* fs.exists(filePath)).toBe(true);
        })
      )
    );
  });
});
