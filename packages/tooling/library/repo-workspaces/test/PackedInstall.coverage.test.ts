import { ScriptedSpawner } from "@beep/commands";
import { MemoryFileSystem } from "@beep/memfs";
import {
  InstalledConsumer,
  PackedInstall,
  PackedInstallBudget,
  PackedInstallOptions,
  RunBinOptions,
} from "@beep/repo-workspaces/PackedInstall";
import { WorkspaceDiscovery, WorkspaceDiscoveryError } from "@beep/repo-workspaces/WorkspaceDiscovery";
import { WorkspacePackage } from "@beep/repo-workspaces/WorkspacePackage";
import { assert, describe, it } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";

const denied = (method: string) =>
  Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", module: "FileSystem", method }));
const carrier = WorkspacePackage.make({
  name: "carrier",
  version: "1.0.0",
  path: "/repo/carrier",
  relativePath: "carrier",
  packageJsonPath: "/repo/carrier/package.json",
  workspaceRoot: "/repo",
});
const discovery = WorkspaceDiscovery.layerTest({ listPackages: Effect.succeed([carrier]) });
const consumer = InstalledConsumer.make({
  manager: "npm",
  managerVersion: "11.0.0",
  directory: "/scratch",
  carrier: "carrier",
});
const ioLayer = Layer.mergeAll(
  Path.layer,
  discovery,
  MemoryFileSystem.layerWith(
    {
      "/scratch/node_modules/carrier/package.json": '{"name":"carrier","bin":{"tool":"cli.js"}}',
      "/scratch/node_modules/carrier/cli.js": "",
      "/external/package.json": "{}",
    },
    {
      faults: {
        stat: () => denied("stat"),
        exists: (file) =>
          Str.endsWith("cli.js")(file) || Str.includes("/repo/carrier/")(file) || file === "/external/package.json"
            ? denied("exists")
            : undefined,
      },
    }
  )
);

describe("PackedInstall IO boundaries", () => {
  it.layer(ioLayer, { timeout: "30 seconds" })((it) => {
    it.effect("replacement inspection propagates stat errors", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(PackedInstall.closure("carrier", { overrides: { external: "/external" } }));
        assert.strictEqual(error.reason, "Io");
        assert.include(error.message, "could not inspect /external");
      })
    );
    it.effect("preflight propagates failed build probes", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(PackedInstall.preflight({ carrier: "carrier" }));
        assert.strictEqual(error.reason, "Io");
      })
    );
    it.effect("carrierCommand propagates failed bin probes", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(consumer.carrierCommand("tool"));
        assert.strictEqual(error.reason, "Io");
        assert.include(error.message, "cli.js");
      })
    );
  });
  it.layer(
    Layer.mergeAll(
      Path.layer,
      MemoryFileSystem.layerWith({}),
      WorkspaceDiscovery.layerTest({
        listPackages: Effect.fail(
          WorkspaceDiscoveryError.make({
            root: "/repo",
            path: "/repo/package.json",
            kind: "missingName",
            cause: "denied",
          })
        ),
      })
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("discovery failures are wrapped with their originating cause", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(PackedInstall.closure("carrier"));
        assert.strictEqual(error.reason, "Discovery");
        assert.strictEqual(error.message, "workspace discovery failed");
      })
    );
  });
  it.layer(
    Layer.mergeAll(
      Path.layer,
      discovery,
      MemoryFileSystem.layerWith({}, { faults: { makeTempDirectoryScoped: () => denied("makeTempDirectoryScoped") } }),
      ScriptedSpawner.make(() => ({})).layer
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("scratch creation failures surface as IO before probing managers", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          PackedInstall.run({ carrier: "carrier", closure: "auto", managers: ["npm"], bins: [], env: {} })
        );
        assert.strictEqual(error.reason, "Io");
        assert.strictEqual(error.message, "could not create the scratch directory");
      })
    );
  });
});

import * as Str from "effect/String";
import type { MemoryFileSystemFaults } from "@beep/memfs";

