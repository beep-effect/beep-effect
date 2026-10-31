import { fcRuns } from "@beep/fc-runs";
import { ChangeClassifier, ClassifyInput, RouteError } from "@beep/repo-cli/commands/Ci";
import {
  ChangeClassifierLive,
  ChangedPathEntry,
  ChangedPathStatus,
  ClassifyDiff,
  changedPathEntriesFromNameStatus,
  classifyChangedPaths,
  pathAtomKind,
} from "@beep/repo-cli/commands/Ci/RouteClassify";
import { runRepoCommandCapture } from "@beep/repo-cli/test/RepoRun";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { ChangeAtomKind, ChangeSet } from "@beep/repo-cli/commands/Ci";
import type { RouteReadAt } from "@beep/repo-cli/commands/Ci/RouteClassify";

const ROOT_MANIFEST = '{ "name": "@fixture/root", "workspaces": ["packages/*"] }';

/** A read source over an in-memory tree keyed `ref:path`. */
const memoryReadAt =
  (files: Readonly<Record<string, string>>): RouteReadAt =>
  (ref, file) =>
    Effect.succeed(R.get(files, `${ref}:${file}`));

/** A read source over `test/fixtures/ci-route/classify/<fixture>/<ref>/<path>`. */
const fixtureReadAt = Effect.fn("routeClassifyTest.fixtureReadAt")(function* (fixture: string) {
  const path = yield* Path.Path;
  const root = yield* path.fromFileUrl(new URL(`./fixtures/ci-route/classify/${fixture}`, import.meta.url));
  const read: RouteReadAt<FileSystem.FileSystem> = (ref, file) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const target = path.join(root, ref, file);
      return (yield* fs.exists(target)) ? O.some(yield* fs.readFileString(target)) : O.none<string>();
    }).pipe(Effect.mapError(RouteError.mapError("classify", `Failed to read fixture ${file} at ${ref}.`)));
  return read;
});

const diffOf = (entries: ReadonlyArray<readonly [string, ChangedPathStatus]>, commits = 0): ClassifyDiff =>
  ClassifyDiff.make({
    base: "base",
    head: "head",
    entries: A.map(entries, ([path, status]) => ChangedPathEntry.make({ path, status })),
    commits,
  });

/** `[path, kind, pkg, detail]` per atom, with `-` for an absent option. */
const rows = (changeSet: ChangeSet): ReadonlyArray<ReadonlyArray<string>> =>
  A.map(changeSet.atoms, (atom) => [
    atom.path,
    atom.kind,
    O.getOrElse(atom.pkg, () => "-"),
    O.getOrElse(atom.detail, () => "-"),
  ]);

const sha256 = Effect.fn("routeClassifyTest.sha256")(function* (text: string) {
  const crypto = yield* Crypto.Crypto;
  return Hex.encode(yield* crypto.digest("SHA-256", new TextEncoder().encode(text)));
});

const Segment = S.Literals([
  "packages",
  "app",
  "src",
  "test",
  "docs",
  "goals",
  ".github",
  "workflows",
  "package.json",
  "index.ts",
  "README.md",
  "bun.lock",
  "tsconfig.json",
  "logo.png",
  "Thing.generated.ts",
  "Button.stories.tsx",
  ".env.local",
  "vite.config.ts",
]);
const pathArbitrary = Arbitrary.all({
  raw: Arbitrary.schema(S.NonEmptyString),
  segments: Arbitrary.array(Arbitrary.schema(Segment), { minLength: 1, maxLength: 5 }),
  realistic: Arbitrary.schema(S.Boolean),
}).pipe(Arbitrary.map(({ raw, segments, realistic }) => (realistic ? A.join(segments, "/") : raw)));
const entriesArbitrary = Arbitrary.array(
  Arbitrary.all({ path: pathArbitrary, status: Arbitrary.schema(ChangedPathStatus) }),
  { maxLength: 24 }
).pipe(Arbitrary.map(A.dedupeWith((left, right) => left.path === right.path)));

