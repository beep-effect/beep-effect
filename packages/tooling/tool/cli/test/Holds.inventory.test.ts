import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  anchorKey,
  HoldAnchor,
  HoldClaimVersion,
  HoldLedger,
  HoldLintFinding,
  HoldSiteSnapshot,
  HoldSites,
  heldListFor,
  holdLintFindingText,
  holdsCommand,
  lintHolds,
  liveHoldVersions,
  makeHoldLedger,
  makeHoldSites,
  runHoldsLint,
} from "@beep/repo-cli/commands/Holds";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Str from "effect/String";
import * as Terminal from "effect/Terminal";

// The command resolves the repository root from the working directory, so the in-memory checkout lives there.
const root = process.cwd();

const decodeClaims = S.decodeEffect(S.Array(S.fromJsonString(HoldClaimVersion)));

const signals =
  '{"sourceTrust":{"_tag":"Absent","reason":"not-assessed"},"sourceAssertedConfidence":{"_tag":"Absent","reason":"not-assessed"},"extractorConfidence":{"_tag":"Absent","reason":"not-applicable"},"validator":{"_tag":"Absent","reason":"not-assessed"},"reviewer":{"_tag":"Absent","reason":"not-assessed"}}';

const anchorJson = (anchor: HoldAnchor): string =>
  HoldAnchor.match(anchor, {
    CatalogEntry: ({ packageName }) => `{"_tag":"CatalogEntry","packageName":"${packageName}"}`,
    ManifestDependency: ({ manifest, packageName }) =>
      `{"_tag":"ManifestDependency","manifest":"${manifest}","packageName":"${packageName}"}`,
    SyncpackHeld: ({ dependency }) => `{"_tag":"SyncpackHeld","dependency":"${dependency}"}`,
    SyncpackVersionGroup: ({ label }) => `{"_tag":"SyncpackVersionGroup","label":"${label}"}`,
    RootOverride: ({ packageName }) => `{"_tag":"RootOverride","packageName":"${packageName}"}`,
    PatchedDependency: ({ key }) => `{"_tag":"PatchedDependency","key":"${key}"}`,
    OsvPackageOverride: ({ packageName }) => `{"_tag":"OsvPackageOverride","packageName":"${packageName}"}`,
  });

// One encoded ledger line; JSON text keeps the fixture identical to what the ledger file holds.
const claim = (options: {
  readonly holdId: string;
  readonly anchors: ReadonlyArray<HoldAnchor>;
  readonly version?: number;
  readonly supersedes?: string;
  readonly expiredAt?: number;
  readonly retracted?: boolean;
}): string => {
  const supersedes = options.supersedes === undefined ? "null" : `"${options.supersedes}"`;
  const review = options.retracted === true ? '{"_tag":"Retracted","reason":"gone","at":5}' : '{"_tag":"Proposed"}';
  return `{"id":"${options.holdId}@${options.version ?? 1}","logicalKey":"hold:${options.holdId}","proposition":{"_tag":"Hold","holdId":"${options.holdId}","kind":"override","subject":{"packages":["pkg"],"anchors":[${A.join(A.map(options.anchors, anchorJson), ",")}]},"assertion":"Held for a reason.","falsifier":{"_tag":"Judgement","question":"Still needed?","rubric":"Check upstream."},"watch":[],"exitAction":{"_tag":"Unpin"}},"supportedBy":["manual"],"challengedBy":[],"validTime":{"_tag":"Interval","validFrom":0,"validTo":1000},"knowledge":{"recordedAt":0,"expiredAt":${options.expiredAt ?? "null"}},"supersedes":${supersedes},"review":${review},"signals":${signals}}`;
};

const glob = HoldAnchor.cases.RootOverride.make({ packageName: "glob" });
const zod = HoldAnchor.cases.RootOverride.make({ packageName: "zod" });
const jsdomHeld = HoldAnchor.cases.SyncpackHeld.make({ dependency: "jsdom" });
const jsdomCatalog = HoldAnchor.cases.CatalogEntry.make({ packageName: "jsdom" });

