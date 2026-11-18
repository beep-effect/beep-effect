// The checkout prune declaration (goals/prunable-product-leaves, seam 1b): a trimmed checkout or
// downstream fork names what it removed (prune), replaced (owned) and carves back out (keep) in an
// optional standards file. These pin the pathspec schema, git :(glob) matching, the decode of a
// present, absent or invalid file, the path predicates, the live-path findings, and the working-tree
// scan the findings read.

import {
  CHECKOUT_PRUNE_DECLARATION_PATH,
  CheckoutPruneDeclaration,
  CheckoutPruneDeclarationError,
  CheckoutPruneEntry,
  CheckoutPruneFinding,
  CheckoutPruneFindingsError,
  CheckoutPrunePathspec,
  checkoutPruneFindings,
  decodeCheckoutPruneDeclaration,
  emptyCheckoutPruneDeclaration,
  isCheckoutPathDeclaredPruned,
  isCheckoutPathKept,
  isCheckoutPathOwned,
  isCheckoutPathPruneDeclared,
  liveCheckoutPruneFiles,
  loadCheckoutPruneDeclaration,
} from "@beep/repo-cli-kit/CheckoutPrune";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe } from "@effect/vitest";
import { deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const decodeEntryResult = S.decodeUnknownResult(CheckoutPruneEntry);
const decodeDeclarationResult = S.decodeUnknownResult(CheckoutPruneDeclaration);
// Fixture rows are well-formed; a decode failure here is a broken test, so it throws.
const decodeEntry = (input: unknown): CheckoutPruneEntry => Result.getOrThrow(decodeEntryResult(input));
const decodeDeclaration = (input: unknown): CheckoutPruneDeclaration =>
  Result.getOrThrow(decodeDeclarationResult(input));
const isPathspec = S.is(CheckoutPrunePathspec);

const entry = (path: string, packageName?: string): CheckoutPruneEntry =>
  decodeEntry(packageName === undefined ? { path, why: "test" } : { path, why: "test", packageName });

const repository = Effect.fnUntraced(function* (files: Readonly<Record<string, string>>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "beep-checkout-prune-" });
  const root = yield* fs.realPath(temporary);
  for (const [relative, content] of R.toEntries(files)) {
    const file = path.join(root, relative);
    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
    yield* fs.writeFileString(file, content);
  }
  return root;
});

