import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import type { PlatformError } from "effect/PlatformError";
import * as ChildProcess from "effect/process/ChildProcess";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { thunkTrue } from "@beep/utils"

// Phase 7: `bun run check` must run the Effect build of the compiler, at the monorepo's pins, over
// every project, with the monorepo's own rule map. Modelled on the monorepo's
// EffectTsgoEffectFnPolicy test: compare the compiler identity with the pins, and prove that an
// Effect-only finding fails the check.

const Manifest = S.Struct({
  version: S.OptionFromOptionalKey(S.String),
  scripts: S.OptionFromOptionalKey(S.Record(S.String, S.String)),
  catalog: S.OptionFromOptionalKey(S.Record(S.String, S.String)),
  workspaces: S.String.pipe(S.Array, S.OptionFromOptionalKey),
});
const decodeManifest = S.decodeEffect(S.fromJsonString(Manifest));

/**
 * The compiler canary: an Effect built and never run. Plain TypeScript accepts it; the Effect build
 * reports `floatingEffect`, at error severity in the monorepo's rule map.
 */
const canarySource = 'import * as Effect from "effect/Effect";\n\nEffect.log("built, never run");\n';

/** The canary's project, four folders below the prototype root (`shared/tooling/tmp/canary-*`). */
const canaryTsconfig = '{ "extends": "../../../../tsconfig.base.json", "include": [], "files": ["Canary.ts"] }\n';

/** Where the prototype and the monorepo sit, and how to read a manifest. */
const layout = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const prototype = yield* path.fromFileUrl(new URL("../../../", import.meta.url));
  const monorepo = path.resolve(prototype, "../..");
  const manifest = Effect.fn("manifest")(function* (file: string) {
    const text = yield* fs.readFileString(file);
    return yield* decodeManifest(text);
  });
  return { fs, path, prototype, monorepo, manifest };
});

/** Run the Effect build of tsrs from the prototype root: its exit code and everything it printed. */
const effectTsrs = Effect.fn("effectTsrs")(function* (prototype: string, args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner;
  const handle = yield* spawner.spawn(ChildProcess.make("node_modules/.bin/effect-tsgo", ["tsrs", ...args], { cwd: prototype }));
  const output = yield* handle.all.pipe(Stream.decodeText(), Stream.mkString);
  const exit = yield* handle.exitCode;
  return { exit: Number(exit), output };
});

/** JSON with comments and trailing commas, as tsconfig files are written, made plain JSON. */
const stripJsonc = (text: string): string => {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inString) {
      out += c;
      if (c === "\\") out += text[++i] ?? "";
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
      out += c;
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && text[i + 1] === "*") {
      const from = i + 2;
      i = O.match(pipe(text, Str.slice(from), Str.indexOf("*/")), { onNone: () => text.length, onSome: (at) => from + at + 1 });
    } else out += c;
  }
  return pipe(out, Str.replace(/,(\s*[}\]])/g, "$1"));
};

/** A tsconfig's link in an `extends` chain. */
const Tsconfig = S.Struct({
  extends: S.OptionFromOptionalKey(S.String),
  compilerOptions: S.OptionFromOptionalKey(S.Record(S.String, S.Unknown)),
});
const decodeTsconfig = S.decodeEffect(S.fromJsonString(Tsconfig));
interface Link {
  readonly file: string;
  readonly plugins: boolean;
}

