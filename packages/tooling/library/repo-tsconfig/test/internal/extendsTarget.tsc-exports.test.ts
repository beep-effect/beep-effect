/**
 * `exports` resolution against tsc's verdicts. Every row was measured with tsgo 7.0.2
 * (`tsc --showConfig` plus `--listFilesOnly`) on real temp packages; corpus B of
 * `goals/effected-promotion/ops/repo-tsconfig-differential.ts` replays the same rows as synthetic
 * specifiers. `expected` is the file tsc picked, or `Option.none()` where tsc reports TS6053.
 */
import { resolveExtendsTarget } from "@beep/repo-tsconfig/internal/extendsTarget";
import { describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { fixtureLayer } from "../support/fixtures.ts";
import type { FixtureTree } from "../support/fixtures.ts";

interface Row {
  /** The package-relative file tsc picked, or `Option.none()` for TS6053. */
  readonly expected: O.Option<string>;
  /** The raw `exports` JSON. */
  readonly exports: string;
  /** Files (relative to the package) that exist. */
  readonly files: ReadonlyArray<string>;
  /** The package name, also the specifier unless `spec` overrides it. */
  readonly name: string;
  readonly spec?: string;
}

const rows: ReadonlyArray<Row> = [
  {
    name: "through-file",
    exports: '{".":["./base.json/strict","./tsconfig.json"]}',
    files: ["base.json", "tsconfig.json"],
    expected: O.some("tsconfig.json"),
  },
  // A directory is a miss, even when its name ends in `.json` (#2133).
  {
    name: "directory-condition",
    exports: '{".":{"types":"./directory.json","default":"./tsconfig.json"}}',
    files: ["directory.json/child.json", "tsconfig.json"],
    expected: O.some("tsconfig.json"),
  },
  {
    name: "directory-array",
    exports: '{".":["./directory.json","./tsconfig.json"]}',
    files: ["directory.json/child.json", "tsconfig.json"],
    expected: O.some("tsconfig.json"),
  },
  // The review case and its variants.
  {
    name: "review",
    exports: '{".":{"types":"./index.d.ts","default":"./tsconfig.json"}}',
    files: ["tsconfig.json"],
    expected: O.some("tsconfig.json"),
  },
  {
    name: "sibling-present",
    exports: '{".":{"types":"./index.d.ts","default":"./tsconfig.json"}}',
    files: ["tsconfig.json", "index.json"],
    expected: O.some("index.json"),
  },
  {
    name: "array-fallthrough",
    exports: '{".":["./missing.json","./tsconfig.json"]}',
    files: ["tsconfig.json"],
    expected: O.some("tsconfig.json"),
  },
  {
    name: "nested-inner",
    exports: '{".":{"node":{"require":"./missing.json","types":"./tsconfig.json"},"default":"./other.json"}}',
    files: ["tsconfig.json", "other.json"],
    expected: O.some("tsconfig.json"),
  },
  {
    name: "nested-outer",
    exports: '{".":{"node":{"require":"./missing.json"},"default":"./tsconfig.json"}}',
    files: ["tsconfig.json"],
    expected: O.some("tsconfig.json"),
  },
  {
    name: "default-first",
    exports: '{".":{"default":"./tsconfig.json","types":"./other.json"}}',
    files: ["tsconfig.json", "other.json"],
    expected: O.some("tsconfig.json"),
  },
  {
    name: "default-missing",
    exports: '{".":{"default":"./missing.json","types":"./tsconfig.json"}}',
    files: ["tsconfig.json"],
    expected: O.some("tsconfig.json"),
  },
  {
    name: "dts-without-sibling",
    exports: '{".":{"types":"./index.d.ts","default":"./tsconfig.json"}}',
    files: ["tsconfig.json", "index.d.ts"],
    expected: O.some("tsconfig.json"),
  },
  {
    name: "array-in-condition",
    exports: '{".":{"types":["./missing.json","./a.d.ts"],"default":"./tsconfig.json"}}',
    files: ["tsconfig.json"],
    expected: O.some("tsconfig.json"),
  },
  {
    name: "condition-in-array",
    exports: '{".":[{"types":"./missing.json"},"./tsconfig.json"]}',
    files: ["tsconfig.json"],
    expected: O.some("tsconfig.json"),
  },
  {
    name: "subpath-fallthrough",
    exports: '{"./base":{"types":"./missing.d.ts","default":"./tsconfig.json"}}',
    files: ["tsconfig.json"],
    spec: "subpath-fallthrough/base",
    expected: O.some("tsconfig.json"),
  },
  {
    name: "all-missing",
    exports: '{".":{"types":"./missing.d.ts","default":"./missing2.json"}}',
    files: ["tsconfig.json"],
    expected: O.none(),
  },
  {
    name: "import-unhonored",
    exports: '{".":{"import":"./other.json","default":"./tsconfig.json"}}',
    files: ["tsconfig.json", "other.json"],
    expected: O.some("tsconfig.json"),
  },
  {
    name: "ts-target",
    exports: '{".":{"types":"./src/index.ts","default":"./tsconfig.json"}}',
    files: ["tsconfig.json", "src/index.json"],
    expected: O.some("src/index.json"),
  },
  {
    name: "wildcard-fallthrough",
    exports: '{"./*":{"types":"./*.d.ts","default":"./*.json"}}',
    files: ["tsconfig.json"],
    spec: "wildcard-fallthrough/tsconfig",
    expected: O.some("tsconfig.json"),
  },
  {
    name: "wildcard-array",
    exports: '{"./*":["./missing/*.json","./*.json"]}',
    files: ["tsconfig.json"],
    spec: "wildcard-array/tsconfig",
    expected: O.some("tsconfig.json"),
  },
  {
    name: "exact-key-decides",
    exports: '{"./base":"./missing.json","./*":"./tsconfig.json"}',
    files: ["tsconfig.json"],
    spec: "exact-key-decides/base",
    expected: O.none(),
  },
  // A `null` target stops tsc where it stands; it never falls through.
  {
    name: "null-first",
    exports: '{".":{"types":null,"default":"./tsconfig.json"}}',
    files: ["tsconfig.json"],
    expected: O.none(),
  },
  {
    name: "null-mid-array",
    exports: '{".":["./missing.json",null,"./tsconfig.json"]}',
    files: ["tsconfig.json"],
    expected: O.none(),
  },
  {
    name: "null-nested",
    exports: '{".":{"node":{"types":null},"default":"./tsconfig.json"}}',
    files: ["tsconfig.json"],
    expected: O.none(),
  },
  {
    name: "null-after-missing",
    exports: '{".":{"node":{"types":"./missing.json","default":null},"default":"./tsconfig.json"}}',
    files: ["tsconfig.json"],
    expected: O.none(),
  },
  {
    name: "null-in-array-condition",
    exports: '{".":[{"types":null},"./tsconfig.json"]}',
    files: ["tsconfig.json"],
    expected: O.none(),
  },
  {
    name: "null-unhonored",
    exports: '{".":{"import":null,"default":"./tsconfig.json"}}',
    files: ["tsconfig.json"],
    expected: O.some("tsconfig.json"),
  },
  {
    name: "null-subpath",
    exports: '{"./base":null,"./*":"./tsconfig.json"}',
    files: ["tsconfig.json"],
    spec: "null-subpath/base",
    expected: O.none(),
  },
  // Invalid targets are skipped; tsc keeps walking.
  {
    name: "no-dot-slash",
    exports: '{".":{"types":"other.json","default":"./tsconfig.json"}}',
    files: ["tsconfig.json", "other.json"],
    expected: O.some("tsconfig.json"),
  },
  {
    name: "dot-dot-target",
    exports: '{".":{"types":"../outside.json","default":"./tsconfig.json"}}',
    files: ["tsconfig.json"],
    expected: O.some("tsconfig.json"),
  },
  {
    name: "node-modules-target",
    exports: '{".":{"types":"./node_modules/x.json","default":"./tsconfig.json"}}',
    files: ["tsconfig.json", "node_modules/x.json"],
    expected: O.some("tsconfig.json"),
  },
  {
    name: "node-modules-case",
    exports: '{".":{"types":"./Node_Modules/x.json","default":"./tsconfig.json"}}',
    files: ["tsconfig.json", "Node_Modules/x.json"],
    expected: O.some("Node_Modules/x.json"),
  },
  {
    name: "dot-segment-target",
    exports: '{".":{"types":"./a/./x.json","default":"./tsconfig.json"}}',
    files: ["tsconfig.json", "a/x.json"],
    expected: O.some("tsconfig.json"),
  },
  {
    name: "backslash-target",
    exports: '{".":{"types":"./a\\\\..\\\\other.json","default":"./tsconfig.json"}}',
    files: ["tsconfig.json", "a\\..\\other.json"],
    expected: O.some("tsconfig.json"),
  },
  // A `*` capture with an invalid segment is skipped too.
  {
    name: "capture-dot-dot",
    exports: '{"./*":["./*.json","./tsconfig.json"]}',
    files: ["tsconfig.json"],
    spec: "capture-dot-dot/x/../tsconfig",
    expected: O.none(),
  },
  {
    name: "capture-node-modules",
    exports: '{"./*":{"types":"./*.json","default":"./tsconfig.json"}}',
    files: ["tsconfig.json", "node_modules/tsconfig.json"],
    spec: "capture-node-modules/node_modules/tsconfig",
    expected: O.none(),
  },
  {
    name: "capture-dot",
    exports: '{"./*":{"types":"./*.json","default":"./tsconfig.json"}}',
    files: ["tsconfig.json", "a/x.json"],
    spec: "capture-dot/a/./x",
    expected: O.none(),
  },
  {
    name: "capture-valid",
    exports: '{"./*":{"types":"./*.json","default":"./tsconfig.json"}}',
    files: ["tsconfig.json", "a/x.json"],
    spec: "capture-valid/a/x",
    expected: O.some("a/x.json"),
  },
  // Which `exports` values count as absent.
  { name: "exports-null", exports: "null", files: ["tsconfig.json"], expected: O.some("tsconfig.json") },
  { name: "exports-false", exports: "false", files: ["tsconfig.json"], expected: O.some("tsconfig.json") },
  { name: "exports-empty-string", exports: '""', files: ["tsconfig.json"], expected: O.some("tsconfig.json") },
  { name: "exports-zero", exports: "0", files: ["tsconfig.json"], expected: O.none() },
  { name: "exports-true", exports: "true", files: ["tsconfig.json"], expected: O.none() },
  { name: "exports-empty-object", exports: "{}", files: ["tsconfig.json"], expected: O.none() },
  { name: "exports-empty-array", exports: "[]", files: ["tsconfig.json"], expected: O.none() },
];

const flat: FixtureTree = R.fromEntries(
  A.flatMap(rows, ({ name, exports, files }) => [
    [`/p/node_modules/${name}/package.json`, `{"name":"${name}","exports":${exports}}`] as const,
    ...A.map(files, (file) => [`/p/node_modules/${name}/${file}`, "{}"] as const),
  ])
);

describe("extendsTarget exports resolution matches tsc", () => {
  it.layer(fixtureLayer({ "/p/base/child.json": "{}", "/p/base.json": "{}", "/p/directory.json/child.json": "{}" }), {
    timeout: "10 seconds",
  })("relative directory targets", (it) => {
    it.effect("retries a relative directory as its .json sibling", () =>
      Effect.gen(function* () {
        const resolvedExtendsTarget = yield* resolveExtendsTarget("./base", "/p/tsconfig.json");
        assertSome(resolvedExtendsTarget, "/p/base.json");
        const resolvedExtendsTarget1 = yield* resolveExtendsTarget("./directory.json", "/p/tsconfig.json");
        assertNone(resolvedExtendsTarget1);
      })
    );
  });
  it.layer(fixtureLayer(flat), { timeout: "10 seconds" })("one package directory", (it) => {
    for (const { name, spec, expected } of rows) {
      it.effect(`${name} -> ${O.getOrElse(expected, () => "TS6053")}`, () =>
        Effect.gen(function* () {
          const result = yield* resolveExtendsTarget(spec ?? name, "/p/case/tsconfig.json");
          O.match(expected, {
            onNone: () => assertNone(result),
            onSome: (file) => assertSome(result, `/p/node_modules/${name}/${file}`),
          });
        })
      );
    }
  });

  // A near copy under /p/sub/node_modules, a manifest-less far copy under /p/node_modules.
  const ancestorRows: ReadonlyArray<readonly [string, string, string, boolean]> = [
    ["far-after-directory", '{".":"./directory.json"}', "far-after-directory", true],
    ["far-after-fallback-directory", "null", "far-after-fallback-directory", true],
    ["far-after-missing", '{".":"./missing.json"}', "far-after-missing", true],
    ["far-after-capture", '{"./*":"./*.json"}', "far-after-capture/x/../tsconfig", true],
    ["null-stops-walk", '{".":{"types":null,"default":"./tsconfig.json"}}', "null-stops-walk", false],
    ["null-after-capture", '{"./*":["./*.json",null]}', "null-after-capture/x/../tsconfig", false],
  ];
  const ancestors: FixtureTree = R.fromEntries(
    A.flatMap(ancestorRows, ([name, exports]) => [
      [`/p/sub/node_modules/${name}/package.json`, `{"name":"${name}","exports":${exports}}`] as const,
      [
        `/p/sub/node_modules/${name}/${name === "far-after-fallback-directory" ? "tsconfig.json/child.json" : "tsconfig.json"}`,
        "{}",
      ] as const,
      [`/p/sub/node_modules/${name}/directory.json/child.json`, "{}"] as const,
      [`/p/node_modules/${name}/package.json`, `{"name":"${name}"}`] as const,
      [`/p/node_modules/${name}/tsconfig.json`, "{}"] as const,
    ])
  );
  it.layer(fixtureLayer(ancestors), { timeout: "10 seconds" })("the ancestor walk", (it) => {
    for (const [name, , spec, walksOn] of ancestorRows) {
      it.effect(`${name} -> ${walksOn ? "far copy" : "TS6053"}`, () =>
        Effect.gen(function* () {
          const result = yield* resolveExtendsTarget(spec, "/p/sub/case/tsconfig.json");
          if (walksOn) assertSome(result, `/p/node_modules/${name}/tsconfig.json`);
          else assertNone(result);
        })
      );
    }
  });
});
