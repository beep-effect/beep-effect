import { moduleSyntax, resolvePackageSubpath } from "@beep/repo-cli/test/Lint";
import { computePolicyFingerprint } from "@beep/repo-cli/test/PackageScripts";
import { FsUtilsLive } from "@beep/repo-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { fixturePackageFiles, policyCliFixtureFiles, writeFixtureFiles } from "./support/PolicyCliFixture.ts";

const platform = FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer));

const rootManifest = (scripts: Readonly<Record<string, string>>) =>
  `${JSON.stringify({ name: "fixture", workspaces: ["packages/*"], scripts })}\n`;

const turbo = (tasks: ReadonlyArray<string>) =>
  `${JSON.stringify({
    tasks: {
      "//#lint:policy-fingerprint": { cache: true, outputs: [], inputs: [] },
      ...R.fromEntries(A.map(tasks, (task) => [task, { dependsOn: ["//#lint:policy-fingerprint"] }] as const)),
    },
  })}\n`;

const fixture = Effect.fnUntraced(function* (files: Readonly<Record<string, string>>) {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "policy-fingerprint-closure-" });
  yield* writeFixtureFiles(root, files);
  return root;
});

const entry = (fingerprint: Effect.Success<ReturnType<typeof computePolicyFingerprint>>, key: string) =>
  O.getOrThrow(A.findFirst(fingerprint.entries, (candidate) => candidate.key === key));

describe("policy fingerprint import graph", () => {
  it("reads runtime edges, bindings and command definitions from source text", () => {
    const syntax = moduleSyntax(
      "packages/cli/src/commands/Lint/Lint.command.ts",
      A.join(
        [
          'import type { T } from "./types.ts";',
          'import { type U, lawsCommand } from "./Laws.command.ts";',
          'import * as Command from "effect/cli/Command";',
          'export type { V } from "./v.ts";',
          'export * from "./barrel.ts";',
          "const subcommands = [lawsCommand, makeCommand()];",
          'export const lintCommand = Command.make("lint").pipe(Command.withSubcommands(subcommands));',
          'const lazy = () => import("./Lazy.ts");',
        ],
        "\n"
      )
    );
    expect(A.map(syntax.edges, (edge) => edge.specifier)).toEqual([
      "./Laws.command.ts",
      "effect/cli/Command",
      "./barrel.ts",
      "./Lazy.ts",
    ]);
    expect(syntax.edges[0]?.bindings).toEqual(O.some(["lawsCommand"]));
    expect(syntax.opaqueDynamicImport).toBe(false);
    const lint = O.getOrThrow(HashMap.get(syntax.commands, "lintCommand"));
    expect(lint.name).toEqual(O.some("lint"));
    expect(lint.subcommands).toEqual([O.some("lawsCommand"), O.none()]);
    expect(moduleSyntax("a.ts", "const load = (name: string) => import(name);").opaqueDynamicImport).toBe(true);
  });

  it("resolves exports subpaths with wildcards and runtime conditions", () => {
    expect(resolvePackageSubpath({ ".": "./src/index.ts" }, ".")).toEqual(O.some("./src/index.ts"));
    expect(resolvePackageSubpath({ "./*": "./src/*.ts" }, "./A/B")).toEqual(O.some("./src/A/B.ts"));
    expect(
      resolvePackageSubpath({ "./*": "./src/*.ts", "./internal/*": "./src/internal/*.ts" }, "./internal/x")
    ).toEqual(O.some("./src/internal/x.ts"));
    expect(resolvePackageSubpath({ ".": { types: "./a.d.ts", import: "./src/a.ts" } }, ".")).toEqual(
      O.some("./src/a.ts")
    );
    expect(resolvePackageSubpath({ "./hidden": null }, "./hidden")).toEqual(O.none());
  });
});

