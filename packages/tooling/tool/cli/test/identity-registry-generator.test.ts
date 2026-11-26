import { IdentityAuthority } from "@beep/identity/Authority";
import { RegistryVocab } from "@beep/identity/Registry";
import { RegistryShard, RegistryTable, TermSnapshot } from "@beep/identity/Term";
import { identityCommand } from "@beep/repo-cli/commands/Identity";
import {
  BaseSnapshot,
  danglingBindingCodes,
  driftIssues,
  IdentityRegistryIssue,
  issueLine,
  planRegistry,
  planRegistryArtifacts,
  RegistryLayout,
  RegistryPlan,
  RegistryPlanInput,
  RegistryProjectionTarget,
  RegistrySourceFile,
  registryVocabOf,
  renderRegistryData,
  renderRegistryJson,
  renderRegistryProjection,
  renderTermSnapshot,
  resolveRegistryLayout,
  writeRegistry,
} from "@beep/repo-cli/commands/Identity/Registry";
import { findRepoRoot } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFailure, assertTrue } from "@effect/vitest/utils";
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
import * as PlatformError from "effect/PlatformError";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import {
  expectReportedExit,
  NodeTestLayer,
  temporaryWorkingDirectory,
  withAncestorsHidden,
} from "./support/CommandTest.ts";

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
  result: Result.Result<RegistryPlan, A.NonEmptyReadonlyArray<IdentityRegistryIssue>>
): ReadonlyArray<string> => (Result.isFailure(result) ? A.map(result.failure, (issue) => issue.kind) : []);