const cases: ReadonlyArray<readonly [string, MemoryFileSystemFaults, string]> = [
  [
    "replacement manifest probe",
    { exists: (file) => (file === "/external/package.json" ? denied("exists") : undefined) },
    "closure",
  ],
  ["replacement realpath", { realPath: (file) => (file === "/external" ? denied("realPath") : undefined) }, "closure"],
  ["carrier manifest read", { readFileString: () => denied("readFileString") }, "carrier"],
  [
    "shim presence",
    {
      readLink: () =>
        Effect.fail(
          PlatformError.systemError({
            _tag: "Unknown",
            module: "FileSystem",
            method: "readLink",
            cause: { code: "EINVAL" },
          })
        ),
      exists: () => denied("exists"),
    },
    "bin",
  ],
  ["link resolution", { realPath: (file) => (Str.endsWith("/tool")(file) ? denied("realPath") : undefined) }, "bin"],
  [
    "unknown link errno",
    {
      readLink: () =>
        Effect.fail(
          PlatformError.systemError({ _tag: "Unknown", module: "FileSystem", method: "readLink", cause: {} })
        ),
    },
    "bin",
  ],
];
for (const [name, faults, operation] of cases) {
  it.layer(
    Layer.mergeAll(
      Path.layer,
      discovery,
      MemoryFileSystem.layerWith(
        {
          "/external/package.json": "{}",
          "/scratch/node_modules/carrier/package.json": '{"name":"carrier","bin":{"tool":"cli.js"}}',
          "/scratch/node_modules/carrier/cli.js": "",
          "/scratch/node_modules/.bin/tool": MemoryFileSystem.symlink("../carrier/cli.js"),
        },
        { faults }
      )
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect(`${name} failures retain IO attribution`, () =>
      Effect.gen(function* () {
        const effect =
          operation === "closure"
            ? Effect.asVoid(PackedInstall.closure("carrier", { overrides: { external: "/external" } }))
            : operation === "carrier"
              ? Effect.asVoid(consumer.carrierCommand("tool"))
              : Effect.asVoid(consumer.binProvenance("tool"));
        const error = yield* Effect.flip(effect);
        assert.strictEqual(error.reason, "Io");
      })
    );
  });
}

const runCases: ReadonlyArray<readonly [string, MemoryFileSystemFaults, string, string]> = [
  [
    "packed directory listing",
    { readDirectory: (file) => (Str.includes("/tarballs/")(file) ? denied("readDirectory") : undefined) },
    '{"name":"carrier"}',
    "Io",
  ],
  ["non-object packed manifest", {}, "null", "PackFailed"],
  ["empty bin directory", {}, '{"name":"carrier"}', "MissingBin"],
  ["unnamed replacement", {}, '{"name":"carrier"}', "InvalidOverride"],
];
for (const [name, faults, manifest, reason] of runCases) {
  const spawner = ScriptedSpawner.make((command, args) =>
    args[0] === "--version"
      ? { stdout: "11.0.0" }
      : command === "tar"
        ? { stdout: args[1] === "/external.tgz" ? "{}" : manifest }
        : {}
  );
  it.layer(
    Layer.mergeAll(
      Path.layer,
      discovery,
      spawner.layer,
      MemoryFileSystem.layerWith(
        {
          "/scratch": MemoryFileSystem.directory(),
          "/scratch/tarballs/0/carrier.tgz": "",
          "/scratch/consumer-npm/node_modules/.bin": MemoryFileSystem.directory(),
          "/external.tgz": "",
        },
        { faults: { ...faults, makeTempDirectoryScoped: () => Effect.succeed("/scratch") } }
      )
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect(name, () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          PackedInstall.run({
            carrier: "carrier",
            closure: "auto",
            managers: ["npm"],
            bins: ["tool"],
            env: {},
            packFrom: "source",
            ...(name === "unnamed replacement" ? { overrides: { external: "/external.tgz" } } : {}),
          })
        );
        assert.strictEqual(error.reason, reason);
        if (name === "packed directory listing") assert.include(error.message, "could not list");
        if (name === "empty bin directory") assert.include(error.message, "node_modules/.bin is empty");
        if (name === "unnamed replacement") assert.include(error.message, "a package with no name");
      })
    );
  });
}

it.effect("the runtime class carries its static API on an empty instance", () =>
  Effect.sync(() => {
    assert.strictEqual(Reflect.construct(PackedInstall, []).constructor, PackedInstall);
  })
);

