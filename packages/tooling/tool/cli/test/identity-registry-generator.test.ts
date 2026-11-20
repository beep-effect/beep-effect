import { IdentityAuthority } from "@beep/identity/Authority";
import { RegistryVocab } from "@beep/identity/Registry";
import { RegistryShard, RegistryTable, TermSnapshot } from "@beep/identity/Term";
import { identityCommand } from "@beep/repo-cli/commands/Identity";
import {
  driftIssues,
  IdentityRegistryIssue,
  issueLine,
  planRegistry,
  planRegistryArtifacts,
  RegistryLayout,
  RegistryPlanInput,
  RegistrySourceFile,
  registryVocabOf,
  renderRegistryData,
  renderRegistryJson,
  renderTermSnapshot,
  resolveRegistryLayout,
} from "@beep/repo-cli/commands/Identity/Registry";
import { findRepoRoot } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { expectReportedExit, NodeTestLayer, temporaryWorkingDirectory } from "./support/CommandTest.ts";

const runIdentityCommand = Command.runWith(identityCommand, { version: "0.0.0" });
const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);
const decodeShard = S.decodeResult(RegistryShard);
const shard = (fields: Partial<RegistryShard.Encoded> & Pick<RegistryShard.Encoded, "namespace">): RegistryShard =>
  Result.getOrThrow(decodeShard({ terms: [], bindings: [], deprecations: [], ...fields }));

const layout = RegistryLayout.of("packages/identity");
const fabio = { namespace: { prefix: "fabio", iri: "http://purl.org/spar/fabio/" }, terms: ["Report"] };
const shardFile = (name: string, value: unknown): RegistrySourceFile =>
  RegistrySourceFile.make({ path: `${layout.shards}/${name}`, content: renderRegistryJson(value) });
const fabioFile = shardFile("fabio.json", { ...fabio, bindings: [], deprecations: [] });

const issueKinds = (
  result: Result.Result<ReadonlyArray<RegistrySourceFile>, A.NonEmptyReadonlyArray<IdentityRegistryIssue>>
): ReadonlyArray<string> => (Result.isFailure(result) ? A.map(result.failure, (issue) => issue.kind) : []);

describe("renderRegistryJson", () => {
  it("keeps objects open and puts a scalar array on one line only when it fits 80 columns", () => {
    // `  "fits": [` plus its member and `],` is exactly 80 columns; one more character breaks it.
    const fits = Str.repeat(65)("x");
    const over = Str.repeat(66)("x");
    expect(
      renderRegistryJson({
        empty: [],
        none: {},
        fits: [fits],
        over: [over],
        mixed: ['a,"b"', 1, true, null],
        row: { prefix: "fabio", terms: ["Report"] },
        nested: [{ a: [] }],
      })
    ).toBe(`{
  "empty": [],
  "none": {},
  "fits": ["${fits}"],
  "over": [
    "${over}"
  ],
  "mixed": ["a,\\"b\\"", 1, true, null],
  "row": {
    "prefix": "fabio",
    "terms": ["Report"]
  },
  "nested": [
    {
      "a": []
    }
  ]
}
`);
    expect(renderRegistryJson(["a"])).toBe('["a"]\n');
  });
});

describe("renderRegistryData", () => {
  it("spells internal IRIs over IdentityAuthority and renders bindings and deprecations", () => {
    const table = Result.getOrThrow(
      RegistryTable.fromShards([
        shard({
          namespace: { prefix: "vitest-terms", iri: `${IdentityAuthority}vitest/` },
          terms: ["TestHang"],
          bindings: [{ code: "@beep/test-runner/Vitest/TestHang", local: "TestHang", since: "1.0.0" }],
          deprecations: [
            { term: `${IdentityAuthority}test-utils/Vitest/Gone`, since: "1.0.0" },
            { term: `${IdentityAuthority}test-utils/Vitest/TestHang`, since: "1.0.0", replacement: "TestHang" },
          ],
        }),
        shard({ namespace: { prefix: "empty", iri: "https://example.test/empty/" } }),
      ])
    );
    const data = renderRegistryData(table);
    expect(data).toContain('import { IdentityAuthority } from "../../Authority.ts";');
    expect(data).toContain('  "vitest-terms": {\n    iri: `${IdentityAuthority}vitest/`,');
    expect(data).toContain('  empty: {\n    iri: "https://example.test/empty/",\n    terms: [],\n  },');
    expect(data).toContain(
      '  "@beep/test-runner/Vitest/TestHang": { curie: "vitest-terms:TestHang", iri: `${IdentityAuthority}vitest/TestHang` },'
    );
    expect(data).toContain(
      `  "${IdentityAuthority}test-utils/Vitest/TestHang": { since: "1.0.0", replacement: \`\${IdentityAuthority}vitest/TestHang\` },`
    );
    expect(data).toContain(`  "${IdentityAuthority}test-utils/Vitest/Gone": { since: "1.0.0" },`);
  });

  it("imports nothing and renders empty records for a purely external table", () => {
    const data = RegistryTable.fromShards([shard(fabio)]).pipe(Result.getOrThrow, renderRegistryData);
    expect(data).not.toContain("import");
    expect(data).toContain("export const RegistryBindings = {} as const");
    expect(data).toContain("export const RegistryDeprecations = {} as const");
  });
});

