// The VersionSync YAML updater writes through the `@beep/yaml` kit (R4). A
// scalar replacement splices only the target scalar, so comments, flow
// collections and folded blocks around it keep their bytes; an insertion of a
// missing key and the node-version fix (which removes and inserts a key)
// re-serialize the document in the layout the npm `yaml` writer used before
// R4 (sequences indented under their key, quotes chosen per value), keeping
// every comment.

import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { replaceNodeVersionWithFile, updateYamlValue } from "@beep/repo-cli/test/VersionSync";
import { it } from "@beep/test-runner";
import { Yaml } from "@beep/yaml/Yaml";
import { expect } from "@effect/vitest";
import { assertFalse, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
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
      const updateYamlValue1 = yield* updateYamlValue(file, ["services", "redis", "image"], { value: "redis:8.12.0" });
      assertTrue(updateYamlValue1);
      const readFileString2 = yield* fs.readFileString(file);
      strictEqual(readFileString2, Str.replace("redis:8.10.3", "redis:8.12.0")(compose));
    })
  );

  it.effect("reports no change when the value already matches", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const file = yield* writeFixture("docker-compose.yml", compose);
      const updateYamlValue3 = yield* updateYamlValue(file, ["services", "postgres", "image"], {
        value: "pgvector/pgvector:pg17",
      });
      assertFalse(updateYamlValue3);
      const readFileString4 = yield* fs.readFileString(file);
      strictEqual(readFileString4, compose);
    })
  );

  it.effect("inserts a missing key in the yaml npm layout, keeping indented sequences and comments", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const source = A.join(["services:", "  redis:", "    ports:", '      - "6379:6379" # keep', ""], "\n");
      const file = yield* writeFixture("docker-compose.yml", source);
      const updateYamlValue5 = yield* updateYamlValue(file, ["services", "redis", "image"], { value: "redis:8.12.0" });
      assertTrue(updateYamlValue5);
      const readFileString6 = yield* fs.readFileString(file);
      strictEqual(
        readFileString6,
        A.join(
          ["services:", "  redis:", "    ports:", '      - "6379:6379" # keep', "    image: redis:8.12.0", ""],
          "\n"
        )
      );
    })
  );

  it.effect("splices a value that needs quotes with the quote the yaml npm writer picks", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const file = yield* writeFixture("docker-compose.yml", compose);
      const updateYamlValue7 = yield* updateYamlValue(file, ["services", "redis", "image"], { value: 'say "8": now' });
      assertTrue(updateYamlValue7);
      const readFileString8 = yield* fs.readFileString(file);
      strictEqual(readFileString8, Str.replace("redis:8.10.3", `'say "8": now'`)(compose));
    })
  );

  it.effect("keeps an anchored image's anchor so its aliases read the new value", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const source = A.join(
        ["services:", "  redis:", "    image: &redis redis:8.10.3 # pinned", "  replica:", "    image: *redis", ""],
        "\n"
      );
      const file = yield* writeFixture("docker-compose.yml", source);
      const updateYamlValue9 = yield* updateYamlValue(file, ["services", "redis", "image"], { value: "redis:8.12.0" });
      assertTrue(updateYamlValue9);
      const updated = yield* fs.readFileString(file);
      strictEqual(updated, Str.replace("redis:8.10.3", "redis:8.12.0")(source));
      const parsed = yield* Yaml.parse(updated);
      deepStrictEqual(parsed, {
        services: { redis: { image: "redis:8.12.0" }, replica: { image: "redis:8.12.0" } },
      });
    })
  );

  it.effect("updates an image pin under a %YAML 1.2 directive and keeps the prologue byte for byte", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const source = A.join(["%YAML 1.2", "---", compose], "\n");
      const file = yield* writeFixture("docker-compose.yml", source);
      const updateYamlValue10 = yield* updateYamlValue(file, ["services", "redis", "image"], { value: "redis:8.12.0" });
      assertTrue(updateYamlValue10);
      const readFileString11 = yield* fs.readFileString(file);
      strictEqual(readFileString11, Str.replace("redis:8.10.3", "redis:8.12.0")(source));

      // A missing key is an insertion: the whole document re-renders after the verbatim prologue.
      const updateYamlValue12 = yield* updateYamlValue(file, ["services", "redis", "restart"], { value: "always" });
      assertTrue(updateYamlValue12);
      const inserted = yield* fs.readFileString(file);
      assertTrue(Str.startsWith("%YAML 1.2\n---\nservices:\n")(inserted));
      const parsed13 = yield* Yaml.parse(inserted);
      expect(parsed13).toMatchObject({
        services: { redis: { image: "redis:8.12.0", ports: ["6379:6379"], restart: "always" } },
      });
    })
  );

  it.effect("reads an aliased value through its anchor before deciding to update", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const source = A.join(
        ["services:", "  redis:", "    image: &redis redis:8.10.3", "  replica:", "    image: *redis", ""],
        "\n"
      );
      const file = yield* writeFixture("docker-compose.yml", source);
      const updateYamlValue14 = yield* updateYamlValue(file, ["services", "replica", "image"], {
        value: "redis:8.10.3",
      });
      assertFalse(updateYamlValue14);
      const readFileString15 = yield* fs.readFileString(file);
      strictEqual(readFileString15, source);
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
      const replaceNodeVersionWithFile16 = yield* replaceNodeVersionWithFile(file, [
        { yamlPath: ["jobs", "test", "steps", 0, "with", "node-version"] },
      ]);
      assertTrue(replaceNodeVersionWithFile16);
      const readFileString17 = yield* fs.readFileString(file);
      strictEqual(
        readFileString17,
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

  it.effect("replaces an aliased node-version pin like a literal one", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const file = yield* writeFixture(
        "check.yml",
        A.join(
          [
            "env:",
            '  NODE: &runtime "22.23.4"',
            "jobs:",
            "  test:",
            "    steps:",
            "      - uses: actions/setup-node@v4",
            "        with:",
            "          node-version: *runtime",
            "          cache: bun",
            "",
          ],
          "\n"
        )
      );
      const replaceNodeVersionWithFile18 = yield* replaceNodeVersionWithFile(file, [
        { yamlPath: ["jobs", "test", "steps", 0, "with", "node-version"] },
      ]);
      assertTrue(replaceNodeVersionWithFile18);
      const readFileString19 = yield* fs.readFileString(file);
      strictEqual(
        readFileString19,
        A.join(
          [
            "env:",
            '  NODE: &runtime "22.23.4"',
            "jobs:",
            "  test:",
            "    steps:",
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
      const replaceNodeVersionWithFile20 = yield* replaceNodeVersionWithFile(file, [
        { yamlPath: ["runs", "steps", 0, "with", "node-version"] },
      ]);
      assertTrue(replaceNodeVersionWithFile20);
      const readFileString21 = yield* fs.readFileString(file);
      strictEqual(readFileString21, "runs:\n  steps:\n    - with:\n        node-version-file: .nvmrc\n");
    })
  );

  it.effect("leaves the file alone when no location holds a node-version", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const file = yield* writeFixture("check.yml", workflow);
      const replaceNodeVersionWithFile22 = yield* replaceNodeVersionWithFile(file, [
        { yamlPath: ["jobs", "test", "steps", 0, "with", "missing"] },
      ]);
      assertFalse(replaceNodeVersionWithFile22);
      const readFileString23 = yield* fs.readFileString(file);
      strictEqual(readFileString23, workflow);
    })
  );
});