it.layer(
  Layer.mergeAll(
    Path.layer,
    MemoryFileSystem.layerWith({}),
    WorkspaceDiscovery.layerTest({
      listPackages: Effect.succeed([carrier]),
      info: Effect.fail(
        WorkspaceDiscoveryError.make({
          root: "/repo",
          path: "/repo/package.json",
          kind: "missingName",
          cause: "denied",
        })
      ),
    })
  ),
  { timeout: "30 seconds" }
)((it) => {
  it.effect("relative override planning attributes root discovery failure", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(PackedInstall.closure("carrier", { overrides: { external: "./external" } }));
      assert.strictEqual(error.reason, "Discovery");
    })
  );
});

it.layer(
  Layer.mergeAll(
    Path.layer,
    MemoryFileSystem.layerWith(
      {},
      {
        faults: {
          readLink: () =>
            Effect.fail(
              PlatformError.systemError({
                _tag: "Unknown",
                module: "FileSystem",
                method: "readLink",
                cause: { code: "EINVAL" },
              })
            ),
        },
      }
    )
  ),
  { timeout: "30 seconds" }
)((it) => {
  it.effect("a shim removed between readLink and exists fails MissingBin", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(consumer.binProvenance("tool"));
      assert.strictEqual(error.reason, "MissingBin");
    })
  );
});

it.layer(
  Layer.mergeAll(
    Path.layer,
    discovery,
    MemoryFileSystem.layerWith({}),
    ScriptedSpawner.make((command, args) =>
      args[0] === "--version" ? { stdout: "11.0.0" } : ScriptedSpawner.notFound(command)
    ).layer
  ),
  { timeout: "30 seconds" }
)((it) => {
  it.effect("a pack executable that disappears after probing fails PackFailed", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        PackedInstall.run({
          carrier: "carrier",
          closure: "auto",
          managers: ["npm"],
          bins: [],
          env: {},
          packFrom: "source",
        })
      );
      assert.strictEqual(error.reason, "PackFailed");
      assert.include(error.message, "pack could not run");
    })
  );
});

it.layer(
  Layer.mergeAll(
    Path.layer,
    discovery,
    MemoryFileSystem.layerWith(
      {
        "/scratch": MemoryFileSystem.directory(),
        "/scratch/tarballs/0/carrier.tgz": "",
      },
      { faults: { makeTempDirectoryScoped: () => Effect.succeed("/scratch") } }
    ),
    ScriptedSpawner.make((command, args) =>
      args[0] === "--version" ? { stdout: "11.0.0" } : command === "tar" ? ScriptedSpawner.notFound(command) : {}
    ).layer
  ),
  { timeout: "30 seconds" }
)((it) => {
  it.effect("an unreadable tarball manifest is PackFailed with its tarball path", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        PackedInstall.run({
          carrier: "carrier",
          closure: "auto",
          managers: ["npm"],
          bins: [],
          env: {},
          packFrom: "source",
        })
      );
      assert.strictEqual(error.reason, "PackFailed");
      assert.strictEqual(error.message, "could not read package/package.json out of /scratch/tarballs/0/carrier.tgz");
    })
  );
});

describe("PackedInstall option ceilings and stdin", () => {
  const install = { carrier: "carrier", closure: "auto", managers: ["npm"], bins: [], env: {} } as const;

  it("a ceiling is any input Duration.fromInput accepts, and nothing else", () => {
    assertTrue(S.is(PackedInstallOptions)({ ...install, installTimeout: "2 minutes", packTimeout: 5_000 }));
    assertTrue(S.is(PackedInstallBudget)({ managers: ["npm"], packages: 1, perConsumer: "1 second" }));
    assertTrue(S.is(RunBinOptions)({ timeout: "30 seconds" }));
    assertFalse(S.is(PackedInstallOptions)({ ...install, installTimeout: "soon" }));
    assertFalse(S.is(RunBinOptions)({ timeout: "forever-ish" }));
  });

  it("stdin takes a string, bytes or a byte stream", () => {
    assertTrue(S.is(RunBinOptions)({ stdin: "input" }));
    assertTrue(S.is(RunBinOptions)({ stdin: new Uint8Array([1, 2]) }));
    assertTrue(S.is(RunBinOptions)({ stdin: Stream.make(new Uint8Array([1])) }));
    assertFalse(S.is(RunBinOptions)({ stdin: 42 }));
  });

  it("an explicit undefined ceiling or stdin is rejected (EF-40)", () => {
    assertFalse(S.is(RunBinOptions)({ timeout: undefined }));
    assertFalse(S.is(RunBinOptions)({ stdin: undefined }));
    assertFalse(S.is(PackedInstallOptions)({ ...install, installTimeout: undefined }));
  });
});
