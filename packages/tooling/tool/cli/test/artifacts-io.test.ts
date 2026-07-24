import {
  assertExclusiveModeFlags,
  checkGeneratedFile,
  formatJsonc,
  readArtifact,
  syncGeneratedFile,
  writeArtifact,
  writeGeneratedFile,
} from "@beep/repo-cli/test/Artifacts";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Data, Effect, Exit, FileSystem, Layer, Option, Path } from "effect";
import * as S from "effect/Schema";

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

class ArtifactTestError extends Data.TaggedError("ArtifactTestError")<{ readonly message: string }> {}
const toArtifactError = (cause: unknown): ArtifactTestError => new ArtifactTestError({ message: String(cause) });

const withTempDir = <A, E, R>(use: (dir: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectory()),
    use,
    (dir) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.remove(dir, { recursive: true }).pipe(Effect.orDie))
  ).pipe(provideScopedLayer(PlatformLayer));

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
  it("writes header + body verbatim and reads the document back", () =>
    Effect.runPromise(
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
    ));

  it("maps the read failure with the caller's factory when the file is absent", () =>
    Effect.runPromise(
      withTempDir(
        Effect.fnUntraced(function* (dir) {
          const path = yield* Path.Path;
          const exit = yield* readArtifact({
            path: path.join(dir, "missing.jsonc"),
            schema: ExampleDocument,
            onReadError: toArtifactError,
            onDecodeError: toArtifactError,
          }).pipe(Effect.exit);

          expect(Exit.isFailure(exit)).toBe(true);
          if (Exit.isFailure(exit)) {
            const failure = Cause.findErrorOption(exit.cause);
            if (Option.isSome(failure)) {
              expect(failure.value).toBeInstanceOf(ArtifactTestError);
            }
          }
        })
      )
    ));
});

describe("internal/artifacts/GeneratedFileDrift", () => {
  it.effect(
    "rejects the mutually-exclusive --write/--check combination",
    Effect.fnUntraced(function* () {
      const conflict = Effect.fail(new ArtifactTestError({ message: "conflict" }));
      const bothExit = yield* assertExclusiveModeFlags({
        write: true,
        check: true,
        onConflict: conflict,
      }).pipe(Effect.exit);
      expect(Exit.isFailure(bothExit)).toBe(true);

      const okExit = yield* assertExclusiveModeFlags({
        write: true,
        check: false,
        onConflict: conflict,
      }).pipe(Effect.exit);
      expect(Exit.isSuccess(okExit)).toBe(true);
    })
  );

  it("writes rendered content and runs the post-write effect", () =>
    Effect.runPromise(
      withTempDir(
        Effect.fnUntraced(function* (dir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const filePath = path.join(dir, "generated", "catalog.jsonc");

          yield* writeGeneratedFile({
            path: filePath,
            content: "// generated\n{}\n",
            onWrote: Effect.void,
            onError: toArtifactError,
          });

          expect(yield* fs.readFileString(filePath)).toBe("// generated\n{}\n");
        })
      )
    ));

  it("routes the current, stale, and missing branches of the check", () =>
    Effect.runPromise(
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
    ));

  it("dispatches syncGeneratedFile to write mode when write is set", () =>
    Effect.runPromise(
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
    ));
});
