import {
  codeStringLiterals,
  moduleRootFileReads,
  moduleSyntax,
  POLICY_ROOT_FILE_ROUTES,
  POLICY_SHARED_ROOT_FILES,
  resolvePackageSubpath,
} from "@beep/repo-cli/test/Lint";
import { computePolicyFingerprint } from "@beep/repo-cli/test/PackageScripts";
import { FsUtilsLive } from "@beep/repo-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { identity } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fixturePackageFiles, policyCliFixtureFiles, writeFixtureFiles } from "./support/PolicyCliFixture.ts";

const UnknownJson = S.fromJsonString(S.Unknown);

const platform = FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer));

const rootManifest = (scripts: Readonly<Record<string, string>>) =>
  `${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)({ name: "fixture", workspaces: ["packages/*"], scripts }), identity)}\n`;

const turbo = (tasks: ReadonlyArray<string>) =>
  `${Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({
      tasks: {
        "//#lint:policy-fingerprint": { cache: true, outputs: [], inputs: [] },
        ...R.fromEntries(A.map(tasks, (task) => [task, { dependsOn: ["//#lint:policy-fingerprint"] }] as const)),
      },
    }),
    identity
  )}\n`;

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
    assertSome(O.getOrThrow(A.get(syntax.edges, 0)).bindings, ["lawsCommand"]);
    expect(syntax.opaqueDynamicImport).toBe(false);
    const lint = O.getOrThrow(HashMap.get(syntax.commands, "lintCommand"));
    assertSome(lint.name, "lint");
    expect(A.map(lint.subcommands, O.getOrUndefined)).toEqual(["lawsCommand", undefined]);
    expect(moduleSyntax("a.ts", "const load = (name: string) => import(name);").opaqueDynamicImport).toBe(true);
  });

  it("marks root-file readers by code literals, never by comments or help text", () => {
    const source = A.join(
      [
        "/** Reads `turbo.json` and runs `biome`. */",
        "// biome.jsonc, _typos.toml",
        'export const config = ".oxlintrc.docs.json";',
        'export const argv = ["oxlint", "--quiet"];',
        "export const typos = `${root}/_typos.toml`;",
        'export const route = { name: "fallow", description: "Edits turbo.json and biome.jsonc" };',
        'export const command = Command.make("x").pipe(Command.withDescription("Reads lint-policy.sweeps.jsonc"));',
      ],
      "\n"
    );
    expect(codeStringLiterals("a.ts", source)).not.toContain("Edits turbo.json and biome.jsonc");
    // `.oxlintrc.docs.json` and the bare `oxlint` both mark the Oxlint family (with the `tsdoc.json`
    // its plugins read); the template marks typos; the dispatch `name` marks Fallow. Nothing marks
    // `turbo.json`, `biome.jsonc` or the sweeps file: only comments and help text name them.
    expect(moduleRootFileReads("a.ts", source)).toEqual([
      ".fallowrc.jsonc",
      ".oxlintrc.circular.json",
      ".oxlintrc.deprecated-apis.jsonc",
      ".oxlintrc.docs.json",
      ".oxlintrc.json",
      "_typos.toml",
      "fallow-plugin-manual-development-tools.json",
      "tsdoc.json",
    ]);
    expect(moduleRootFileReads("b.ts", 'const file = path.join(root, "turbo.json");')).toEqual(["turbo.json"]);
    expect(moduleRootFileReads("c.ts", 'const tool = "@biomejs/biome";')).toEqual(["biome.jsonc"]);
    // TSX sources parse as TSX, and a quoted `"description"` key is help text like a bare one.
    expect(moduleRootFileReads("d.tsx", 'export const View = () => <div title="turbo.json" />;')).toEqual([
      "turbo.json",
    ]);
    expect(moduleRootFileReads("e.ts", 'export const route = { "description": "Reads turbo.json" };')).toEqual([]);
    // A file that routes nowhere is never a shared default: each family has a reader marker.
    for (const route of POLICY_ROOT_FILE_ROUTES) {
      expect(A.isReadonlyArrayNonEmpty([...route.names, ...route.tools]), A.join(route.files, ",")).toBe(true);
      expect(A.intersection(route.files, POLICY_SHARED_ROOT_FILES)).toEqual([]);
    }
  });

  it("resolves exports subpaths with wildcards and runtime conditions", () => {
    assertSome(resolvePackageSubpath({ ".": "./src/index.ts" }, "."), "./src/index.ts");
    assertSome(resolvePackageSubpath({ "./*": "./src/*.ts" }, "./A/B"), "./src/A/B.ts");
    assertSome(
      resolvePackageSubpath({ "./*": "./src/*.ts", "./internal/*": "./src/internal/*.ts" }, "./internal/x"),
      "./src/internal/x.ts"
    );
    assertSome(resolvePackageSubpath({ ".": { types: "./a.d.ts", import: "./src/a.ts" } }, "."), "./src/a.ts");
    assertNone(resolvePackageSubpath({ "./hidden": null }, "./hidden"));
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
        const computePolicyFingerprint1 = yield* computePolicyFingerprint(root);
        expect(computePolicyFingerprint1).toEqual(first);
        // A new import edge does.
        yield* fs.writeFileString(`${root}/packages/nested/src/index.ts`, 'export { value } from "@beep/unrelated";\n');
        const expanded = yield* computePolicyFingerprint(root);
        expect(entry(expanded, "lint-laws").inputs).toContain("packages/unrelated/src/index.ts");
      })
    );

    it.effect(
      "routes each root file to the seals whose command closure reads it",
      Effect.fnUntraced(function* () {
        const root = yield* fixture({
          ...policyCliFixtureFiles([
            {
              group: "lint",
              leaves: [
                { name: "laws", imports: ["@beep/oxlint-reader"] },
                { name: "jsdoc", imports: [] },
              ],
            },
            { group: "topo-sort", imports: ["@beep/turbo-reader"] },
          ]),
          ...fixturePackageFiles("oxlint-reader"),
          "packages/oxlint-reader/src/index.ts": 'export const value = ["oxlint", "--quiet"];\n',
          ...fixturePackageFiles("turbo-reader"),
          "packages/turbo-reader/src/index.ts": "export const value = (root: string) => `${root}/turbo.json`;\n",
          "package.json": rootManifest({
            "lint:laws:root": "beep-cli lint laws --check",
            "jsdoc:root": "beep-cli lint jsdoc --root-only",
            "topo-sort": "beep-cli topo-sort",
          }),
          "turbo.json": turbo(["//#lint:laws:root", "//#jsdoc:root", "//#topo-sort"]),
        });
        const fingerprint = yield* computePolicyFingerprint(root);
        // The shell reads no checker configuration: the shared seal holds only what Bun loads.
        expect(A.filter(fingerprint.shared, (input) => !Str.startsWith("packages/")(input))).toEqual([
          ...POLICY_SHARED_ROOT_FILES,
        ]);
        const laws = entry(fingerprint, "lint-laws").inputs;
        expect(laws).toEqual(expect.arrayContaining([".oxlintrc.json", ".oxlintrc.docs.json", "tsdoc.json"]));
        expect(laws).not.toContain("turbo.json");
        expect(laws).not.toContain("biome.jsonc");
        expect(entry(fingerprint, "lint-jsdoc").inputs).not.toContain(".oxlintrc.json");
        expect(entry(fingerprint, "topo-sort").inputs).toContain("turbo.json");
        expect(entry(fingerprint, "topo-sort").inputs).not.toContain(".oxlintrc.json");
        // The drift check reads the declaration and every routed file a seal declares.
        expect(fingerprint.check).toEqual(
          expect.arrayContaining([".oxlintrc.json", "turbo.json", "standards/policy-tools.fingerprint.json"])
        );
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
      "fails on an unresolvable relative import in the shell instead of dropping the module",
      Effect.fnUntraced(function* () {
        const files = policyCliFixtureFiles([{ group: "topo-sort", imports: [] }]);
        const root = yield* fixture({
          ...files,
          "packages/cli/src/bin-main.ts": `import "./internal/Missing.ts";\n${files["packages/cli/src/bin-main.ts"] ?? ""}`,
          "package.json": rootManifest({ "topo-sort": "beep-cli topo-sort" }),
          "turbo.json": turbo(["//#topo-sort"]),
        });
        const failure = yield* computePolicyFingerprint(root).pipe(Effect.flip);
        expect(failure.message).toBe("Cannot resolve ./internal/Missing.ts imported by packages/cli/src/bin-main.ts");
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