describe("checkout prune pathspecs", () => {
  it("accepts repository-relative git globs and rejects what git would not read the same way", () => {
    for (const accepted of ["renovate.json", "goals/demo", "goals/demo-*", "packages/**/test/*.ts", "**/README.md"]) {
      strictEqual(isPathspec(accepted), true, accepted);
    }
    for (const rejected of [
      "",
      "/goals/demo",
      ":(glob)goals/demo",
      "goals\\demo",
      "goals/demo/",
      "goals//demo",
      "./goals/demo",
      "goals/../demo",
      "goals/de**",
      "**x/README.md",
    ]) {
      strictEqual(isPathspec(rejected), false, rejected);
    }
  });

  // Each row was checked against `git ls-files ':(glob)<pattern>'` over the same paths: a pattern
  // matches what it names literally and everything under it, `*` and `?` stay in one segment, `**`
  // crosses segments (zero included), and wildcards match dot files.
  it("matches paths exactly as git's :(glob) magic does", () => {
    const rows: ReadonlyArray<readonly [string, string, boolean]> = [
      ["renovate.json", "renovate.json", true],
      ["renovate.json", "goals/renovate.json", false],
      ["*.json", "renovate.json", true],
      ["*.json", "packages/drivers/demo/package.json", false],
      ["goals/*", "goals/demo-loop", true],
      ["goals/*", "goals/demo-loop/README.md", false],
      ["goals/**", "goals/demo-loop/README.md", true],
      ["goals/**", "goals/.hidden/README.md", true],
      ["**/README.md", "README.md", true],
      ["**/README.md", "goals/demo-loop/README.md", true],
      ["goals/demo-loop", "goals/demo-loop", true],
      ["goals/demo-loop", "goals/demo-loop/ops/burst/main.tf", true],
      ["goals/demo-loop", "goals/demo-loopy/README.md", false],
      ["goals/demo-*", "goals/demo-loop", true],
      ["goals/demo-*", "goals/demo-loop/README.md", false],
      ["goals/demo-loop/**", "goals/demo-loop", false],
      ["goals/demo-loop/**", "goals/demo-loop/README.md", true],
      ["packages/drivers/demo", "packages/drivers/demo-extra/package.json", false],
      ["packages/drivers/demo*/package.json", "packages/drivers/demo-extra/package.json", true],
      ["goals/[dx]emo-loop/README.md", "goals/demo-loop/README.md", true],
      ["goals/[!d]emo-loop/README.md", "goals/demo-loop/README.md", false],
      ["goals/?emo-loop/README.md", "goals/demo-loop/README.md", true],
      ["docs/**/x.md", "docs/x.md", true],
      ["docs/**/x.md", "docs/legal/deep/x.md", true],
      ["infra/**/*.txt", "infra/cache/tools.txt", true],
    ];
    for (const [pattern, path, expected] of rows) {
      const compiled = entry(pattern);
      strictEqual(compiled.matches(path), expected, `${pattern} ~ ${path}`);
      // The compiled glob is cached; a second answer comes from the cache.
      strictEqual(compiled.matches(path), expected, `${pattern} ~ ${path} (cached)`);
    }
  });

  it("tells a literal pathspec from a glob", () => {
    deepStrictEqual(
      A.map(["docs/demo", "docs/demo/*.md", "goals/**"], (path) => entry(path).isLiteral),
      [true, false, false]
    );
  });

  it("requires an entry that names a workspace package to give a literal directory", () => {
    strictEqual(entry("packages/drivers/demo", "@beep/demo").packageName, "@beep/demo");
    strictEqual(S.is(CheckoutPruneEntry)(entry("packages/drivers/demo-*")), true);
    const decoded = decodeEntryResult({
      path: "packages/drivers/demo-*",
      why: "a glob cannot name one workspace",
      packageName: "@beep/demo",
    });
    strictEqual(Result.isFailure(decoded), true);
  });
});

describe("checkout prune declaration decode", () => {
  it.effect("decodes a comment-free strict-JSON declaration and fills missing lists", () =>
    Effect.gen(function* () {
      const declaration = yield* decodeCheckoutPruneDeclaration(
        '{"version":1,"prune":[{"path":"docs/demo","why":"not shipped"}]}'
      );
      deepStrictEqual(
        A.map(declaration.prune, (row) => row.path),
        ["docs/demo"]
      );
      deepStrictEqual([declaration.keep.length, declaration.owned.length], [0, 0]);
    })
  );

  it.effect("decodes JSONC with comments and trailing commas", () =>
    Effect.gen(function* () {
      const declaration = yield* decodeCheckoutPruneDeclaration(
        '{\n  // this checkout replaces the dependency bot config\n  "version": 1,\n  "owned": [{ "path": "renovate.json", "why": "own bot", },],\n}\n'
      );
      strictEqual(declaration.owned[0]?.path, "renovate.json");
    })
  );

  it.effect("fails, never reads as empty, on a misspelled key, a wrong version, a bad path or broken text", () =>
    Effect.gen(function* () {
      for (const text of [
        '{ "version": 1, "prunes": [] }',
        '{ "version": 1, "prune": [{ "path": "docs/demo", "reason": "a misspelled why" }] }',
        '{ "version": 2 }',
        '{ "prune": [] }',
        '{ "version": 1, "prune": [{ "path": "/docs/demo", "why": "absolute" }] }',
        '{ "version": 1, "prune": [',
        "",
      ]) {
        const error = yield* Effect.flip(decodeCheckoutPruneDeclaration(text));
        strictEqual(error._tag, "CheckoutPruneDeclarationError", text);
        strictEqual(error.path, CHECKOUT_PRUNE_DECLARATION_PATH);
      }
    })
  );

  it("has an empty declaration for a checkout that ships none", () => {
    deepStrictEqual(
      [
        emptyCheckoutPruneDeclaration.version,
        emptyCheckoutPruneDeclaration.prune.length,
        emptyCheckoutPruneDeclaration.keep.length,
        emptyCheckoutPruneDeclaration.owned.length,
      ],
      [1, 0, 0, 0]
    );
  });
});

