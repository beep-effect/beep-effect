// The confinement invariants, as tests rather than promises.
//
// `@azure/storage-blob` is the only heavy dependency this package has, and the
// requirement is structural: a consumer that imports only `ActionOutputs` — a
// module that appends to a runner file — must be unable to link a blob storage
// client. One module imports it (`internal/azureBlob.ts`), and only the three
// services whose protocols hand back a signed Azure URL reach that module:
// `ActionCache`, `Artifact` and `BlobStore.githubCache`.
//
// The claims are checked by walking the RUNTIME import graph of `src` from
// Vite-inlined source text (`test/support/sourceGraph.ts` over
// `@beep/test-utils/ImportGraph`), so the suite needs no filesystem and runs
// under Node and Bun. Type-only edges are erased and skipped. What this does
// not prove is that a downstream bundler drops an unreferenced module; that
// rests on `"sideEffects": []` (asserted below) plus module-per-file output.
// What it does prove is the part this package controls: no edge exists.

import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as Str from "effect/String";
import manifest from "../package.json" with { type: "json" };
import { builtinsOf, runtimeClosure, runtimeEdgesOf, sourceModules, sourceOf } from "./support/sourceGraph.ts";

/** Every `src` module, so a new module is a deliberate edit to this list. */
const MODULES = [
  "Action.ts",
  "ActionCache.ts",
  "ActionEnvironment.ts",
  "ActionInput.ts",
  "ActionLogger.ts",
  "ActionOutputs.ts",
  "ActionState.ts",
  "ActionsIdentityToken.ts",
  "ActionsProvenance.ts",
  "Artifact.ts",
  "BlobEnvelope.ts",
  "BlobStore.githubCache.ts",
  "BlobStore.ts",
  "BlobTransfer.ts",
  "CacheKey.ts",
  "ChildEnv.ts",
  "DetachedProcess.ts",
  "DryRun.ts",
  "GitHubToken.ts",
  "OidcTokenIssuer.ts",
  "PackageManagerInstaller.ts",
  "Secret.ts",
  "ToolInstaller.ts",
  "index.ts",
  "internal/actionsResults.ts",
  "internal/archiveCommands.ts",
  "internal/azureBlob.ts",
  "internal/cacheService.ts",
  "internal/digest.ts",
  "internal/durationInput.ts",
  "internal/fsProbe.ts",
  "internal/jwt.ts",
  "internal/messageText.ts",
  "internal/pnpmExe.ts",
  "internal/runner.ts",
  "internal/runnerFile.ts",
  "internal/runnerServices.ts",
  "internal/sigv4.ts",
  "internal/spawn.ts",
  "internal/storedBlob.ts",
  "internal/twirp.ts",
];

/** The one module that imports `@azure/storage-blob`. */
const AZURE_BOUNDARY = "internal/azureBlob.ts";

/** The services the confinement rule permits to reach Azure, and only these. */
const AZURE_SERVICES = ["ActionCache.ts", "Artifact.ts", "BlobStore.githubCache.ts"];

/** Every module a consumer can name without linking a blob client. */
const LIGHT_MODULES = A.filter(
  MODULES,
  (module) => module !== "index.ts" && module !== AZURE_BOUNDARY && !A.contains(AZURE_SERVICES, module)
);

const names = (pkg: string) => (specifier: string) => specifier === pkg || Str.startsWith(`${pkg}/`)(specifier);

const packagesOf = (entry: string) => Effect.map(runtimeClosure(entry), (closure) => closure.packages);

const reaches = (entry: string, pkg: string) => Effect.map(packagesOf(entry), A.some(names(pkg)));

/** The modules among `entries` whose closure reaches `pkg`. */
const reachingAmong = (entries: ReadonlyArray<string>, pkg: string) =>
  Effect.filter(entries, (entry) => reaches(entry, pkg));

describe("the source scan", () => {
  it("reads every src module", () => {
    assert.deepStrictEqual(sourceModules, MODULES);
  });

  it("counts literal builtin loads in code and not in prose", () => {
    const fixture = A.join(
      [
        '// process.getBuiltinModule("node:os") is how a comment would say it.',
        'const { createHash } = process.getBuiltinModule("node:crypto");',
        'import * as Effect from "effect/Effect";',
        'import type { Blob } from "@azure/storage-blob";',
      ],
      "\n"
    );
    assert.deepStrictEqual(builtinsOf(fixture), ["node:crypto"]);
    assert.deepStrictEqual(runtimeEdgesOf(fixture), ["effect/Effect", "node:crypto"]);
  });
});