it.layer(NodeServices.layer)((it) => {
  it.effect("every segment of `bun run check` runs the Effect build of tsrs, over every project", () =>
    Effect.gen(function* () {
      const { fs, path, prototype, manifest } = yield* layout;
      const root = yield* manifest(path.join(prototype, "package.json"));
      const check = O.getOrThrow(O.flatMap(root.scripts, (scripts) => O.fromNullishOr(scripts["check"])));
      const segments = pipe(check, Str.split(" && "));
      const projects = A.map(segments, (segment) => {
        const match = /^effect-tsgo tsrs -p (\S+)$/.exec(segment);
        expect(match, `not the Effect build: ${segment}`).not.toBeNull();
        return match?.[1] ?? "";
      });
      // Every workspace package with a tsconfig is checked, and so are the scripts.
      const workspaces = O.getOrElse(root.workspaces, A.empty);
      const withConfig = yield* Effect.filter(workspaces, (dir) => fs.exists(path.join(prototype, dir, "tsconfig.json")));
      expect(A.difference([...withConfig, "scripts"], projects)).toEqual([]);
    }),
  );

  it.effect(
    "every TypeScript file in the prototype belongs to a checked project",
    () =>
      Effect.gen(function* () {
        const { fs, path, prototype, manifest } = yield* layout;
        const root = yield* manifest(path.join(prototype, "package.json"));
        const check = O.getOrThrow(O.flatMap(root.scripts, (scripts) => O.fromNullishOr(scripts["check"])));
        const projects = A.getSomes(
          A.map(pipe(check, Str.split(" && ")), (segment) =>
            O.fromNullishOr(/^effect-tsgo tsrs -p (\S+)$/.exec(segment)?.[1]),
          ),
        );
        // What each checked project compiles, as paths from the prototype root.
        const listed = yield* Effect.forEach(
          projects,
          (project) => effectTsrs(prototype, ["-p", project, "--listFilesOnly"]),
          { concurrency: 1 },
        );
        const covered = HashSet.fromIterable(
          A.flatMap(listed, ({ output }) =>
            A.filter(
              A.map(pipe(output, Str.split("\n")), (file) => path.relative(prototype, Str.trim(file))),
              (file) => !Str.startsWith("..")(file),
            ),
          ),
        );
        // Every source file on disk, leaving out what is installed, generated for a run, or built.
        const skipped = ["node_modules", "tmp", "dist", ".alchemy", "coverage"];
        const names = yield* fs.readDirectory(prototype);
        const roots = A.filter(names, (name) => !A.contains(skipped, name));
        const walked = yield* Effect.forEach(
          roots,
          (name) =>
            Effect.map(
              Effect.orElseSucceed(fs.readDirectory(path.join(prototype, name), { recursive: true }), A.empty),
              (nested) => A.map(nested, (file) => path.join(name, file)),
            ),
          { concurrency: 1 },
        );
        const sources = A.filter([...roots, ...A.flatten(walked)], (file) => {
          const segments = pipe(file, Str.split(path.sep));
          return /\.tsx?$/.test(file) && !A.some(segments, (segment) => A.contains(skipped, segment));
        });
        expect(sources.length).toBeGreaterThan(0);
        expect(A.filter(sources, (file) => !HashSet.has(covered, file))).toEqual([]);
      }),
    60_000,
  );

  it.effect("the compiler is the Effect build of tsrs at the monorepo's pins", () =>
    Effect.gen(function* () {
      const { path, prototype, monorepo, manifest } = yield* layout;
      const pins = O.getOrThrow((yield* manifest(path.join(monorepo, "package.json"))).catalog);
      const tsgoPin = pins["@effect/tsgo"];
      const tsrsPin = pins["tsrs"];
      expect(tsgoPin).toBeDefined();
      expect(tsrsPin).toBeDefined();
      // The prototype installs exactly those versions.
      const installedTsgo = yield* manifest(path.join(prototype, "node_modules/@effect/tsgo/package.json"));
      const installedTsrs = yield* manifest(path.join(prototype, "node_modules/tsrs/package.json"));
      expect(O.getOrNull(installedTsgo.version)).toBe(tsgoPin);
      expect(O.getOrNull(installedTsrs.version)).toBe(tsrsPin);
      // And the command the check runs is their Effect build, not the stock compiler.
      const { exit, output } = yield* effectTsrs(prototype, ["--version"]);
      expect(exit).toBe(0);
      expect(output).toContain(`+effect-tsgo.${tsgoPin} (tsrs ${tsrsPin}`);
    }),
  );

  it.effect("the canary: an Effect-only finding fails the check, with no unknown-rule warning", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const { fs, path, prototype } = yield* layout;
        // The canary is written for the length of this test, into a git-ignored folder, so no file
        // with a deliberate finding sits in the tree for an editor to report.
        const parent = path.join(prototype, "shared/tooling/tmp");
        yield* fs.makeDirectory(parent, { recursive: true });
        const dir = yield* fs.makeTempDirectoryScoped({ directory: parent, prefix: "canary-" });
        yield* fs.writeFileString(path.join(dir, "Canary.ts"), canarySource);
        yield* fs.writeFileString(path.join(dir, "tsconfig.json"), canaryTsconfig);
        const { exit, output } = yield* effectTsrs(prototype, ["-p", path.relative(prototype, dir), "--pretty", "false"]);
        expect(exit).not.toBe(0);
        const diagnostics = A.filter(pipe(output, Str.split("\n")), Str.includes(": error TS"));
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]).toContain("effect(floatingEffect)");
        expect(output).not.toContain("TS377134");
      }),
    ),
  );

  it.effect("one inline diagnostics directive in the whole prototype: the generated front's deploy-time entry point", () =>
    Effect.gen(function* () {
      const { fs, path, prototype, manifest } = yield* layout;
      const root = yield* manifest(path.join(prototype, "package.json"));
      const dirs = [...O.getOrElse(root.workspaces, A.empty<string>), "scripts", "proofs"];
      const listed = yield* Effect.forEach(dirs, (dir) =>
        Effect.map(fs.readDirectory(path.join(prototype, dir), { recursive: true }), (names) =>
          A.map(
            A.filter(names, (name) => !pipe(name, Str.includes("node_modules")) && /\.tsx?$/.test(name)),
            (name) => path.join(dir, name),
          ),
        ),
        { concurrency: 1 },
      );
      const sources = yield* Effect.forEach(A.flatten(listed), (file) =>
        Effect.map(fs.readFileString(path.join(prototype, file)), (text) => ({ file, text })),
        { concurrency: 1 },
      );
      // A directive is a comment line naming the Effect diagnostics; a string that contains the
      // words (the generator's template, this test) is not one.
      const directive = /^\s*(?:\/\/|\/\*|\*).*@effect-diagnostics/m;
      const withDirective = A.filter(sources, ({ text }) => directive.test(text));
      expect(A.map(withDirective, ({ file }) => file)).toEqual(["apps/practice/generated/Practice.front.ts"]);
      const front = A.findFirst(withDirective, thunkTrue);
      const lines = O.match(front, {
        onNone: A.empty<string>,
        onSome: ({ text }) => A.filter(pipe(text, Str.split("\n")), (line) => directive.test(line)),
      });
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain("strictEffectProvide:off -- ");
      expect(lines[0]).toContain(" Owner: @proto/practice. Exit: ");
    }),
  );

  it.effect("every checked project takes its rules from the monorepo's base config, and none overrides them", () =>
    Effect.gen(function* () {
      const { fs, path, prototype, monorepo, manifest } = yield* layout;
      const root = yield* manifest(path.join(prototype, "package.json"));
      const check = O.getOrThrow(O.flatMap(root.scripts, (scripts) => O.fromNullishOr(scripts["check"])));
      const projects = A.map(pipe(check, Str.split(" && ")), (segment) => pipe(segment, Str.split(" "), A.lastNonEmpty));
      const base = path.join(monorepo, "tsconfig.base.json");
      const chainOf = (file: string): Effect.Effect<ReadonlyArray<Link>, PlatformError | S.SchemaError> =>
        Effect.gen(function* () {
          const text = yield* fs.readFileString(file);
          const config = yield* decodeTsconfig(stripJsonc(text));
          const plugins = O.exists(config.compilerOptions, (options) => "plugins" in options);
          const here = { file, plugins };
          return yield* O.match(config.extends, {
            onNone: () => Effect.succeed([here]),
            onSome: (next) => Effect.map(chainOf(path.resolve(path.dirname(file), next)), (rest) => [here, ...rest]),
          });
        });
      for (const project of projects) {
        const chain = yield* chainOf(path.join(prototype, project, "tsconfig.json"));
        // The chain ends at the monorepo's base, which holds the plugin block.
        expect(A.map(chain, (link) => link.file)).toContain(base);
        const overriding = A.filter(chain, (link) => link.plugins && link.file !== base);
        expect(A.map(overriding, (link) => path.relative(prototype, link.file))).toEqual([]);
      }
    }),
  );
});