describe("renderRegistryJson", () => {
  it("keeps objects open and collapses a scalar array at exactly 80 columns but not 81", () => {
    const scalarMemberAt80Columns = Str.repeat(65)("x");
    const scalarMemberAt81Columns = Str.repeat(66)("x");
    expect(
      renderRegistryJson({
        empty: [],
        none: {},
        fits: [scalarMemberAt80Columns],
        over: [scalarMemberAt81Columns],
        mixed: ['a,"b"', 1, true, null],
        row: { prefix: "fabio", terms: ["Report"] },
        nested: [{ a: [] }],
      })
    ).toBe(`{
  "empty": [],
  "none": {},
  "fits": ["${scalarMemberAt80Columns}"],
  "over": [
    "${scalarMemberAt81Columns}"
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

  it("imports IdentityAuthority when only a bound term or a replacement sits under it", () => {
    const root = { prefix: "root", iri: "https://beep-effect.com/" };
    assertTrue(
      Str.startsWith(IdentityAuthority)(`${root.iri}ns/Example`) && !Str.startsWith(IdentityAuthority)(root.iri)
    );
    const bound = shard({
      namespace: root,
      terms: ["ns/Example"],
      bindings: [{ code: "@beep/identity/Vitest/Example", local: "ns/Example", since: "1.0.0" }],
    });
    const bindingData = RegistryTable.fromShards([bound]).pipe(Result.getOrThrow, renderRegistryData);
    expect(bindingData).toContain('import { IdentityAuthority } from "../../Authority.ts";');
    expect(bindingData).toContain("iri: `${IdentityAuthority}Example` },");
    const replaced = shard({
      namespace: root,
      terms: ["ns/Example"],
      deprecations: [{ term: "https://beep-effect.com/Old", since: "1.0.0", replacement: "ns/Example" }],
    });
    const deprecationData = RegistryTable.fromShards([replaced]).pipe(Result.getOrThrow, renderRegistryData);
    expect(deprecationData).toContain('import { IdentityAuthority } from "../../Authority.ts";');
    expect(deprecationData).toContain("replacement: `${IdentityAuthority}Example` },");
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
      planRegistryArtifacts(RegistryPlanInput.make({ layout, shardFiles: [fabioFile], committed: O.none() }))
    );
    expect(A.map(planned.artifacts, (artifact) => artifact.path)).toStrictEqual([layout.data, layout.snapshot]);
    const table = Result.getOrThrow(RegistryTable.fromShards([shard(fabio)]));
    expect(planned.snapshot).toStrictEqual(RegistryTable.snapshot(table, TermSnapshot.empty));
    expect(planned.artifacts[1]?.content).toBe(renderTermSnapshot(planned.snapshot));
    const again = Result.getOrThrow(
      planRegistryArtifacts(
        RegistryPlanInput.make({
          layout,
          shardFiles: [fabioFile],
          committed: O.fromUndefinedOr(planned.artifacts[1]?.content),
        })
      )
    );
    expect(again).toStrictEqual(planned);
  });

  it("reports missing, undecodable, misnamed and conflicting shards and an undecodable snapshot", () => {
    expect(
      issueKinds(planRegistryArtifacts(RegistryPlanInput.make({ layout, shardFiles: [], committed: O.none() })))
    ).toStrictEqual(["registry-shard-invalid"]);
    const broken = RegistrySourceFile.make({ path: `${layout.shards}/broken.json`, content: "{" });
    expect(
      issueKinds(
        planRegistryArtifacts(
          RegistryPlanInput.make({
            layout,
            shardFiles: [broken, shardFile("deo.json", { ...fabio, bindings: [], deprecations: [] })],
            committed: O.none(),
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
        planRegistryArtifacts(RegistryPlanInput.make({ layout, shardFiles: [fabioFile, clash], committed: O.none() }))
      )
    ).toStrictEqual(["registry-conflict"]);
    expect(
      issueKinds(
        planRegistryArtifacts(RegistryPlanInput.make({ layout, shardFiles: [fabioFile], committed: O.some("{}") }))
      )
    ).toStrictEqual(["registry-generated-drift"]);
  });

  it("writes the bindings of a projecting shard into its package and refuses an absent package", () => {
    const vitest = {
      namespace: { prefix: "vitest", iri: `${IdentityAuthority}vitest/` },
      terms: ["TestHang"],
      bindings: [{ code: "@beep/test-runner/Vitest/TestHang", local: "TestHang", since: "1.0.0" }],
      deprecations: [],
      projection: "@beep/test-runner",
    } satisfies RegistryShard.Encoded;
    const target = RegistryProjectionTarget.of("@beep/test-runner", "packages/test-runner");
    const projecting = RegistryLayout.of("packages/identity", [target]);
    const vitestFile = shardFile("vitest.json", vitest);
    const planned = Result.getOrThrow(
      planRegistryArtifacts(
        RegistryPlanInput.make({ layout: projecting, shardFiles: [fabioFile, vitestFile], committed: O.none() })
      )
    );
    expect(A.map(planned.artifacts, (artifact) => artifact.path)).toStrictEqual([
      layout.data,
      layout.snapshot,
      target.path,
    ]);
    const table = Result.getOrThrow(RegistryTable.fromShards([shard(fabio), shard(vitest)]));
    expect(planned.retired).toStrictEqual([]);
    expect(planned.artifacts[2]?.content).toBe(renderRegistryProjection(table, ["vitest"]));
    expect(renderRegistryProjection(["vitest"])(table)).toContain(
      `    iri: "${IdentityAuthority}vitest/TestHang",\n    curie: "vitest:TestHang",`
    );
    expect(renderRegistryProjection(table, ["fabio"])).toContain("export const RegistryTerms = {} as const");
    expect(
      issueKinds(
        planRegistryArtifacts(
          RegistryPlanInput.make({ layout, shardFiles: [fabioFile, vitestFile], committed: O.none() })
        )
      )
    ).toStrictEqual(["registry-shard-invalid"]);
  });

  it("retires the projection module of a package that no shard projects into", () => {
    const projecting = RegistryLayout.of("packages/identity", [
      RegistryProjectionTarget.of("@beep/test-runner", "packages/test-runner"),
    ]);
    const planned = Result.getOrThrow(
      planRegistryArtifacts(
        RegistryPlanInput.make({ layout: projecting, shardFiles: [fabioFile], committed: O.none() })
      )
    );
    expect(A.map(planned.artifacts, (artifact) => artifact.path)).toStrictEqual([layout.data, layout.snapshot]);
    expect(planned.retired).toStrictEqual(["packages/test-runner/src/internal/generated/RegistryTerms.ts"]);
  });

  it("refuses a regenerated snapshot that removes a term with no deprecation", () => {
    const grown = shardFile("fabio.json", { ...fabio, terms: ["Article", "Report"], bindings: [], deprecations: [] });
    const first = Result.getOrThrow(
      planRegistryArtifacts(RegistryPlanInput.make({ layout, shardFiles: [grown], committed: O.none() }))
    );
    const committed = O.fromUndefinedOr(first.artifacts[1]?.content);
    const detailsOf = (base: O.Option<BaseSnapshot>) => {
      const removed = planRegistryArtifacts(
        RegistryPlanInput.make({ layout, shardFiles: [fabioFile], committed, base })
      );
      expect(issueKinds(removed)).toStrictEqual(["registry-snapshot-break"]);
      return Result.isFailure(removed) ? A.map(removed.failure, (issue) => issue.detail) : [];
    };
    const removal = "http://purl.org/spar/fabio/Article is removed without a deprecation.";
    const remedy =
      "Restore the IRI, or retire it with `bun run beep identity deprecate`, the only writer of a term's deprecation.";
    const write = "`bun run beep identity registry --write";
    expect(
      detailsOf(O.none()),
      "A check knows only the committed snapshot, so it leaves the verdict to the writer, which reads the base."
    ).toStrictEqual([
      `Against the committed snapshot: ${removal} Run ${write}\`, which judges the change against its base ref.`,
    ]);
    expect(detailsOf(BaseSnapshot.makeOption({ snapshot: first.snapshot }))).toStrictEqual([
      `Against the base ref: ${removal} ${remedy}`,
    ]);
    expect(detailsOf(BaseSnapshot.makeOption({ snapshot: TermSnapshot.empty, ref: O.some("main") }))).toStrictEqual([
      `Against the committed snapshot: ${removal} ${remedy} If no branch published it either, remove ${layout.snapshot} and run ${write} --base main\`.`,
    ]);
    const deprecated = shardFile("fabio.json", {
      ...fabio,
      bindings: [],
      deprecations: [{ term: "http://purl.org/spar/fabio/Article", since: "2.0.0" }],
    });
    assertTrue(
      planRegistryArtifacts(RegistryPlanInput.make({ layout, shardFiles: [deprecated], committed })).pipe(
        Result.isSuccess
      )
    );
  });

  it("succeeds a base that publishes a term set, whatever the committed snapshot holds", () => {
    const planOf = (terms: ReadonlyArray<string>, committed: O.Option<string>, base: O.Option<BaseSnapshot>) =>
      planRegistryArtifacts(
        RegistryPlanInput.make({
          layout,
          shardFiles: [shardFile("fabio.json", { ...fabio, terms, bindings: [], deprecations: [] })],
          committed,
          base,
        })
      );
    const first = Result.getOrThrow(planOf(["Report"], O.none(), O.none()));
    const base = BaseSnapshot.makeOption({ snapshot: first.snapshot });
    const textOf = (plan: RegistryPlan) => O.some(renderTermSnapshot(plan.snapshot));

    const grown = Result.getOrThrow(planOf(["Article", "Report"], textOf(first), base));
    expect(grown.snapshot.release).toBe("1.1.0");
    const again = Result.getOrThrow(planOf(["Article", "Report", "Thesis"], textOf(grown), base));
    expect(again.snapshot.release).toBe("1.1.0");
    expect(
      Result.getOrThrow(planOf(["Report"], textOf(again), base)),
      "A row the base never published goes again, and with it the bump."
    ).toStrictEqual(first);
    expect(
      Result.getOrThrow(planOf(["Article", "Report"], O.some("<<<<<<<"), base)),
      "A committed snapshot that does not decode, such as one with conflict markers, is regenerated from the base."
    ).toStrictEqual(grown);
    const unpublished = BaseSnapshot.makeOption({ snapshot: TermSnapshot.empty });
    expect(
      Result.getOrThrow(planOf(["Article", "Report", "Thesis"], textOf(grown), unpublished)).snapshot.release,
      "A base that publishes nothing leaves the registry unreleased: a writer keeps the committed release."
    ).toBe("1.1.0");
    expect(Result.getOrThrow(planOf(["Report"], O.none(), unpublished)).snapshot.release).toBe("1.0.0");
    expect(Result.getOrThrow(planOf(["Article", "Report", "Thesis"], textOf(grown), O.none())).snapshot.release).toBe(
      "1.2.0"
    );
  });
});

describe("driftIssues", () => {
  it("reports missing and changed artifacts and accepts equal ones", () => {
    const planned = RegistryPlan.make({
      snapshot: TermSnapshot.empty,
      artifacts: [
        RegistrySourceFile.make({ path: "a", content: "1" }),
        RegistrySourceFile.make({ path: "b", content: "2" }),
        RegistrySourceFile.make({ path: "c", content: "3" }),
      ],
      retired: [],
    });
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

  it("reports a retired projection module only while a generated projection is at its path", () => {
    const plan = RegistryPlan.make({ snapshot: TermSnapshot.empty, artifacts: [], retired: ["p"] });
    const empty = Result.getOrThrow(RegistryTable.fromShards([shard(fabio)]));
    expect(driftIssues(plan, () => O.none())).toStrictEqual([]);
    expect(driftIssues(plan, () => O.some("export const RegistryTerms = {};\n"))).toStrictEqual([]);
    expect(
      A.map(
        driftIssues(plan, () => O.some(renderRegistryProjection(empty, []))),
        issueLine
      )
    ).toStrictEqual([
      "p [registry-generated-drift] No shard projects into this package any more. Run `bun run beep identity registry --write` to regenerate.",
    ]);
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
        expect(committed).toStrictEqual(
          RegistryLayout.of("packages/foundation/modeling/identity", [
            RegistryProjectionTarget.of("@beep/test-runner", "packages/tooling/test-kit/test-runner"),
          ])
        );
        const plan = yield* planRegistry(repoRoot, committed, O.none());
        for (const artifact of Result.getOrThrow(plan).artifacts) {
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

    it.effect("checks without a base, writes against one, and refuses --check with --base or --write", () =>
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
          const based = yield* Effect.exit(runIdentityCommand(["registry", "--check", "--base", "HEAD"]));
          expectReportedExit(based);
          const defaultBased = yield* Effect.exit(runIdentityCommand(["registry", "--base", "HEAD"]));
          expectReportedExit(defaultBased);
          const refusals = yield* TestConsole.errorLines;
          expect(refusals).toContain("identity registry: pass --write or --check, not both.");
          expect(
            A.filter(refusals, (line) =>
              Str.startsWith("identity registry: --base applies only to --write;")(String(line))
            )
          ).toHaveLength(2);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("fails outside a repository", () =>
      Effect.gen(function* () {
        const directory = yield* temporaryWorkingDirectory;

        const error = yield* runIdentityCommand(["registry"]).pipe(withAncestorsHidden(directory), Effect.flip);

        expect(error).toMatchObject({
          _tag: "IdentityRegistryGeneratorError",
          message: "Cannot find the repository root.",
        });
      })
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

    it.effect("finds the codes whose package, module or module path the checkout does not have", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* writeFixture([]);
          yield* fs.makeDirectory("packages/widget/src/Nested", { recursive: true });
          yield* fs.writeFileString(
            "packages/widget/package.json",
            `${encodeJson({ name: "@beep/widget", version: "0.0.0", type: "module" })}\n`
          );
          yield* fs.writeFileString("packages/widget/src/Report.ts", "export const report = 1;\n");
          yield* fs.writeFileString("packages/widget/src/View.tsx", "export const view = 1;\n");
          yield* fs.writeFileString("packages/widget/src/Nested/index.ts", "export const nested = 1;\n");
          yield* fs.makeDirectory("packages/widget/src/Runner.ts", { recursive: true });
          yield* fs.makeDirectory("packages/widget/src/Panel/index.ts", { recursive: true });
          const root = yield* Effect.sync(() => process.cwd());

          const dangling = yield* danglingBindingCodes(root, [
            "@beep/widget/Report/Report",
            "@beep/widget/View/View.title",
            "@beep/widget/Nested/Section",
            "@beep/widget/Gone/Report",
            "@beep/nowhere/Report/Report",
            "@beep/widget/Report",
            "@beep",
            "@beep/widget/Runner/TestHang",
            "@beep/widget/Panel/Title",
            "@beep/widget/Report.ts/Report",
            "@beep/widget/../src/Report/Report",
            "@beep/widget/./Report/Report",
          ]);

          expect(
            dangling,
            "Directories named like a module file, and a regular file where a directory would hold index.ts. A module the package does not have, a package the checkout does not have, and codes whose only segment is the member, or that have none, so they name no module at all. Dot-only segments are no code identity, even where the joined path reaches a real module."
          ).toStrictEqual([
            "@beep/widget/Gone/Report",
            "@beep/nowhere/Report/Report",
            "@beep/widget/Report",
            "@beep",
            "@beep/widget/Runner/TestHang",
            "@beep/widget/Panel/Title",
            "@beep/widget/Report.ts/Report",
            "@beep/widget/../src/Report/Report",
            "@beep/widget/./Report/Report",
          ]);
        })
      )
    );

    it.effect("fails, and does not call the code dangling, when a module file cannot be statted", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* writeFixture([]);
          const root = yield* Effect.sync(() => process.cwd());
          const denied = PlatformError.systemError({
            _tag: "PermissionDenied",
            module: "FileSystem",
            method: "stat",
          });
          const unstattable = FileSystem.FileSystem.of({
            ...fs,
            stat: Effect.fn("IdentityRegistryTest.deniedStat")((file) =>
              Str.endsWith("src/Report.ts")(file) ? Effect.fail(denied) : fs.stat(file)
            ),
          });

          const error = yield* danglingBindingCodes(root, ["@beep/identity/Report/Report"]).pipe(
            Effect.provideService(FileSystem.FileSystem, unstattable),
            Effect.flip
          );

          expect(error._tag).toBe("IdentityRegistryGeneratorError");
          expect(error.message).toMatch(/^Cannot stat .*src\/Report\.ts\.$/);
        })
      )
    );

    it.effect("raises a snapshot released below a since its rows record, and reports one wound back as drift", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* writeFixture([
            [
              "fabio.json",
              {
                ...fabio,
                bindings: [{ code: "@beep/identity/Report/Report", local: "Report", since: "9.0.0" }],
                deprecations: [],
              },
            ],
          ]);
          yield* fs.makeDirectory("packages/identity/src", { recursive: true });
          yield* fs.writeFileString("packages/identity/src/Report.ts", "export const report = 1;\n");
          yield* runIdentityCommand(["registry", "--write"]);

          const raised = yield* fs.readFileString(layout.snapshot);
          expect(raised).toContain('"release": "9.0.0"');
          yield* runIdentityCommand(["registry", "--check"]);
          yield* fs.writeFileString(layout.snapshot, Str.replace('"release": "9.0.0"', '"release": "1.0.0"')(raised));

          const woundBack = yield* Effect.exit(runIdentityCommand(["registry", "--check"]));

          expectReportedExit(woundBack);
          const errors = yield* TestConsole.errorLines;
          expect(errors).toContain(
            `${layout.snapshot} [registry-generated-drift] The generated artifact differs from regeneration. Run \`bun run beep identity registry --write\` to regenerate.`
          );
          yield* runIdentityCommand(["registry", "--write"]);
          const repaired = yield* fs.readFileString(layout.snapshot);
          expect(repaired).toBe(raised);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("removes the projection module of a package its last shard stops projecting into, and only that", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const projection = "packages/test-runner/src/internal/generated/RegistryTerms.ts";
          const vitest = {
            namespace: { prefix: "vitest", iri: "https://example.test/vitest/" },
            terms: ["TestHang"],
            bindings: [{ code: "@beep/test-runner/Vitest/TestHang", local: "TestHang", since: "1.0.0" }],
            deprecations: [],
          };
          const projecting = { ...vitest, projection: "@beep/test-runner" };
          const alsoProjecting = { ...fabio, bindings: [], deprecations: [], projection: "@beep/test-runner" };
          yield* writeFixture([
            ["fabio.json", alsoProjecting],
            ["vitest.json", projecting],
          ]);
          yield* fs.makeDirectory("packages/test-runner/src", { recursive: true });
          yield* fs.writeFileString(
            "packages/test-runner/package.json",
            `${encodeJson({ name: "@beep/test-runner", version: "0.0.0", type: "module" })}\n`
          );
          yield* fs.writeFileString("packages/test-runner/src/Vitest.ts", "export const hang = 1;\n");
          yield* runIdentityCommand(["registry", "--write"]);
          yield* runIdentityCommand(["registry", "--check"]);

          yield* fs.writeFileString(
            `${layout.shards}/fabio.json`,
            renderRegistryJson({ ...fabio, bindings: [], deprecations: [] })
          );
          yield* runIdentityCommand(["registry", "--write"]);
          const kept = yield* fs.readFileString(projection);
          expect(kept).toContain('"@beep/test-runner/Vitest/TestHang"');

          yield* fs.writeFileString(`${layout.shards}/vitest.json`, renderRegistryJson(vitest));
          const stale = yield* Effect.exit(runIdentityCommand(["registry", "--check"]));
          expectReportedExit(stale);
          const errors = yield* TestConsole.errorLines;
          expect(errors).toContain(
            `${projection} [registry-generated-drift] No shard projects into this package any more. Run \`bun run beep identity registry --write\` to regenerate.`
          );
          yield* runIdentityCommand(["registry", "--write"]);
          const removed = yield* fs.exists(projection);
          expect(removed).toBe(false);
          const logs = yield* TestConsole.logLines;
          expect(logs).toContain(`[identity:registry] removed ${projection}.`);
          yield* runIdentityCommand(["registry", "--check"]);

          yield* fs.writeFileString(projection, "export const RegistryTerms = {};\n");
          yield* runIdentityCommand(["registry", "--check"]);
          yield* runIdentityCommand(["registry", "--write"]);
          const authored = yield* fs.readFileString(projection);
          expect(authored, "A file the generator did not write at the same path is neither drift nor removed.").toBe(
            "export const RegistryTerms = {};\n"
          );
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("says which projection module it cannot remove", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const target = RegistryProjectionTarget.of("@beep/test-runner", "packages/test-runner");
          yield* writeFixture([["fabio.json", { ...fabio, bindings: [], deprecations: [] }]]);
          yield* fs.makeDirectory("packages/test-runner/src/internal/generated", { recursive: true });
          const table = Result.getOrThrow(RegistryTable.fromShards([shard(fabio)]));
          yield* fs.writeFileString(target.path, renderRegistryProjection(table, []));
          const root = yield* Effect.sync(() => process.cwd());
          const unremovable = FileSystem.FileSystem.of({
            ...fs,
            remove: Effect.fn("IdentityRegistryTest.deniedRemove")(() =>
              Effect.fail(
                PlatformError.systemError({ _tag: "PermissionDenied", module: "FileSystem", method: "remove" })
              )
            ),
          });

          const error = yield* writeRegistry(
            root,
            RegistryLayout.of("packages/identity", [target]),
            BaseSnapshot.make({ snapshot: TermSnapshot.empty })
          ).pipe(Effect.provideService(FileSystem.FileSystem, unremovable), Effect.flip);

          expect(
            error.message,
            "No shard was edited, so the failure names no recovery: the same command is the recovery."
          ).toBe(`Cannot remove ${target.path}.`);
        })
      )
    );

    it.effect("stages each write in a new directory, so no entry at a fixed staging path is followed", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* writeFixture([["fabio.json", { ...fabio, bindings: [], deprecations: [] }]]);
          const root = yield* Effect.sync(() => process.cwd());
          yield* fs.makeDirectory("outside", { recursive: true });
          yield* fs.writeFileString("outside/victim.txt", "untouched\n");
          yield* fs.makeDirectory(path.dirname(layout.data), { recursive: true });
          yield* fs.symlink(path.join(root, "outside/victim.txt"), `${layout.snapshot}.tmp`);
          yield* fs.writeFileString(`${layout.data}.tmp`, "stale\n");

          yield* runIdentityCommand(["registry", "--write"]);

          const victim = yield* fs.readFileString("outside/victim.txt");
          const stale = yield* fs.readFileString(`${layout.data}.tmp`);
          const written = yield* fs.readFileString(layout.snapshot);
          expect(victim, "A link and a stale file where a fixed staging path would be.").toBe("untouched\n");
          expect(stale).toBe("stale\n");
          expect(written).toContain('"release": "1.0.0"');
          for (const directory of [path.dirname(layout.snapshot), path.dirname(layout.data)]) {
            const entries = yield* fs.readDirectory(directory);
            expect(A.filter(entries, Str.includes(".staging-")), directory).toStrictEqual([]);
          }
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses an edit that names no shard, or names one shard twice, and writes nothing", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* writeFixture([["fabio.json", { ...fabio, bindings: [], deprecations: [] }]]);
          const root = yield* Effect.sync(() => process.cwd());
          const base = BaseSnapshot.make({ snapshot: TermSnapshot.empty });
          const stray = shardFile("skos.json", {
            namespace: { prefix: "skos", iri: "http://www.w3.org/2004/02/skos/core#" },
            terms: ["prefLabel"],
            bindings: [],
            deprecations: [],
          });

          const unknown = yield* writeRegistry(root, layout, base, [stray]);
          const twice = yield* writeRegistry(root, layout, base, [fabioFile, fabioFile]);

          assertFailure(Result.mapError(unknown, A.map(issueLine)), [
            `${stray.path} [registry-shard-invalid] The edit names no shard of the registry; an edit replaces a shard.`,
          ]);
          assertFailure(Result.mapError(twice, A.map(issueLine)), [
            `${fabioFile.path} [registry-shard-invalid] 2 edits name this shard; an edit names each shard once.`,
          ]);
          const present = yield* Effect.forEach([stray.path, layout.data, layout.snapshot], (file) => fs.exists(file), {
            concurrency: 1,
          });
          expect(present).toStrictEqual([false, false, false]);
        })
      )
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
          expect(logs).toContain(
            "Identity registry commands: bun run beep identity registry [--write [--base <ref>] | --check], identity rebind <from> <to> [--base <ref>], identity deprecate <curie> [--replacement <curie>] [--base <ref>]"
          );
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});