const snapshotOf = (options: {
  readonly required?: ReadonlyArray<HoldAnchor>;
  readonly present?: ReadonlyArray<HoldAnchor>;
  readonly heldList?: ReadonlyArray<string>;
}) =>
  HoldSiteSnapshot.make({
    required: options.required ?? [],
    present: [...(options.required ?? []), ...(options.present ?? [])],
    heldList: options.heldList ?? [],
  });

describe("hold inventory rules", () => {
  it("keys every anchor kind distinctly", () => {
    const keys = A.map(
      [
        HoldAnchor.cases.CatalogEntry.make({ packageName: "a" }),
        HoldAnchor.cases.ManifestDependency.make({ manifest: "m/package.json", packageName: "a" }),
        HoldAnchor.cases.SyncpackHeld.make({ dependency: "a" }),
        HoldAnchor.cases.SyncpackVersionGroup.make({ label: "a" }),
        HoldAnchor.cases.RootOverride.make({ packageName: "a" }),
        HoldAnchor.cases.PatchedDependency.make({ key: "a" }),
        HoldAnchor.cases.OsvPackageOverride.make({ packageName: "a" }),
      ],
      anchorKey
    );
    expect(keys).toEqual([
      "catalog:a",
      "manifest:m/package.json#a",
      "syncpack-held:a",
      "version-group:a",
      "override:a",
      "patch:a",
      "osv:a",
    ]);
  });

  it.effect("keeps only rows that are not superseded, retracted or expired", () => {
    const rows = decodeClaims([
      claim({ holdId: "renewed", anchors: [glob] }),
      claim({ holdId: "renewed", anchors: [glob], version: 2, supersedes: "renewed@1" }),
      claim({ holdId: "retired", anchors: [zod] }),
      claim({ holdId: "retired", anchors: [zod], version: 2, supersedes: "retired@1", retracted: true }),
      claim({ holdId: "expired", anchors: [zod], expiredAt: 3 }),
      claim({ holdId: "alpha", anchors: [zod] }),
    ]);
    return Effect.map(rows, (decoded) =>
      expect(A.map(liveHoldVersions(decoded), (row) => row.id)).toEqual(["alpha@1", "renewed@2"])
    );
  });

  it.effect("derives a sorted, deduplicated held list from SyncpackHeld anchors only", () =>
    Effect.map(
      decodeClaims([
        claim({ holdId: "b", anchors: [jsdomHeld, jsdomCatalog] }),
        claim({ holdId: "a", anchors: [HoldAnchor.cases.SyncpackHeld.make({ dependency: "@lexical/**" }), jsdomHeld] }),
      ]),
      (live) => expect(heldListFor(live)).toEqual(["@lexical/**", "jsdom"])
    )
  );

  it.effect("passes when every required site is recorded and every anchor exists", () =>
    Effect.map(decodeClaims([claim({ holdId: "jsdom-hold", anchors: [jsdomCatalog, jsdomHeld, glob] })]), (live) => {
      const snapshot = snapshotOf({ required: [glob], present: [jsdomCatalog], heldList: ["jsdom"] });
      expect(lintHolds(snapshot, live)).toEqual([]);
      expect(lintHolds(live)(snapshot)).toEqual([]);
    })
  );

  it.effect("reports unrecorded sites, orphaned anchors and a stale held list", () =>
    Effect.map(decodeClaims([claim({ holdId: "glob-hold", anchors: [glob, jsdomHeld] })]), (live) => {
      const findings = lintHolds(snapshotOf({ required: [zod], heldList: [] }), live);
      expect(A.map(findings, (finding) => finding._tag)).toEqual(["Unrecorded", "Orphaned", "HeldListStale"]);
      expect(A.map(findings, holdLintFindingText)).toEqual([
        "unrecorded: override:zod has no live hold record",
        "orphaned: glob-hold anchors override:glob, which is gone",
        "stale: hold-ledger/syncpack-held.generated.json differs from the ledger (expected jsdom)",
      ]);
    })
  );

  it.effect("never treats a SyncpackHeld anchor as orphaned", () =>
    Effect.map(decodeClaims([claim({ holdId: "jsdom-hold", anchors: [jsdomHeld] })]), (live) =>
      expect(lintHolds(snapshotOf({ heldList: ["jsdom"] }), live)).toEqual([])
    )
  );

  it.effect("decodes every lint finding case", () =>
    Effect.map(S.decodeEffect(HoldLintFinding)({ _tag: "HeldListStale", expected: ["a"], actual: [] }), (finding) =>
      expect(finding._tag).toBe("HeldListStale")
    )
  );
});