describe("checkout prune path predicates", () => {
  const declaration = decodeDeclaration({
    version: 1,
    prune: [
      { path: "docs/demo", why: "not shipped" },
      { path: "packages/drivers/demo", why: "not shipped", packageName: "@beep/demo" },
    ],
    keep: [{ path: "docs/demo/README.md", why: "linked from kept docs" }],
    owned: [
      { path: "renovate.json", why: "own dependency bot" },
      { path: "packages/drivers/own", why: "own driver", packageName: "@beep/own" },
    ],
  });

  it("keeps what a keep entry matches, out of every prune and owned entry", () => {
    strictEqual(isCheckoutPathKept(declaration, "docs/demo/README.md"), true);
    strictEqual(isCheckoutPathKept(declaration, "docs/demo/guide.md"), false);
    strictEqual(isCheckoutPathDeclaredPruned(declaration, "docs/demo/guide.md"), true);
    strictEqual(isCheckoutPathDeclaredPruned(declaration, "docs/demo/README.md"), false);
    strictEqual(isCheckoutPathDeclaredPruned("docs/other.md")(declaration), false);
  });

  it("declares owned paths pruned and owned, and leaves workspace entries to the workspace rule", () => {
    strictEqual(isCheckoutPathDeclaredPruned(declaration, "renovate.json"), true);
    strictEqual(isCheckoutPathOwned(declaration, "renovate.json"), true);
    // Removed and replaced are told apart: renovate.json is owned, not pruned away.
    strictEqual(isCheckoutPathPruneDeclared(declaration, "renovate.json"), false);
    strictEqual(isCheckoutPathPruneDeclared(declaration, "docs/demo/guide.md"), true);
    strictEqual(isCheckoutPathPruneDeclared("docs/demo/README.md")(declaration), false);
    strictEqual(isCheckoutPathOwned("docs/demo/guide.md")(declaration), false);
    // An entry that names a workspace package declares that workspace, not its paths.
    strictEqual(isCheckoutPathDeclaredPruned(declaration, "packages/drivers/demo/src/index.ts"), false);
    strictEqual(isCheckoutPathOwned(declaration, "packages/drivers/own/src/index.ts"), false);
    strictEqual(isCheckoutPathKept("docs/demo/README.md")(declaration), true);
  });
});