describe("policy fingerprint closures", () => {
  it.layer(platform, { timeout: "30 seconds" })((it) => {
    it.effect(
      "follows imports, not manifest dependencies, and splits seals along the command path",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fixture({
          ...policyCliFixtureFiles([
            {
              group: "lint",
              imports: ["@beep/group"],
              leaves: [
                { name: "laws", imports: ["@beep/helper"] },
                { name: "jsdoc", imports: [] },
              ],
            },
          ]),
          ...fixturePackageFiles("group"),
          ...fixturePackageFiles("helper"),
          "packages/helper/package.json":
            '{"name":"@beep/helper","exports":{".":"./src/index.ts"},"dependencies":{"@beep/unrelated":"workspace:*"}}\n',
          ...fixturePackageFiles("nested"),
          ...fixturePackageFiles("unrelated"),
          "packages/helper/src/index.ts": 'export { value } from "@beep/nested";\n',
          "packages/helper/src/template.hbs": "{{asset}}\n",
          "package.json": rootManifest({
            "lint:laws:root": "beep-cli lint laws --check",
            "jsdoc:root": "bun run docs",
            docs: "bun run beep lint jsdoc --root-only",
          }),
          "turbo.json": turbo(["//#lint:laws:root", "//#jsdoc:root"]),
        });
        const first = yield* computePolicyFingerprint(root);
        const lint = entry(first, "lint");
        const laws = entry(first, "lint-laws");
        expect(lint.parent).toBe("shared");
        expect(laws.parent).toBe("lint");
        expect(lint.inputs).toContain("packages/group/src/index.ts");
        expect(lint.inputs).not.toContain("packages/cli/src/commands/Lint/Laws.command.ts");
        expect(laws.inputs).toContain("packages/cli/src/commands/Lint/Laws.command.ts");
        expect(laws.inputs).toContain("packages/nested/src/index.ts");
        expect(laws.inputs).toContain("packages/nested/package.json");
        expect(laws.inputs).toContain("packages/helper/src/**/*.hbs");
        // Declared but never imported: not an input.
        expect(laws.inputs).not.toContain("packages/unrelated/package.json");
        // The sibling leaf adds a module of its own; the root script chain resolves through `bun run docs`.
        expect(entry(first, "lint-jsdoc").tasks).toEqual(["//#jsdoc:root"]);
        expect(laws.tasks).toEqual(["//#lint:laws:root"]);
        expect(first.shared).toContain("packages/cli/src/bin-main.ts");
        expect(first.shared).toContain("packages/cli/src/commands/Root.ts");
        expect(first.check).toContain("packages/nested/src/**");
        expect(first.check).not.toContain("packages/unrelated/src/**");
        // Contents and unimported files do not move the declaration.
        yield* fs.writeFileString(`${root}/packages/nested/src/index.ts`, "export const value = 2;\n");
        yield* fs.writeFileString(`${root}/packages/nested/src/new.ts`, "export const fresh = 1;\n");
        expect(yield* computePolicyFingerprint(root)).toEqual(first);
        // A new import edge does.
        yield* fs.writeFileString(`${root}/packages/nested/src/index.ts`, 'export { value } from "@beep/unrelated";\n');
        const expanded = yield* computePolicyFingerprint(root);
        expect(entry(expanded, "lint-laws").inputs).toContain("packages/unrelated/src/index.ts");
      })
    );

    it.effect(
      "widens to the whole source tree of a workspace with a computed dynamic import",
      Effect.fnUntraced(function* () {
        const root = yield* fixture({
          ...policyCliFixtureFiles([{ group: "topo-sort", imports: ["@beep/loader"] }]),
          ...fixturePackageFiles("loader"),
          "packages/loader/src/index.ts": "export const value = (name: string) => import(name);\n",
          "package.json": rootManifest({ "topo-sort": "beep-cli topo-sort" }),
          "turbo.json": turbo(["//#topo-sort"]),
        });
        const fingerprint = yield* computePolicyFingerprint(root);
        expect(entry(fingerprint, "topo-sort").inputs).toContain("packages/loader/src/**");
        expect(entry(fingerprint, "topo-sort").inputs).not.toContain("packages/loader/src/index.ts");
      })
    );

    it.effect(
      "rejects policy scripts it cannot attribute to one beep command",
      Effect.fnUntraced(function* () {
        const files = {
          ...policyCliFixtureFiles([{ group: "lint", leaves: [{ name: "laws", imports: [] }] }]),
          "turbo.json": turbo(["//#policy"]),
        };
        for (const script of ["echo laws", "beep-cli lint laws && echo done", "beep-cli check", "beep-cli ci run"]) {
          const root = yield* fixture({ ...files, "package.json": rootManifest({ policy: script }) });
          const result = yield* computePolicyFingerprint(root).pipe(Effect.flip);
          expect(result.message, script).toMatch(
            /does not run a single beep command|fast path|names no beep subcommand/
          );
        }
        const missing = yield* fixture({ ...files, "package.json": rootManifest({}) });
        expect((yield* computePolicyFingerprint(missing).pipe(Effect.flip)).message).toContain("no manifest defines");
      })
    );
  });
});