describe("bundle reachability", () => {
  it("only the Azure boundary imports @azure/storage-blob", () => {
    assert.deepStrictEqual(
      A.filter(MODULES, (module) => A.some(runtimeEdgesOf(sourceOf(module)), names("@azure/storage-blob"))),
      [AZURE_BOUNDARY]
    );
  });

  it.effect("the three permitted services DO reach @azure/storage-blob, through the boundary", () =>
    Effect.gen(function* () {
      // The control: without it every negative below could pass because the
      // walker is blind rather than because the edge is absent.
      assert.deepStrictEqual(yield* reachingAmong(AZURE_SERVICES, "@azure/storage-blob"), AZURE_SERVICES);
      for (const entry of AZURE_SERVICES) {
        assert.include((yield* runtimeClosure(entry)).modules, AZURE_BOUNDARY);
      }
    })
  );

  it.effect("no other module reaches @azure/storage-blob", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* reachingAmong(LIGHT_MODULES, "@azure/storage-blob"), []);
    })
  );

  it.effect("the entry point reaches Azure, and that is correct", () =>
    Effect.gen(function* () {
      // `src/index.ts` re-exports the three heavy services, so of course it
      // reaches Azure. The property that matters is the one above: every light
      // module is reachable WITHOUT it.
      assert.isTrue(yield* reaches("index.ts", "@azure/storage-blob"));
    })
  );

  it("no light module imports a heavy one directly", () => {
    // Deliberately RAW source: a specifier appearing only in a comment fails
    // the test, a spurious alarm and never a silent pass. It sees only DIRECT
    // imports; the transitive half is the `no other module` test above.
    for (const entry of LIGHT_MODULES) {
      for (const heavy of A.append(AZURE_SERVICES, "azureBlob.ts")) {
        assert.notInclude(sourceOf(entry), `/${heavy}"`, `${entry} imports ${heavy}`);
      }
    }
  });

  it.effect("each pinned module reaches exactly the packages it is expected to", () =>
    Effect.gen(function* () {
      // Exact edge sets, so a stray value import fails here rather than in a
      // consumer's bundle. The default runtime (`Action.ts`) reaches no Azure
      // and no installer vocabulary; the shared internals reach `effect` and
      // the Twirp client and nothing heavier.
      const actual = yield* Effect.forEach(R.keys(EXPECTED_PACKAGES), (module) =>
        Effect.map(packagesOf(module), (packages) => [module, packages] as const)
      );
      assert.deepStrictEqual(R.fromEntries(actual), EXPECTED_PACKAGES);
    })
  );

  it.effect("no module reaches the markdown engine", () =>
    Effect.gen(function* () {
      // The reporting suite ships as `@beep/github-reporting`, whose own
      // reachability test pins its markdown edges; this package does not
      // import it.
      assert.deepStrictEqual(yield* reachingAmong(MODULES, "@beep/markdown"), []);
    })
  );

  it.effect("the @beep/npm-spec edge is confined to the installer", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* reachingAmong(LIGHT_MODULES, "@beep/npm-spec"), ["PackageManagerInstaller.ts"]);
    })
  );

  it("node builtins are loaded only by the sanctioned modules", () => {
    // `node:crypto` behind the synchronous and streaming digests and SigV4's
    // HMAC, which Effect Crypto does not expose; `node:fs` and
    // `node:child_process` behind the detached spawn, whose children must
    // inherit native descriptors and outlive the Effect scope.
    assert.deepStrictEqual(
      A.filter(MODULES, (module) => A.some(runtimeEdgesOf(sourceOf(module)), Str.startsWith("node:"))),
      ["DetachedProcess.ts", "internal/digest.ts", "internal/sigv4.ts"]
    );
  });

  it("the package declares itself side-effect free", () => {
    // Without this a bundler must assume evaluating an unreferenced module
    // matters, and keeps it. The repo spells it as an empty list, which
    // bundlers read the same as upstream's `false`.
    assert.deepStrictEqual(manifest.sideEffects, []);
  });

  it.effect("every runtime dependency is declared", () =>
    Effect.gen(function* () {
      const declared = R.keys(manifest.dependencies);
      const undeclared = A.filter(
        yield* packagesOf("index.ts"),
        (specifier) => !Str.startsWith("node:")(specifier) && !A.some(declared, (pkg) => names(pkg)(specifier))
      );
      assert.deepStrictEqual(undeclared, []);
    })
  );
});