describe("planRegistryArtifacts", () => {
  it("renders the data module and the first snapshot from shard files", () => {
    const planned = Result.getOrThrow(
      planRegistryArtifacts(RegistryPlanInput.make({ layout, shardFiles: [fabioFile], previous: O.none() }))
    );
    expect(A.map(planned, (artifact) => artifact.path)).toStrictEqual([layout.data, layout.snapshot]);
    const table = Result.getOrThrow(RegistryTable.fromShards([shard(fabio)]));
    expect(planned[1]?.content).toBe(renderTermSnapshot(RegistryTable.snapshot(table, TermSnapshot.empty)));
    const again = Result.getOrThrow(
      planRegistryArtifacts(
        RegistryPlanInput.make({ layout, shardFiles: [fabioFile], previous: O.fromUndefinedOr(planned[1]?.content) })
      )
    );
    expect(again).toStrictEqual(planned);
  });

  it("reports missing, undecodable, misnamed and conflicting shards and an undecodable snapshot", () => {
    expect(
      issueKinds(planRegistryArtifacts(RegistryPlanInput.make({ layout, shardFiles: [], previous: O.none() })))
    ).toStrictEqual(["registry-shard-invalid"]);
    const broken = RegistrySourceFile.make({ path: `${layout.shards}/broken.json`, content: "{" });
    expect(
      issueKinds(
        planRegistryArtifacts(
          RegistryPlanInput.make({
            layout,
            shardFiles: [broken, shardFile("deo.json", { ...fabio, bindings: [], deprecations: [] })],
            previous: O.none(),
          })
        )
      )
    ).toStrictEqual(["registry-shard-invalid", "registry-shard-invalid"]);
    const clash = shardFile("fab.json", {
      namespace: { prefix: "fab", iri: "http://purl.org/spar/fabio/" },
      terms: [],
      bindings: [],
      deprecations: [],
    });
    expect(
      issueKinds(
        planRegistryArtifacts(RegistryPlanInput.make({ layout, shardFiles: [fabioFile, clash], previous: O.none() }))
      )
    ).toStrictEqual(["registry-conflict"]);
    expect(
      issueKinds(
        planRegistryArtifacts(RegistryPlanInput.make({ layout, shardFiles: [fabioFile], previous: O.some("{}") }))
      )
    ).toStrictEqual(["registry-generated-drift"]);
  });
});

describe("driftIssues", () => {
  it("reports missing and changed artifacts and accepts equal ones", () => {
    const planned = [
      RegistrySourceFile.make({ path: "a", content: "1" }),
      RegistrySourceFile.make({ path: "b", content: "2" }),
      RegistrySourceFile.make({ path: "c", content: "3" }),
    ];
    const current = R.fromEntries([
      ["b", "two"],
      ["c", "3"],
    ]);
    const issues = driftIssues(planned, (path) => R.get(current, path));
    expect(driftIssues((path: string) => R.get(current, path))(planned)).toStrictEqual(issues);
    expect(A.map(issues, (issue) => issue.subject)).toStrictEqual(["a", "b"]);
    expect(
      issueLine(issues[0] ?? IdentityRegistryIssue.make({ kind: "registry-conflict", subject: "", detail: "" }))
    ).toMatch(/^a \[registry-generated-drift\] The generated artifact is missing\./);
  });
});

const decodeShardJson = S.decodeUnknownResult(S.fromJsonString(RegistryShard));