const unusedSpawner = ChildProcessSpawner.make(() => Effect.die("holds lint never spawns"));

const terminal = Terminal.make({
  columns: Effect.succeed(80),
  rows: Effect.succeed(24),
  size: Effect.die("holds commands never prompt"),
  readInput: Effect.die("holds commands never prompt"),
  readLine: Effect.die("holds commands never prompt"),
  display: () => Effect.void,
});

const platformFor = (files: Readonly<Record<string, string>>) =>
  Layer.mergeAll(
    MemoryFileSystem.layer.pipe(
      Layer.tap((context) =>
        Effect.gen(function* () {
          const fs = Context.get(context, FileSystem.FileSystem);
          const path = yield* Path.Path;
          yield* fs.makeDirectory(root, { recursive: true });
          yield* fs.writeFileString(path.join(root, "bun.lock"), "");
          yield* Effect.forEach(
            R.toEntries(files),
            ([name, content]) =>
              fs
                .makeDirectory(path.dirname(path.join(root, name)), { recursive: true })
                .pipe(Effect.andThen(fs.writeFileString(path.join(root, name), content))),
            { discard: true }
          );
        })
      ),
      Layer.provide(Path.layer)
    ),
    Path.layer,
    BunCrypto.layer,
    Stdio.layerTest({}),
    Layer.succeed(Terminal.Terminal, terminal),
    Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, unusedSpawner)
  );

const layerFor = (files: Readonly<Record<string, string>>) =>
  Layer.mergeAll(Layer.effect(HoldLedger, makeHoldLedger(root)), Layer.effect(HoldSites, makeHoldSites(root))).pipe(
    Layer.provideMerge(platformFor(files))
  );

const rootManifest =
  '{"name":"@beep/root","catalog":{"jsdom":"30.0.1"},"overrides":{"glob":"14.0.3"},"patchedDependencies":{"effect@4.1.0":"patches/effect@4.1.0.patch"}}';

const osvToml = '[[PackageOverrides]]\nname = "braces"\nignore = true\n\n[[PackageOverrides]]\nname = "braces"\n';

// A commented-out group must not count, and a single-quoted label must.
const syncpackConfig = A.join(
  [
    "const config = {",
    "  versionGroups: [",
    '    { label: "infra keeps TypeScript 6" },',
    '    // { label: "retired group" },',
    "    { label: 'single quoted group' },",
    "  ],",
    "};",
    "",
  ],
  "\n"
);

const coveringHolds = [
  claim({ holdId: "glob-hold", anchors: [glob] }),
  claim({ holdId: "effect-patch", anchors: [HoldAnchor.cases.PatchedDependency.make({ key: "effect@4.1.0" })] }),
  claim({ holdId: "braces-osv", anchors: [HoldAnchor.cases.OsvPackageOverride.make({ packageName: "braces" })] }),
  claim({ holdId: "jsdom-hold", anchors: [jsdomCatalog, jsdomHeld] }),
  claim({
    holdId: "infra-ts6",
    anchors: [HoldAnchor.cases.SyncpackVersionGroup.make({ label: "infra keeps TypeScript 6" })],
  }),
  claim({
    holdId: "tstyche-beta",
    anchors: [
      HoldAnchor.cases.ManifestDependency.make({ manifest: "pkgs/drizzle/package.json", packageName: "tstyche" }),
    ],
  }),
];