describe("checkout prune findings", () => {
  const declaration = decodeDeclaration({
    version: 1,
    prune: [
      { path: "docs/demo", why: "not shipped" },
      { path: "docs/gone", why: "not shipped" },
      { path: "packages/drivers/demo", why: "not shipped", packageName: "@beep/demo" },
      { path: "packages/drivers/live", why: "stale", packageName: "@beep/live" },
    ],
    keep: [{ path: "docs/demo/README.md", why: "linked from kept docs" }],
    owned: [{ path: "renovate.json", why: "own bot" }],
  });

  it("finds a prune entry that matches a live path outside keep, or names a live workspace", () => {
    const findings = checkoutPruneFindings(
      declaration,
      ["docs/demo/README.md", "docs/demo/z.md", "docs/demo/guide.md", "renovate.json"],
      HashSet.make("@beep/live")
    );
    deepStrictEqual(findings, [
      CheckoutPruneFinding.make({ path: "docs/demo", live: "docs/demo/guide.md" }),
      CheckoutPruneFinding.make({ path: "packages/drivers/live", packageName: "@beep/live", live: "@beep/live" }),
    ]);
  });

  it("has no finding when every live match is kept, owned or absent", () => {
    deepStrictEqual(
      checkoutPruneFindings(["docs/demo/README.md", "renovate.json"], HashSet.empty<string>())(declaration),
      []
    );
  });

  it("names each finding and the remedy in one message", () => {
    const error = CheckoutPruneFindingsError.make({
      findings: [
        CheckoutPruneFinding.make({ path: "docs/demo", live: "docs/demo/guide.md" }),
        CheckoutPruneFinding.make({ path: "packages/drivers/live", packageName: "@beep/live", live: "@beep/live" }),
      ],
    });
    strictEqual(
      error.message,
      'standards/checkout-prune.jsonc: prune entry "docs/demo" matches live path docs/demo/guide.md; prune entry "packages/drivers/live" names @beep/live, a workspace the checkout still holds; a prune entry may name only what the checkout removed, so remove the path or narrow the entry (an owned or keep entry may match a live path)'
    );
  });
});

it.layer(NodeServices.layer)("checkout prune declaration file", (it) => {
  it.effect("reads no declaration as the empty one, and a present file as written", () =>
    Effect.gen(function* () {
      const bare = yield* repository({ "package.json": "{}\n" });
      const none = yield* loadCheckoutPruneDeclaration(bare);
      strictEqual(none, emptyCheckoutPruneDeclaration);
      const declared = yield* repository({
        [CHECKOUT_PRUNE_DECLARATION_PATH]: '{ "version": 1, "keep": [{ "path": "docs/kept.md", "why": "kept" }] }\n',
      });
      const declaration = yield* loadCheckoutPruneDeclaration(declared);
      deepStrictEqual(
        A.map(declaration.keep, (row) => row.path),
        ["docs/kept.md"]
      );
    })
  );

  it.effect("fails typed on a present file that does not decode or cannot be read", () =>
    Effect.gen(function* () {
      const invalid = yield* repository({ [CHECKOUT_PRUNE_DECLARATION_PATH]: '{ "version": 1, "prune": 3 }\n' });
      const decodeError = yield* Effect.flip(loadCheckoutPruneDeclaration(invalid));
      strictEqual(S.is(CheckoutPruneDeclarationError)(decodeError), true);
      // A directory where the file belongs exists but cannot be read as text.
      const unreadable = yield* repository({ [`${CHECKOUT_PRUNE_DECLARATION_PATH}/x`]: "x\n" });
      const readError = yield* Effect.flip(loadCheckoutPruneDeclaration(unreadable));
      strictEqual(readError._tag, "CheckoutPruneDeclarationError");
    })
  );

  it.effect("scans the working tree for the files prune entries match, skipping installs", () =>
    Effect.gen(function* () {
      const root = yield* repository({
        "docs/demo/guide.md": "x\n",
        "docs/demo/deep/notes.md": "x\n",
        "docs/demo/node_modules/dep/index.js": "x\n",
        "docs/other.md": "x\n",
        "goals/demo-loop/README.md": "x\n",
        "renovate.json": "{}\n",
      });
      const declaration = decodeDeclaration({
        version: 1,
        prune: [
          { path: "docs/demo", why: "literal: the directory and everything under it" },
          { path: "goals/demo-*", why: "a glob matches files only, in one segment" },
          { path: "*.json", why: "root json" },
          { path: "docs/gone", why: "already removed" },
        ],
      });
      const files = yield* liveCheckoutPruneFiles(root, declaration);
      deepStrictEqual(A.sort(files, Order.String), ["docs/demo/deep/notes.md", "docs/demo/guide.md", "renovate.json"]);
      const nothing = yield* liveCheckoutPruneFiles(root, emptyCheckoutPruneDeclaration);
      deepStrictEqual(nothing, []);
    })
  );
});
