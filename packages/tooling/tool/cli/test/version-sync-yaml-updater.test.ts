// The VersionSync YAML updater writes through the `@beep/yaml` kit (R4). A
// scalar replacement splices only the target scalar, so comments, flow
// collections and folded blocks around it keep their bytes; the node-version
// fix removes and inserts a key, which re-serializes the document in the
// layout the npm `yaml` writer used before R4 (sequences indented under their
// key), keeping every comment.

import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { replaceNodeVersionWithFile, updateYamlValue } from "@beep/repo-cli/test/VersionSync";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertFalse, assertTrue, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Str from "effect/String";

const compose = A.join(
  [
    "services:",
    "  redis:",
    "    image: redis:8.10.3 # pinned",
    "    ports:",
    '      - "6379:6379"',
    "  postgres:",
    "    image: pgvector/pgvector:pg17",
    "    healthcheck:",
    '      test: [ "CMD-SHELL", "pg_isready -U postgres" ]',
    "    command: >-",
    "      postgres",
    "      -c wal_level=logical",
    "",
  ],
  "\n"
);

const workflow = A.join(
  [
    "name: Check # the workflow",
    "jobs:",
    "  test:",
    "    steps:",
    "      # pin the runtime",
    "      - uses: actions/setup-node@v4",
    "        with:",
    '          node-version: "22.23.4"',
    "          cache: bun",
    "",
  ],
  "\n"
);

const writeFixture = Effect.fnUntraced(function* (name: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.makeTempDirectoryScoped();
  const file = path.join(directory, name);
  yield* fs.writeFileString(file, content);
  return file;
});

it.layer(Layer.mergeAll(MemoryFileSystem.layer, Path.layer), { timeout: "30 seconds" })("YamlFileUpdater", (it) => {
  it.effect("replaces one scalar and leaves every other byte in place", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const file = yield* writeFixture("docker-compose.yml", compose);
      assertTrue(yield* updateYamlValue(file, ["services", "redis", "image"], { value: "redis:8.12.0" }));
      strictEqual(yield* fs.readFileString(file), Str.replace("redis:8.10.3", "redis:8.12.0")(compose));
    })
  );

  it.effect("reports no change when the value already matches", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const file = yield* writeFixture("docker-compose.yml", compose);
      assertFalse(yield* updateYamlValue(file, ["services", "postgres", "image"], { value: "pgvector/pgvector:pg17" }));
      strictEqual(yield* fs.readFileString(file), compose);
    })
  );

  it.effect("fails typed on a file that is not YAML", () =>
    Effect.gen(function* () {
      const file = yield* writeFixture("broken.yml", "services: [unclosed\n");
      const error = yield* Effect.flip(updateYamlValue(file, ["services"], { value: "x" }));
      expect(error.message).toContain(`Failed to parse ${file}: YAML parse failed`);
    })
  );

  it.effect("replaces node-version with node-version-file and keeps the comments", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const file = yield* writeFixture("check.yml", workflow);
      assertTrue(
        yield* replaceNodeVersionWithFile(file, [{ yamlPath: ["jobs", "test", "steps", 0, "with", "node-version"] }])
      );
      strictEqual(
        yield* fs.readFileString(file),
        A.join(
          [
            "name: Check # the workflow",
            "jobs:",
            "  test:",
            "    steps:",
            "      # pin the runtime",
            "      - uses: actions/setup-node@v4",
            "        with:",
            "          cache: bun",
            "          node-version-file: .nvmrc",
            "",
          ],
          "\n"
        )
      );
    })
  );

  it.effect("overwrites an existing node-version-file entry", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const file = yield* writeFixture(
        "action.yml",
        "runs:\n  steps:\n    - with:\n        node-version: ${{ inputs.node }}\n        node-version-file: other\n"
      );
      assertTrue(yield* replaceNodeVersionWithFile(file, [{ yamlPath: ["runs", "steps", 0, "with", "node-version"] }]));
      strictEqual(yield* fs.readFileString(file), "runs:\n  steps:\n    - with:\n        node-version-file: .nvmrc\n");
    })
  );

  it.effect("leaves the file alone when no location holds a node-version", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const file = yield* writeFixture("check.yml", workflow);
      assertFalse(
        yield* replaceNodeVersionWithFile(file, [{ yamlPath: ["jobs", "test", "steps", 0, "with", "missing"] }])
      );
      strictEqual(yield* fs.readFileString(file), workflow);
    })
  );
});
