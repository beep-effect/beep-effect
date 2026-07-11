import { fileURLToPath } from "node:url";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect, FileSystem, Inspectable, Layer, Path, Result } from "effect";
import { normalizePath } from "../src/eslint/Shared.ts";
import { ALLOWLIST_PATH, EffectLawsAllowlistSnapshot } from "../src/internal/eslint/EffectLawsAllowlistSchemas.ts";
import {
  buildAllowlistSnapshotFromJsoncText,
  renderAllowlistSnapshotModule,
} from "../src/internal/eslint/EffectLawsAllowlistSnapshotCodegen.ts";

const SNAPSHOT_OUTPUT_PATH = "src/internal/eslint/generated/EffectLawsAllowlistSnapshot.ts";
const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));

const buildSnapshotFromAllowlist = Effect.fn(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const absoluteAllowlistPath = normalizePath(path.resolve(REPO_ROOT, ALLOWLIST_PATH));
  const normalizedAllowlistPath = normalizePath(ALLOWLIST_PATH);
  const allowlistTextResult = yield* fs.readFileString(absoluteAllowlistPath).pipe(
    Effect.map(Result.succeed),
    Effect.catch((cause) =>
      Effect.succeed(
        Result.fail([
          `Failed to read allowlist file ${absoluteAllowlistPath}: ${Inspectable.toStringUnknown(cause, 0)}`,
        ])
      )
    )
  );

  return yield* Result.match(allowlistTextResult, {
    onFailure: (diagnostics) =>
      Effect.succeed(
        EffectLawsAllowlistSnapshot.make({
          path: normalizedAllowlistPath,
          diagnostics,
        })
      ),
    onSuccess: (allowlistText) => buildAllowlistSnapshotFromJsoncText(allowlistText),
  });
});

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const snapshot = yield* buildSnapshotFromAllowlist();
  const outputPath = normalizePath(path.resolve(PACKAGE_ROOT, SNAPSHOT_OUTPUT_PATH));
  const outputDirectory = normalizePath(path.dirname(outputPath));
  const snapshotModule = yield* renderAllowlistSnapshotModule(snapshot);

  yield* fs.makeDirectory(outputDirectory, { recursive: true });
  yield* fs.writeFileString(outputPath, snapshotModule);

  yield* Console.log(`[allowlist-codegen] wrote ${SNAPSHOT_OUTPUT_PATH}`);
  yield* Console.log(`[allowlist-codegen] entries=${snapshot.entries.length}`);
  yield* Console.log(`[allowlist-codegen] diagnostics=${snapshot.diagnostics.length}`);
});

const main = Effect.scoped(
  Layer.build(NodeServices.layer).pipe(Effect.flatMap((context) => Effect.provide(program, context)))
);

NodeRuntime.runMain(main);