/** The exact runtime packages each pinned module reaches. */
const EXPECTED_PACKAGES: Readonly<Record<string, ReadonlyArray<string>>> = {
  "Action.ts": [
    "@beep/github-commands",
    "@beep/identity/packages",
    "@beep/schema/LiteralKit",
    "@beep/utils/Option",
    "@beep/utils/TestDouble",
    "@effect/platform-node",
    "@effect/platform-node/NodeRuntime",
    "effect/Array",
    "effect/Boolean",
    "effect/Cause",
    "effect/Config",
    "effect/ConfigProvider",
    "effect/Console",
    "effect/Context",
    "effect/Effect",
    "effect/Exit",
    "effect/FileSystem",
    "effect/Function",
    "effect/HashSet",
    "effect/Inspectable",
    "effect/Layer",
    "effect/LogLevel",
    "effect/Logger",
    "effect/Match",
    "effect/MutableHashMap",
    "effect/Option",
    "effect/Predicate",
    "effect/Record",
    "effect/References",
    "effect/Result",
    "effect/Runtime",
    "effect/Schema",
    "effect/SchemaIssue",
    "effect/String",
    "effect/http/FetchHttpClient",
  ],
  "ActionLogger.ts": [
    "@beep/github-commands",
    "@beep/identity/packages",
    "@beep/schema/LiteralKit",
    "@beep/utils/Option",
    "effect/Array",
    "effect/Boolean",
    "effect/Console",
    "effect/Context",
    "effect/Effect",
    "effect/Exit",
    "effect/FileSystem",
    "effect/Function",
    "effect/Inspectable",
    "effect/Layer",
    "effect/LogLevel",
    "effect/Logger",
    "effect/Option",
    "effect/Predicate",
    "effect/Record",
    "effect/References",
    "effect/Schema",
  ],
  "ActionOutputs.ts": [
    "@beep/github-commands",
    "@beep/identity/packages",
    "@beep/utils/Option",
    "@beep/utils/TestDouble",
    "effect/Array",
    "effect/Boolean",
    "effect/Console",
    "effect/Context",
    "effect/Effect",
    "effect/FileSystem",
    "effect/Function",
    "effect/Layer",
    "effect/Option",
    "effect/Record",
    "effect/Schema",
    "effect/String",
  ],
  "BlobEnvelope.ts": ["@beep/identity/packages", "effect/Function", "effect/Result", "effect/Schema"],
  "BlobStore.ts": [
    "@beep/github-commands",
    "@beep/identity/packages",
    "@beep/schema/LiteralKit",
    "@beep/utils/Option",
    "@beep/utils/TestDouble",
    "effect/Array",
    "effect/Boolean",
    "effect/Config",
    "effect/Console",
    "effect/Context",
    "effect/DateTime",
    "effect/Effect",
    "effect/FileSystem",
    "effect/Function",
    "effect/Layer",
    "effect/Match",
    "effect/MutableHashMap",
    "effect/Option",
    "effect/Order",
    "effect/Record",
    "effect/Redacted",
    "effect/Result",
    "effect/Schema",
    "effect/Stream",
    "effect/String",
    "effect/encoding/Hex",
    "effect/http/HttpClient",
    "effect/http/HttpClientRequest",
    "node:crypto",
  ],
  "CacheKey.ts": [
    "@beep/glob",
    "@beep/identity/packages",
    "@beep/walker/Descend",
    "effect/Array",
    "effect/Effect",
    "effect/FileSystem",
    "effect/Function",
    "effect/HashSet",
    "effect/MutableHashSet",
    "effect/Option",
    "effect/Order",
    "effect/Path",
    "effect/Predicate",
    "effect/Schema",
    "effect/Stream",
    "effect/String",
    "effect/encoding/Hex",
    "node:crypto",
  ],
  "ChildEnv.ts": [
    "@beep/identity/packages",
    "effect/Array",
    "effect/Function",
    "effect/Option",
    "effect/Record",
    "effect/Schema",
    "effect/String",
  ],
  "PackageManagerInstaller.ts": [
    "@beep/identity/packages",
    "@beep/npm-spec/IntegrityHash",
    "@beep/npm-spec/PackageManagerPin",
    "@beep/npm-spec/RegistryKind",
    "@beep/utils/Option",
    "@beep/utils/TestDouble",
    "effect/Array",
    "effect/Boolean",
    "effect/Config",
    "effect/ConfigProvider",
    "effect/Context",
    "effect/Effect",
    "effect/FileSystem",
    "effect/Function",
    "effect/HashSet",
    "effect/Layer",
    "effect/Match",
    "effect/Option",
    "effect/Path",
    "effect/Predicate",
    "effect/Record",
    "effect/Result",
    "effect/Schedule",
    "effect/Schema",
    "effect/Stream",
    "effect/String",
    "effect/encoding/Base64",
    "effect/encoding/Hex",
    "effect/http/HttpClient",
    "effect/process/ChildProcess",
    "effect/process/ChildProcessSpawner",
    "node:crypto",
  ],
  "internal/actionsResults.ts": [
    "@beep/identity/packages",
    "@beep/schema/LiteralKit",
    "effect/Array",
    "effect/Effect",
    "effect/Function",
    "effect/Option",
    "effect/Predicate",
    "effect/Redacted",
    "effect/Result",
    "effect/Schema",
    "effect/String",
    "effect/encoding/Base64Url",
  ],
  "internal/archiveCommands.ts": [
    "@beep/identity/packages",
    "effect/Array",
    "effect/Function",
    "effect/Predicate",
    "effect/Schema",
    "effect/String",
    "effect/process/ChildProcess",
  ],
  "internal/cacheService.ts": [
    "@beep/identity/packages",
    "@beep/schema/LiteralKit",
    "@beep/utils/Option",
    "effect/Boolean",
    "effect/Effect",
    "effect/Function",
    "effect/Option",
    "effect/Predicate",
    "effect/Schedule",
    "effect/Schema",
    "effect/String",
    "effect/http/HttpClient",
    "effect/http/HttpClientRequest",
  ],
  "internal/digest.ts": ["effect/Effect", "effect/Function", "effect/Stream", "effect/encoding/Hex", "node:crypto"],
  "internal/fsProbe.ts": ["effect/Effect", "effect/Function", "effect/Option", "effect/Predicate", "effect/String"],
  "internal/jwt.ts": [
    "@beep/identity/packages",
    "@beep/schema/LiteralKit",
    "effect/Function",
    "effect/Result",
    "effect/Schema",
    "effect/String",
    "effect/encoding/Base64Url",
  ],
  "internal/messageText.ts": ["@beep/identity/packages", "effect/Schema"],
  "internal/pnpmExe.ts": [
    "effect/Array",
    "effect/Function",
    "effect/HashSet",
    "effect/Option",
    "effect/Predicate",
    "effect/Result",
    "effect/String",
    "effect/encoding/Base64",
    "effect/encoding/Hex",
  ],
  "internal/runner.ts": ["effect/Effect", "effect/Function", "effect/Option", "effect/String"],
  "internal/runnerFile.ts": ["effect/Array", "effect/String"],
  "internal/runnerServices.ts": [
    "@beep/identity/packages",
    "effect/Boolean",
    "effect/Context",
    "effect/Effect",
    "effect/FileSystem",
    "effect/Function",
    "effect/Layer",
    "effect/Option",
    "effect/Path",
    "effect/Record",
    "effect/Schema",
    "effect/String",
    "effect/http/HttpClient",
    "effect/process/ChildProcessSpawner",
  ],
  "internal/sigv4.ts": [
    "@beep/identity/packages",
    "@beep/utils/Option",
    "effect/Array",
    "effect/Effect",
    "effect/Function",
    "effect/Order",
    "effect/Record",
    "effect/Schema",
    "effect/Stream",
    "effect/String",
    "effect/encoding/Hex",
    "node:crypto",
  ],
  "internal/spawn.ts": [
    "@beep/identity/packages",
    "effect/Effect",
    "effect/Function",
    "effect/Schema",
    "effect/Stream",
  ],
  "internal/storedBlob.ts": [
    "@beep/identity/packages",
    "effect/Effect",
    "effect/Function",
    "effect/Option",
    "effect/Result",
    "effect/Schema",
  ],
  "internal/twirp.ts": [
    "@beep/identity/packages",
    "@beep/schema/LiteralKit",
    "@beep/utils/Option",
    "effect/Effect",
    "effect/Function",
    "effect/Predicate",
    "effect/Schedule",
    "effect/Schema",
    "effect/String",
    "effect/http/HttpClient",
    "effect/http/HttpClientRequest",
  ],
};