const checkout = {
  "package.json": rootManifest,
  "osv-scanner.toml": osvToml,
  "syncpack.config.ts": syncpackConfig,
  "pkgs/drizzle/package.json": '{"devDependencies":{"tstyche":"8.0.0-beta.0"}}',
  "hold-ledger/syncpack-held.generated.json": '[\n  "jsdom"\n]\n',
  "hold-ledger/claims.jsonl": `${A.join(coveringHolds, "\n")}\n`,
};

layer(layerFor(checkout), { timeout: "30 seconds" })("a checkout whose ledger covers every site", (it) => {
  it.effect("collects required and present sites from every config file", () =>
    Effect.gen(function* () {
      const sites = yield* HoldSites;
      const snapshot = yield* sites.snapshot(["pkgs/drizzle/package.json", "pkgs/missing/package.json"]);
      expect(A.map(snapshot.required, anchorKey)).toEqual(["override:glob", "patch:effect@4.1.0", "osv:braces"]);
      expect(A.map(snapshot.present, anchorKey)).toEqual([
        "override:glob",
        "patch:effect@4.1.0",
        "osv:braces",
        "catalog:jsdom",
        "version-group:infra keeps TypeScript 6",
        "version-group:single quoted group",
        "manifest:pkgs/drizzle/package.json#tstyche",
      ]);
      expect(snapshot.heldList).toEqual(["jsdom"]);
    })
  );

  it.effect("passes the lint", () =>
    Effect.map(runHoldsLint(false), (lines) =>
      expect(lines).toEqual(["[holds] lint ok: 6 live hold(s) cover every site."])
    )
  );

  it.effect("passes through the real command", () =>
    Effect.map(Effect.exit(Command.runWith(holdsCommand, { version: "test" })(["lint"])), (exit) =>
      expect(exit._tag).toBe("Success")
    )
  );
});

layer(layerFor({ "package.json": '{"name":"@beep/root"}' }), { timeout: "30 seconds" })(
  "a checkout with no ledger and no hold-shaped config",
  (it) => {
    it.effect("passes with no holds", () =>
      Effect.map(runHoldsLint(false), (lines) =>
        expect(lines).toEqual(["[holds] lint ok: 0 live hold(s) cover every site."])
      )
    );
  }
);

layer(
  layerFor({
    ...checkout,
    "package.json":
      '{"name":"@beep/root","catalog":{"jsdom":"30.0.1"},"overrides":{"glob":"14.0.3","zod":"4.6.6"},"patchedDependencies":{"effect@4.1.0":"patches/effect@4.1.0.patch"}}',
  }),
  { timeout: "30 seconds" }
)("a checkout with an unrecorded override", (it) => {
  it.effect("fails the lint, with or without --write", () =>
    Effect.gen(function* () {
      const plain = yield* Effect.flip(runHoldsLint(false));
      const written = yield* Effect.flip(runHoldsLint(true));
      expect(plain.reason).toBe("lint");
      expect(plain.message).toBe("unrecorded: override:zod has no live hold record");
      expect(written.message).toBe("unrecorded: override:zod has no live hold record");
    })
  );
});