it.layer(NodeTestLayer, { concurrent: false, timeout: "60 seconds" })((it) => {
  describe("the committed identity registry", () => {
    it.effect("regenerates to the committed bytes and to the generated RegistryVocab", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* findRepoRoot();
        const committed = yield* resolveRegistryLayout(repoRoot);
        expect(committed).toStrictEqual(RegistryLayout.of("packages/foundation/modeling/identity"));
        const plan = yield* planRegistry(repoRoot, committed);
        for (const artifact of Result.getOrThrow(plan)) {
          const onDisk = yield* fs.readFileString(path.join(repoRoot, artifact.path));
          expect(onDisk, artifact.path).toBe(artifact.content);
        }
        const names = yield* fs.readDirectory(path.join(repoRoot, committed.shards));
        const shards = yield* Effect.forEach(
          A.sort(names, Order.String),
          (name) =>
            Effect.map(
              fs.readFileString(path.join(repoRoot, committed.shards, name)),
              flow(decodeShardJson, Result.getOrThrow)
            ),
          { concurrency: 1 }
        );
        const vocab = RegistryTable.fromShards(shards).pipe(Result.getOrThrow, registryVocabOf);
        expect(vocab).toStrictEqual(RegistryVocab);
      })
    );
  });

  describe("identity registry command", { concurrent: false }, () => {
    const writeFixture = Effect.fn("writeFixture")(function* (shards: ReadonlyArray<readonly [string, unknown]>) {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.writeFileString("bun.lock", "");
      yield* fs.writeFileString(
        "package.json",
        `${encodeJson({ name: "fixture-root", private: true, type: "module", workspaces: ["packages/*"] })}\n`
      );
      yield* fs.makeDirectory(layout.shards, { recursive: true });
      yield* fs.writeFileString(
        "packages/identity/package.json",
        `${encodeJson({ name: "@beep/identity", version: "0.0.0", type: "module" })}\n`
      );
      for (const [name, value] of shards) {
        yield* fs.writeFileString(`${layout.shards}/${name}`, renderRegistryJson(value));
      }
    });

    const errorLineWith = (lines: ReadonlyArray<unknown>, needle: string): boolean =>
      A.some(lines, (line) => Str.includes(needle)(String(line)));

    it.effect("checks by default, writes with --write and refuses both flags", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* writeFixture([["fabio.json", { ...fabio, bindings: [], deprecations: [] }]]);
          const fs = yield* FileSystem.FileSystem;

          const missing = yield* Effect.exit(runIdentityCommand(["registry"]));
          expectReportedExit(missing);
          const drift = yield* TestConsole.errorLines;
          expect(A.filter(drift, (line) => Str.includes("[registry-generated-drift]")(String(line)))).toHaveLength(2);

          yield* runIdentityCommand(["registry", "--write"]);
          const dataWritten = yield* fs.exists(layout.data);
          expect(dataWritten).toBe(true);
          const snapshotText = yield* fs.readFileString(layout.snapshot);
          expect(snapshotText).toContain('"release": "1.0.0"');

          yield* runIdentityCommand(["registry", "--write"]);
          yield* runIdentityCommand(["registry", "--check"]);
          const logs = yield* TestConsole.logLines;
          expect(logs).toContain("[identity:registry] up to date.");
          expect(logs).toContain("[identity:registry] OK: the generated registry artifacts match the shards.");

          const both = yield* Effect.exit(runIdentityCommand(["registry", "--write", "--check"]));
          expectReportedExit(both);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("reports a registry with no shard directory", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* writeFixture([]);
          yield* fs.remove(layout.shards, { recursive: true });
          const unsharded = yield* Effect.exit(runIdentityCommand(["registry"]));
          expectReportedExit(unsharded);
          const errors = yield* TestConsole.errorLines;
          expect(errors).toContain(`${layout.shards} [registry-shard-invalid] The registry has no source shard.`);
          yield* fs.remove("packages/identity", { recursive: true });
          const unresolved = yield* Effect.exit(runIdentityCommand(["registry"]));
          const failure = Exit.match(unresolved, { onFailure: Cause.pretty, onSuccess: () => "" });
          expect(failure).toContain("Cannot resolve the @beep/identity workspace.");
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses to write over a conflict", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* writeFixture([
            ["fabio.json", { ...fabio, bindings: [], deprecations: [] }],
            [
              "fab.json",
              {
                namespace: { prefix: "fab", iri: "http://purl.org/spar/fabio/" },
                terms: [],
                bindings: [],
                deprecations: [],
              },
            ],
          ]);
          const write = yield* Effect.exit(runIdentityCommand(["registry", "--write"]));
          expectReportedExit(write);
          const dataWritten = yield* fs.exists(layout.data);
          expect(dataWritten).toBe(false);
          const check = yield* Effect.exit(runIdentityCommand(["registry"]));
          expectReportedExit(check);
          const errors = yield* TestConsole.errorLines;
          expect(errorLineWith(errors, "[registry-conflict]")).toBe(true);
          yield* runIdentityCommand([]);
          const logs = yield* TestConsole.logLines;
          expect(logs).toContain("Identity registry commands: bun run beep identity registry [--write | --check]");
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});