const CommitCount = S.Literals([0, 1, 3]);
const StringRecord = S.Record(S.String, S.String);
const StringArray = S.Array(S.String);
/** Manifest-shaped documents that hit every field family, or raw text that rarely parses. */
const ManifestText = S.Union([
  S.String,
  S.Struct({
    name: S.optionalKey(S.String),
    version: S.optionalKey(S.Union([S.String, S.Int])),
    scripts: S.optionalKey(S.Union([StringRecord, S.String])),
    exports: S.optionalKey(S.Union([StringRecord, S.String])),
    catalog: S.optionalKey(StringRecord),
    catalogs: S.optionalKey(S.Record(S.String, StringRecord)),
    workspaces: S.optionalKey(
      S.Union([StringArray, S.Struct({ packages: S.optionalKey(StringArray), catalog: S.optionalKey(StringRecord) })])
    ),
    dependencies: S.optionalKey(S.Union([StringRecord, S.String])),
    devDependencies: S.optionalKey(StringRecord),
  }),
]);
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const manifestText = (value: typeof ManifestText.Type) =>
  P.isString(value) ? Effect.succeed(value) : encodeJson(value).pipe(Effect.orDie);

const short = Str.slice(0, 12);
const GIT_ENV = { GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
const GIT_IDENTITY = [
  "-c",
  "user.name=Route Fixture",
  "-c",
  "user.email=route@example.invalid",
  "-c",
  "commit.gpgsign=false",
];

const TestLayer = Layer.provideMerge(ChangeClassifierLive, NodeServices.layer);

it.layer(TestLayer, { timeout: "60 seconds" })("verification route classify", (it) => {
  describe("totality", () => {
    it.effect.prop(
      "yields one atom per changed path plus one commits atom when the head adds commits",
      { entries: entriesArbitrary, commits: CommitCount },
      ({ entries, commits }) =>
        Effect.gen(function* () {
          const changeSet = yield* classifyChangedPaths(
            diffOf(
              A.map(entries, (entry) => [entry.path, entry.status] as const),
              commits
            ),
            memoryReadAt({ "base:package.json": ROOT_MANIFEST, "head:package.json": ROOT_MANIFEST })
          );
          const paths = A.sort(
            A.map(entries, (entry) => entry.path),
            Order.String
          );
          const commitPaths = commits > 0 ? ["<commits>"] : [];
          expect(A.map(changeSet.atoms, (atom) => atom.path)).toEqual([...paths, ...commitPaths]);
          expect(A.length(A.filter(changeSet.atoms, (atom) => atom.kind === "commits"))).toBe(A.length(commitPaths));
          expect(changeSet.changedPaths).toEqual(paths);
        }),
      { arbitrary: fcRuns(60) }
    );

    it.effect.prop(
      "never fails on arbitrary package.json contents and always yields an atom for the path",
      { before: ManifestText, after: ManifestText, status: ChangedPathStatus },
      ({ before, after, status }) =>
        Effect.gen(function* () {
          const manifest = "packages/app/package.json";
          const changeSet = yield* classifyChangedPaths(
            diffOf([[manifest, status]]),
            memoryReadAt({
              "base:package.json": ROOT_MANIFEST,
              "head:package.json": ROOT_MANIFEST,
              [`base:${manifest}`]: yield* manifestText(before),
              [`head:${manifest}`]: yield* manifestText(after),
            })
          );
          expect(A.isReadonlyArrayNonEmpty(changeSet.atoms)).toBe(true);
          expect(A.every(changeSet.atoms, (atom) => atom.path === manifest)).toBe(true);
        }),
      { arbitrary: fcRuns(60) }
    );
  });

  describe("package.json field families", () => {
    it.effect("a root catalog bump yields one pkg:catalog atom with the version detail", () =>
      Effect.gen(function* () {
        const changeSet = yield* classifyChangedPaths(
          diffOf([["package.json", "M"]]),
          yield* fixtureReadAt("root-catalog")
        );
        expect(rows(changeSet)).toEqual([
          ["package.json", "pkg:catalog", "@fixture/root", "catalog @biomejs/biome 2.5.6 -> 9.9.9"],
        ]);
        expect(A.some(changeSet.atoms, (atom) => atom.kind === "unknown")).toBe(false);
        expect(changeSet.atoms[0]?.digest).toBe(
          yield* sha256("pkg:catalog\u0000package.json\u0000catalog @biomejs/biome 2.5.6 -> 9.9.9")
        );
      })
    );

    it.effect("a package script edit yields pkg:script owned by the package", () =>
      Effect.gen(function* () {
        const changeSet = yield* classifyChangedPaths(
          diffOf([["packages/app/package.json", "M"]]),
          yield* fixtureReadAt("package-script")
        );
        expect(rows(changeSet)).toEqual([
          ["packages/app/package.json", "pkg:script", "@fixture/app", "scripts test changed"],
        ]);
      })
    );

    it.effect("dependency fields split into version, added and removed atoms beside other fields", () =>
      Effect.gen(function* () {
        const changeSet = yield* classifyChangedPaths(
          diffOf([["packages/app/package.json", "M"]]),
          yield* fixtureReadAt("dependencies")
        );
        expect(rows(changeSet)).toEqual([
          ["packages/app/package.json", "pkg:dep-version", "@fixture/app", "dependencies effect 4.0.5 -> 4.0.6"],
          ["packages/app/package.json", "pkg:dep-added", "@fixture/app", "dependencies right-pad added 2.0.0"],
          ["packages/app/package.json", "pkg:dep-removed", "@fixture/app", "dependencies left-pad removed 1.3.0"],
          ["packages/app/package.json", "pkg:manifest-other", "@fixture/app", "version 0.0.0 -> 0.0.1"],
        ]);
      })
    );

    it.effect("an unparseable package.json yields one unknown atom", () =>
      Effect.gen(function* () {
        const manifest = "packages/app/package.json";
        const changeSet = yield* classifyChangedPaths(
          diffOf([[manifest, "M"]]),
          memoryReadAt({
            "head:package.json": ROOT_MANIFEST,
            [`base:${manifest}`]: '{ "name": "@fixture/app" }',
            [`head:${manifest}`]: '{ "name": "@fixture/app", ',
          })
        );
        expect(A.map(changeSet.atoms, (atom) => atom.kind)).toEqual(["unknown"]);
        assertSome(changeSet.atoms[0]?.detail ?? O.none(), "package.json does not parse as a JSON object at head");
      })
    );

    it.effect("added, deleted and format-only package.json changes are unknown", () =>
      Effect.gen(function* () {
        const changeSet = yield* classifyChangedPaths(
          diffOf([
            ["packages/new/package.json", "A"],
            ["packages/old/package.json", "D"],
            ["packages/app/package.json", "M"],
          ]),
          memoryReadAt({
            "base:package.json": ROOT_MANIFEST,
            "head:package.json": ROOT_MANIFEST,
            "base:packages/app/package.json": '{"name":"@fixture/app","private":true}',
            "head:packages/app/package.json": '{\n  "private": true,\n  "name": "@fixture/app"\n}\n',
          })
        );
        expect(rows(changeSet)).toEqual([
          ["packages/app/package.json", "unknown", "@fixture/app", "package.json changed without a field change"],
          ["packages/new/package.json", "unknown", "@fixture/root", "package.json added"],
          ["packages/old/package.json", "unknown", "@fixture/root", "package.json deleted"],
        ]);
      })
    );
  });

  describe("commit range", () => {
    it.effect("an empty-tree head that adds commits yields exactly one commits atom", () =>
      Effect.gen(function* () {
        const changeSet = yield* classifyChangedPaths(diffOf([], 2), memoryReadAt({}));
        expect(rows(changeSet)).toEqual([["<commits>", "commits", "-", "2 commit(s) base..head"]]);
        expect(changeSet.changedPaths).toEqual([]);
        expect(changeSet.atoms[0]?.digest).toBe(yield* sha256("commits\u0000<commits>\u00002 commit(s) base..head"));
      })
    );

    it.effect("a head with no commits and no paths yields no atoms", () =>
      Effect.gen(function* () {
        const changeSet = yield* classifyChangedPaths(diffOf([]), memoryReadAt({}));
        expect(changeSet.atoms).toEqual([]);
      })
    );

    it.effect("a normal edit yields its path atoms followed by one commits atom", () =>
      Effect.gen(function* () {
        const changeSet = yield* classifyChangedPaths(
          diffOf([["docs/runbooks/ci.md", "M"]], 1),
          memoryReadAt({ "base:package.json": ROOT_MANIFEST, "head:package.json": ROOT_MANIFEST })
        );
        expect(rows(changeSet)).toEqual([
          ["docs/runbooks/ci.md", "docs:markdown", "@fixture/root", "-"],
          ["<commits>", "commits", "-", "1 commit(s) base..head"],
        ]);
      })
    );
  });

  describe("path rules", () => {
    it.effect("a docs markdown edit is docs:markdown and a goals markdown edit is a packet", () =>
      Effect.gen(function* () {
        const changeSet = yield* classifyChangedPaths(
          diffOf([
            ["goals/verification-route/SPEC.md", "M"],
            ["docs/runbooks/ci.md", "M"],
          ]),
          memoryReadAt({ "base:package.json": ROOT_MANIFEST, "head:package.json": ROOT_MANIFEST })
        );
        expect(rows(changeSet)).toEqual([
          ["docs/runbooks/ci.md", "docs:markdown", "@fixture/root", "-"],
          ["goals/verification-route/SPEC.md", "packet", "@fixture/root", "-"],
        ]);
      })
    );

    it("places each path family by the first matching rule", () => {
      const table: ReadonlyArray<readonly [string, O.Option<string>, ChangeAtomKind]> = [
        ["bun.lock", O.some(""), "lockfile"],
        ["infra/lambda/turbo-cache/bun.lock", O.some("infra"), "unknown"],
        [".bun-version", O.some(""), "toolchain-pin"],
        ["mise.toml", O.some(""), "toolchain-pin"],
        ["packages/x/test/fixtures/epoch/.nvmrc", O.some("packages/x"), "src:test"],
        [".env.example", O.some(""), "env"],
        ["apps/web/.env", O.some("apps/web"), "env"],
        [".envrc", O.some(""), "unknown"],
        [".github/workflows/check.yml", O.some(""), "cfg:workflow"],
        ["packages/x/turbo.json", O.some("packages/x"), "cfg:turbo"],
        ["packages/x/tsconfig.check.json", O.some("packages/x"), "cfg:tsconfig"],
        ["biome.jsonc", O.some(""), "cfg:biome"],
        [".oxlintrc.docs.json", O.some(""), "cfg:biome"],
        [
          "packages/tooling/policy-pack/lint-rules/src/rule.ts",
          O.some("packages/tooling/policy-pack/lint-rules"),
          "cfg:lint-rules",
        ],
        ["packages/x/vitest.config.ts", O.some("packages/x"), "cfg:vitest"],
        ["apps/web/vite.config.ts", O.some("apps/web"), "cfg:vitest"],
        ["vitest.aliases.generated.json", O.some(""), "cfg:vitest"],
        ["docs/generated/api.md", O.some(""), "src:generated"],
        ["graft/manifest.json", O.some(""), "src:generated"],
        ["packages/x/src/Registry.generated.ts", O.some("packages/x"), "src:generated"],
        ["packages/ui/src/Button.stories.tsx", O.some("packages/ui"), "src:story"],
        ["packages/x/test/Thing.test.ts", O.some("packages/x"), "src:test"],
        ["packages/x/src/Thing.spec.ts", O.some("packages/x"), "src:test"],
        ["packages/x/test/fixtures/notes.md", O.some("packages/x"), "src:test"],
        ["explorations/route/README.md", O.some(""), "packet"],
        ["research/2026-10-28/brief.md", O.some(""), "packet"],
        ["docs/_internal/notes.mdx", O.some(""), "packet"],
        ["packages/x/README.md", O.some("packages/x"), "docs:markdown"],
        ["packages/x/src/index.ts", O.some("packages/x"), "src:module"],
        ["packages/x/src/data.json", O.some("packages/x"), "src:module"],
        ["packages/x/scripts/build.ts", O.some("packages/x"), "unknown"],
        ["packages/x/src/index.ts", O.none(), "unknown"],
        ["docs/images/Logo.PNG", O.some(""), "asset"],
        ["packages/x/package.json", O.some("packages/x"), "unknown"],
        ["LICENSE", O.some(""), "unknown"],
      ];
      expect(A.map(table, ([path, owner]) => [path, pathAtomKind(path, owner)])).toEqual(
        A.map(table, ([path, , kind]) => [path, kind])
      );
    });

    it("parses NUL-delimited name-status output and splits renames", () => {
      const render = flowEntries;
      assertSome(render(""), []);
      assertSome(render("M\0bun.lock\0A\0docs/a b.md\0"), ["M bun.lock", "A docs/a b.md"]);
      assertSome(render("R087\0old.md\0new.md\0"), ["D old.md", "A new.md"]);
      assertSome(render("C075\0src.md\0copy.md\0"), ["A copy.md"]);
      assertNone(render("M\0bun.lock"));
      assertNone(render("Q\0bun.lock\0"));
      assertNone(render("M\0"));
      assertNone(render("M\0\0"));
    });
  });

  describe("git-backed layer", () => {
    it.effect("classifies a real two-commit range end to end", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "ci-route-classify-" });
        const git = Effect.fn("routeClassifyTest.git")(function* (...args: ReadonlyArray<string>) {
          const result = yield* runRepoCommandCapture("git", [...GIT_IDENTITY, ...args], root, GIT_ENV);
          expect(result.exitCode).toBe(0);
          return Str.trim(result.output);
        });
        const write = Effect.fn("routeClassifyTest.write")(function* (file: string, content: string) {
          const target = path.join(root, file);
          yield* fs.makeDirectory(path.dirname(target), { recursive: true });
          yield* fs.writeFileString(target, content);
        });

        yield* git("init", "--quiet", "--template=", ".");
        yield* write(
          "package.json",
          '{ "name": "@fixture/root", "workspaces": ["packages/*"], "catalog": { "effect": "4.0.5" } }\n'
        );
        yield* write("packages/app/package.json", '{ "name": "@fixture/app", "scripts": { "build": "tsc -b" } }\n');
        yield* write("packages/app/src/index.ts", "export const value = 1;\n");
        yield* write("packages/app/src/old.ts", "export const old = 1;\n");
        yield* write("docs/guide.md", "# Guide\n");
        yield* git("add", "--all");
        yield* git("commit", "--quiet", "--no-verify", "-m", "base");
        const base = yield* git("rev-parse", "HEAD");

        yield* write(
          "package.json",
          '{ "name": "@fixture/root", "workspaces": ["packages/*"], "catalog": { "effect": "4.0.6" } }\n'
        );
        yield* write(
          "packages/app/package.json",
          '{ "name": "@fixture/app", "scripts": { "build": "tsc -b --force" } }\n'
        );
        yield* write("packages/app/src/index.ts", "export const value = 2;\n");
        yield* fs.remove(path.join(root, "packages/app/src/old.ts"));
        yield* write("docs/guide.md", "# Guide\n\nMore.\n");
        yield* write("goals/route/SPEC.md", "# Spec\n");
        yield* write("bun.lock", "{}\n");
        yield* write("assets/logo.png", "png");
        yield* git("add", "--all");
        yield* git("commit", "--quiet", "--no-verify", "-m", "head");
        const head = yield* git("rev-parse", "HEAD");

        const classifier = yield* ChangeClassifier;
        const changeSet = yield* classifier.classify(ClassifyInput.make({ repoRoot: root, base, head: "HEAD" }));
        expect(changeSet.base).toBe(base);
        expect(changeSet.head).toBe(head);
        expect(rows(changeSet)).toEqual([
          ["assets/logo.png", "asset", "@fixture/root", "-"],
          ["bun.lock", "lockfile", "@fixture/root", "-"],
          ["docs/guide.md", "docs:markdown", "@fixture/root", "-"],
          ["goals/route/SPEC.md", "packet", "@fixture/root", "-"],
          ["package.json", "pkg:catalog", "@fixture/root", "catalog effect 4.0.5 -> 4.0.6"],
          ["packages/app/package.json", "pkg:script", "@fixture/app", "scripts build changed"],
          ["packages/app/src/index.ts", "src:module", "@fixture/app", "-"],
          ["packages/app/src/old.ts", "src:module", "@fixture/app", "-"],
          ["<commits>", "commits", "-", `1 commit(s) ${short(base)}..${short(head)}`],
        ]);

        const unchanged = yield* classifier.classify(ClassifyInput.make({ repoRoot: root, base: head, head: "HEAD" }));
        expect(unchanged.atoms).toEqual([]);

        // A head whose tree equals its base still adds commits (PR #1399's merge-of-main heads).
        yield* git("commit", "--quiet", "--no-verify", "--allow-empty", "-m", "empty one");
        yield* git("commit", "--quiet", "--no-verify", "--allow-empty", "-m", "empty two");
        const emptyHead = yield* git("rev-parse", "HEAD");
        const emptyTree = yield* classifier.classify(ClassifyInput.make({ repoRoot: root, base: head, head: "HEAD" }));
        expect(emptyTree.changedPaths).toEqual([]);
        expect(rows(emptyTree)).toEqual([
          ["<commits>", "commits", "-", `2 commit(s) ${short(head)}..${short(emptyHead)}`],
        ]);

        const failure = yield* classifier
          .classify(ClassifyInput.make({ repoRoot: root, base: "no-such-ref", head: "HEAD" }))
          .pipe(Effect.flip);
        expect(failure.reason).toBe("git");
      })
    );
  });
});

function flowEntries(output: string): O.Option<ReadonlyArray<string>> {
  return O.map(
    changedPathEntriesFromNameStatus(output),
    A.map((entry) => `${entry.status} ${entry.path}`)
  );
}