layer(
  layerFor({
    ...checkout,
    "package.json": '{"name":"@beep/root","catalog":{"jsdom":"30.0.1"},"patchedDependencies":{"effect@4.1.0":"x"}}',
    "hold-ledger/syncpack-held.generated.json": "[]\n",
  }),
  { timeout: "30 seconds" }
)("a checkout where an override left and the held list is stale", (it) => {
  it.effect("fails without --write", () =>
    Effect.map(Effect.flip(runHoldsLint(false)), (error) =>
      expect(Str.split(error.message, "\n")).toEqual([
        "orphaned: glob-hold anchors override:glob, which is gone",
        "stale: hold-ledger/syncpack-held.generated.json differs from the ledger (expected jsdom)",
      ])
    )
  );

  it.effect("tombstones the orphan and regenerates the held list with --write", () =>
    Effect.gen(function* () {
      const lines = yield* runHoldsLint(true);
      expect(lines).toEqual([
        "[holds] tombstoned glob-hold@2: glob-hold",
        "[holds] lint ok: 5 live hold(s) cover every site.",
      ]);
      const ledger = yield* HoldLedger;
      const all = yield* ledger.allVersions;
      const tombstone = A.findFirst(all, (row) => row.id === "glob-hold@2");
      expect(tombstone._tag).toBe("Some");
      if (tombstone._tag === "Some") {
        expect(tombstone.value.review).toMatchObject({ _tag: "Retracted", reason: "Anchor gone: override:glob." });
        expect(tombstone.value.supersedes).toMatchObject({ _tag: "Some", value: "glob-hold@1" });
      }
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      expect(yield* fs.readFileString(path.join(root, "hold-ledger/syncpack-held.generated.json"))).toBe(
        '[\n  "jsdom"\n]\n'
      );
      expect(yield* runHoldsLint(false)).toEqual(["[holds] lint ok: 5 live hold(s) cover every site."]);
    })
  );
});

layer(
  layerFor({
    ...checkout,
    "package.json": '{"name":"@beep/root","catalog":{"jsdom":"30.0.1"},"patchedDependencies":{"effect@4.1.0":"x"}}',
    "hold-ledger/claims.jsonl": `${A.join(
      [
        ...A.filter(coveringHolds, (line) => !Str.includes('"holdId":"glob-hold"')(line)),
        claim({ holdId: "glob-hold", anchors: [glob, jsdomCatalog] }),
      ],
      "\n"
    )}\n`,
  }),
  { timeout: "30 seconds" }
)("a hold that lost only some of its anchors", (it) => {
  it.effect("is kept by --write and still fails the lint", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(runHoldsLint(true));
      expect(Str.split(error.message, "\n")).toEqual([
        "[holds] kept glob-hold: some anchors remain; update or retire the record by hand",
        "orphaned: glob-hold anchors override:glob, which is gone",
      ]);
      const ledger = yield* HoldLedger;
      expect(A.length(yield* ledger.allVersions)).toBe(6);
    })
  );
});

layer(
  layerFor({
    ...checkout,
    "package.json": '{"name":"@beep/root","catalog":{"jsdom":"30.0.1"},"patchedDependencies":{"effect@4.1.0":"x"}}',
    "hold-ledger/claims.jsonl": `${A.join(
      [
        ...A.filter(coveringHolds, (line) => !Str.includes('"holdId":"glob-hold"')(line)),
        claim({ holdId: "glob-hold", anchors: [glob], version: 1 }),
        claim({ holdId: "glob-hold", anchors: [glob], version: 3, supersedes: "glob-hold@1" }),
      ],
      "\n"
    )}\n`,
  }),
  { timeout: "30 seconds" }
)("a hold whose version numbers have a gap", (it) => {
  it.effect("gives the tombstone an id no row uses", () =>
    Effect.map(runHoldsLint(true), (lines) =>
      expect(lines).toEqual([
        "[holds] tombstoned glob-hold@4: glob-hold",
        "[holds] lint ok: 5 live hold(s) cover every site.",
      ])
    )
  );
});

layer(layerFor({ ...checkout, "package.json": "{not json" }), { timeout: "30 seconds" })(
  "a checkout with a malformed root manifest",
  (it) => {
    it.effect("fails with a decode error", () =>
      Effect.map(Effect.flip(runHoldsLint(false)), (error) => {
        expect(error.reason).toBe("decode");
        expect(error.message).toBe("Could not decode package.json.");
      })
    );
  }
);

layer(layerFor({ ...checkout, "osv-scanner.toml": "[[PackageOverrides]\n" }), { timeout: "30 seconds" })(
  "a checkout with malformed OSV config",
  (it) => {
    it.effect("fails with a decode error", () =>
      Effect.map(Effect.flip(runHoldsLint(false)), (error) =>
        expect(error.message).toBe("Could not decode osv-scanner.toml.")
      )
    );
  }
);
