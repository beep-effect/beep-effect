import { PolicyToolsFingerprintPolicy } from "@beep/repo-cli/test/PackageScripts";
import { A, O, Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as R from "effect/Record";

/** One command group of a fixture CLI: `beep <group> [<leaf>]` and the specifiers its module imports. */
export interface FixtureCommand {
  readonly group: string;
  readonly imports?: ReadonlyArray<string>;
  readonly leaves?: ReadonlyArray<{ readonly name: string; readonly imports: ReadonlyArray<string> }>;
}

const pascal = (name: string) =>
  A.join(
    A.map(Str.split(name, "-"), (part) => `${Str.toUpperCase(Str.slice(0, 1)(part))}${Str.slice(1)(part)}`),
    ""
  );
const camel = (name: string) => {
  const value = pascal(name);
  return `${Str.toLowerCase(Str.slice(0, 1)(value))}${Str.slice(1)(value)}`;
};

const importLines = (specifiers: ReadonlyArray<string>) =>
  A.join(
    A.map(specifiers, (specifier, index) => `import { value as v${index} } from "${specifier}";`),
    "\n"
  );
const usage = (specifiers: ReadonlyArray<string>) =>
  A.join(
    A.map(specifiers, (_specifier, index) => `v${index}`),
    ", "
  );

/**
 * The source files of a minimal statically walkable CLI workspace at
 * `packages/cli`: `bin.ts` loads `bin-main.js` by URL, `bin-main.ts` loads
 * `commands/Root.ts` lazily, and each group or leaf command lives in its own
 * module with the given imports.
 */
export const policyCliFixtureFiles = (commands: ReadonlyArray<FixtureCommand>): Record<string, string> => {
  const files: Record<string, string> = {
    "packages/cli/package.json": '{ "name": "@beep/repo-cli" }\n',
    "packages/cli/src/bin.ts": 'await import(new URL("./bin-main.js", import.meta.url).href);\n',
    "packages/cli/src/bin-main.ts":
      'const { rootCommand } = await import("./commands/Root.ts");\nconsole.log(rootCommand);\n',
    "packages/cli/src/commands/Root.ts": A.join(
      [
        'import * as Command from "effect/cli/Command";',
        ...A.map(
          commands,
          (command) =>
            `import { ${camel(command.group)}Command } from "./${pascal(command.group)}/${pascal(command.group)}.command.ts";`
        ),
        `export const rootCommand = Command.make("beep-cli").pipe(Command.withSubcommands([${A.join(
          A.map(commands, (command) => `${camel(command.group)}Command`),
          ", "
        )}]));`,
        "",
      ],
      "\n"
    ),
  };
  for (const command of commands) {
    const group = pascal(command.group);
    const leaves = command.leaves ?? [];
    const own = command.imports ?? [];
    files[`packages/cli/src/commands/${group}/${group}.command.ts`] = A.join(
      [
        'import * as Command from "effect/cli/Command";',
        importLines(own),
        ...A.map(leaves, (leaf) => `import { ${camel(leaf.name)}Command } from "./${pascal(leaf.name)}.command.ts";`),
        `export const ${camel(command.group)}Command = Command.make("${command.group}", {}, () => [${usage(own)}]).pipe(`,
        `  Command.withSubcommands([${A.join(
          A.map(leaves, (leaf) => `${camel(leaf.name)}Command`),
          ", "
        )}])`,
        ");",
        "",
      ],
      "\n"
    );
    for (const leaf of leaves) {
      files[`packages/cli/src/commands/${group}/${pascal(leaf.name)}.command.ts`] = A.join(
        [
          'import * as Command from "effect/cli/Command";',
          importLines(leaf.imports),
          `export const ${camel(leaf.name)}Command = Command.make("${leaf.name}", {}, () => [${usage(leaf.imports)}]);`,
          "",
        ],
        "\n"
      );
    }
  }
  return files;
};

/** A one-file workspace package `@beep/<name>` at `packages/<name>` exporting `value`. */
export const fixturePackageFiles = (name: string): Record<string, string> => ({
  [`packages/${name}/package.json`]: `${JSON.stringify({ name: `@beep/${name}`, exports: { ".": "./src/index.ts" } })}\n`,
  [`packages/${name}/src/index.ts`]: "export const value = 1;\n",
});

/** Write a fixture file map under a root directory. */
export const writeFixtureFiles = Effect.fnUntraced(function* (root: string, files: Readonly<Record<string, string>>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  for (const [file, content] of R.toEntries(files)) {
    const target = path.join(root, file);
    yield* fs.makeDirectory(path.dirname(target), { recursive: true });
    yield* fs.writeFileString(target, content);
  }
});

const CHECK_TASK = "//#lint:policy-fingerprint";
const isFingerprintEdge = (dependency: string) =>
  dependency === CHECK_TASK || Str.startsWith(`${CHECK_TASK}:`)(dependency);

/**
 * Point every fingerprint edge of copied live task definitions back at the
 * drift-check marker and drop the live seal tasks, so the real writer can
 * generate the fixture's own seals.
 */
export const withFingerprintMarker = (
  tasks: Readonly<Record<string, unknown>>
): Record<string, Readonly<Record<string, unknown>>> =>
  R.fromEntries(
    A.getSomes(
      A.map(R.toEntries(tasks), ([task, value]) => {
        if (Str.startsWith(`${CHECK_TASK}:`)(task) || value === null || typeof value !== "object")
          return O.none<readonly [string, Readonly<Record<string, unknown>>]>();
        const record = value as Readonly<Record<string, unknown>>;
        const dependsOn = record.dependsOn;
        if (!A.isArray(dependsOn)) return O.some([task, record] as const);
        const edges = A.filter(dependsOn, (dependency): dependency is string => typeof dependency === "string");
        const first = A.findFirstIndex(edges, isFingerprintEdge);
        const rewritten = O.match(first, {
          onNone: () => edges,
          onSome: (index) => [
            ...A.filter(A.take(edges, index), (dependency) => !isFingerprintEdge(dependency)),
            CHECK_TASK,
            ...A.filter(A.drop(edges, index), (dependency) => !isFingerprintEdge(dependency)),
          ],
        });
        return O.some([task, { ...record, dependsOn: rewritten }] as const);
      })
    )
  );

/** Generate a fixture's seal tasks, edges and declaration with the real `--write`. */
export const writeFixtureFingerprint = Effect.fnUntraced(function* (root: string) {
  const policy = yield* PolicyToolsFingerprintPolicy.make(root);
  yield* policy.write;
});
