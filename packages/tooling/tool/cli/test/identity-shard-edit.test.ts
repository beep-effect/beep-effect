import { fcRuns } from "@beep/fc-runs";
import { CodeId, RegistryShard, RegistryTable, snapshotViolations, TermLocal, TermSnapshot } from "@beep/identity/Term";
import { identityCommand } from "@beep/repo-cli/commands/Identity";
import {
  baseSnapshotIssues,
  decodeBaseSnapshot,
  RegistryLayout,
  RegistrySourceFile,
  renderRegistryJson,
} from "@beep/repo-cli/commands/Identity/Registry";
import {
  DeprecateRequest,
  planDeprecate,
  planRebind,
  RebindRequest,
  readShardEditInput,
  ShardEditInput,
} from "@beep/repo-cli/commands/Identity/ShardEdit";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFailure, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { expectReportedExit, NodeTestLayer, temporaryWorkingDirectory } from "./support/CommandTest.ts";
import type { ShardEditRefusal } from "@beep/repo-cli/commands/Identity/ShardEdit";

const runIdentityCommand = Command.runWith(identityCommand, { version: "0.0.0" });
const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

const layout = RegistryLayout.of("packages/identity");

// A term local that forms an IRI under any namespace, so every generated shard decodes.
const AsciiLocal = TermLocal.check(S.isPattern(/^[A-Za-z][A-Za-z0-9]{0,8}$/));

const shardFile = (shard: RegistryShard.Encoded): RegistrySourceFile =>
  RegistrySourceFile.make({
    path: `${layout.shards}/${shard.namespace.prefix}.json`,
    content: renderRegistryJson(shard),
  });

const fabio = (
  terms: ReadonlyArray<string>,
  bindings: RegistryShard.Encoded["bindings"] = []
): RegistryShard.Encoded => ({
  namespace: { prefix: "fabio", iri: "http://purl.org/spar/fabio/" },
  terms,
  bindings,
  deprecations: [],
});

const decodeShardJson = S.decodeResult(S.fromJsonString(RegistryShard));

const decodeShardText = (file: RegistrySourceFile): RegistryShard => Result.getOrThrow(decodeShardJson(file.content));

const tableOf = (files: ReadonlyArray<RegistrySourceFile>): RegistryTable =>
  Result.getOrThrow(RegistryTable.fromShards(A.map(files, decodeShardText)));

const inputOf = (files: ReadonlyArray<RegistrySourceFile>, previous: TermSnapshot = TermSnapshot.empty) =>
  ShardEditInput.make({ layout, shardFiles: files, previous });

const reasonsOf = (result: Result.Result<unknown, ReadonlyArray<{ readonly reason: string }>>) =>
  Result.match(result, { onFailure: A.map((refusal) => refusal.reason), onSuccess: () => [] });

// Every refusal of a plan as `[reason, subject, detail]`.
const refusalRowsOf = <Planned>(result: Result.Result<Planned, A.NonEmptyReadonlyArray<ShardEditRefusal>>) =>
  Result.mapError(
    result,
    A.map((refusal) => [refusal.reason, refusal.subject, refusal.detail])
  );

const doco = (fields: Partial<RegistryShard.Encoded> = {}): RegistryShard.Encoded => ({
  namespace: { prefix: "doco", iri: "http://purl.org/spar/doco/" },
  terms: ["Section"],
  bindings: [],
  deprecations: [],
  ...fields,
});

const bound = [
  { code: "@beep/widget/Old/Report", local: "Report", since: "1.0.0" },
  { code: "@beep/widget/Old/Report/Section", local: "Section", since: "1.0.0" },
  { code: "@beep/widget/Other/Note", local: "Note", since: "1.0.0" },
];
const bindingFixture = shardFile(fabio(["Note", "Report", "Section"], bound));

const rebind = (from: string, to: string) => RebindRequest.make({ from: CodeId.make(from), to: CodeId.make(to) });

describe("identity rebind planning", () => {
  it("moves the code and every code under it, and leaves the rest bound where it was", () => {
    const [edited] = Result.getOrThrow(
      planRebind(inputOf([bindingFixture]), rebind("@beep/widget/Old", "@beep/widget/New"))
    );
    expect(edited?.path).toBe(bindingFixture.path);
    const codes = A.map(decodeShardText(edited ?? bindingFixture).bindings, (binding) => binding.code);
    expect(codes).toStrictEqual([
      "@beep/widget/New/Report",
      "@beep/widget/New/Report/Section",
      "@beep/widget/Other/Note",
    ]);
  });

  it("refuses a move that finds no binding and a move onto a bound code", () => {
    expect(
      reasonsOf(planRebind(inputOf([bindingFixture]), rebind("@beep/widget/Gone", "@beep/widget/New")))
    ).toStrictEqual(["nothing-bound"]);
    expect(
      reasonsOf(planRebind(inputOf([bindingFixture]), rebind("@beep/widget/Other/Note", "@beep/widget/Old/Report")))
    ).toStrictEqual(["registry-conflict"]);
  });

  it("moves the exact code of one binding", () => {
    const [edited] = Result.getOrThrow(
      planRebind(inputOf([bindingFixture]), rebind("@beep/widget/Other/Note", "@beep/widget/Memo/Note"))
    );
    expect(
      A.map(decodeShardText(edited ?? bindingFixture).bindings, (binding) => [binding.code, binding.local])
    ).toStrictEqual([
      ["@beep/widget/Memo/Note", "Note"],
      ["@beep/widget/Old/Report", "Report"],
      ["@beep/widget/Old/Report/Section", "Section"],
    ]);
  });

  it("refuses shards that conflict before any move", () => {
    const clash = shardFile(doco({ namespace: { prefix: "fab", iri: "http://purl.org/spar/fabio/" }, terms: [] }));
    assertFailure(
      refusalRowsOf(planRebind(inputOf([bindingFixture, clash]), rebind("@beep/widget/Old", "@beep/widget/New"))),
      [
        [
          "registry-conflict",
          layout.shards,
          "Namespace IRI http://purl.org/spar/fabio/ is declared under more than one prefix (fab, fabio).",
        ],
      ]
    );
  });

  it("refuses an invalid shard", () => {
    const broken = RegistrySourceFile.make({ path: `${layout.shards}/fabio.json`, content: "{}" });
    expect(reasonsOf(planRebind(inputOf([broken]), rebind("@beep/widget/Old", "@beep/widget/New")))).toStrictEqual([
      "shard-invalid",
    ]);
  });
});

describe("identity deprecate planning", () => {
  const plain = shardFile(fabio(["Note", "Report", "TechnicalReport"]));
  const previous = RegistryTable.snapshot(tableOf([plain]), TermSnapshot.empty);

  it("retires the term with the release the regenerated snapshot carries", () => {
    const [edited] = Result.getOrThrow(
      planDeprecate(
        inputOf([plain], previous),
        DeprecateRequest.make({ curie: "fabio:TechnicalReport", replacement: O.some("fabio:Report") })
      )
    );
    const shard = decodeShardText(edited ?? plain);
    expect(shard.terms).toStrictEqual(["Note", "Report"]);
    expect(A.map(shard.deprecations, (row) => [row.term, row.since])).toStrictEqual([
      ["http://purl.org/spar/fabio/TechnicalReport", "2.0.0"],
    ]);
    assertSome(
      O.flatMap(A.head(shard.deprecations), (row): O.Option<string> => row.replacement),
      "Report"
    );
    const next = RegistryTable.snapshot(tableOf([edited ?? plain]), previous);
    expect(next.release).toBe("2.0.0");
    expect(snapshotViolations(previous, next)).toStrictEqual([]);
  });

  it("keeps the deprecations ascending and rewrites only the shard of the term", () => {
    const retiredFirst = shardFile({
      ...fabio(["Note", "Report"]),
      deprecations: [{ term: "http://purl.org/spar/fabio/Thesis", since: "1.0.0", replacement: "Report" }],
    });
    const edited = Result.getOrThrow(
      planDeprecate(
        inputOf([shardFile(doco()), retiredFirst]),
        DeprecateRequest.make({ curie: "fabio:Note", replacement: O.none() })
      )
    );
    expect(A.map(edited, (file) => file.path)).toStrictEqual([retiredFirst.path]);
    expect(
      A.map(decodeShardText(edited[0] ?? retiredFirst).deprecations, (row) => [row.term, O.getOrNull(row.replacement)])
    ).toStrictEqual([
      ["http://purl.org/spar/fabio/Note", null],
      ["http://purl.org/spar/fabio/Thesis", "Report"],
    ]);
  });

  it("refuses a retirement the rest of the registry contradicts", () => {
    const retire = (files: ReadonlyArray<RegistrySourceFile>) =>
      refusalRowsOf(
        planDeprecate(inputOf(files), DeprecateRequest.make({ curie: "fabio:Report", replacement: O.none() }))
      );
    // The other shard already retired the IRI.
    const elsewhere = shardFile(
      doco({ deprecations: [{ term: "http://purl.org/spar/fabio/Report", since: "1.0.0" }] })
    );
    assertFailure(retire([plain, elsewhere]), [
      ["registry-conflict", layout.shards, "Term http://purl.org/spar/fabio/Report is deprecated more than once."],
    ]);
    // An earlier retirement names the term as its successor.
    const chained = shardFile({
      ...fabio(["Report"]),
      deprecations: [{ term: "http://purl.org/spar/fabio/Thesis", since: "1.0.0", replacement: "Report" }],
    });
    assertFailure(retire([chained]), [
      [
        "registry-conflict",
        layout.shards,
        "The replacement chain of http://purl.org/spar/fabio/Thesis reaches http://purl.org/spar/fabio/Report, which is neither a declared term nor deprecated with a successor.",
      ],
    ]);
    // The same shard lists the term live and retired, so the edited rows repeat a deprecation.
    const repeated = shardFile({
      ...fabio(["Report"]),
      deprecations: [{ term: "http://purl.org/spar/fabio/Report", since: "1.0.0" }],
    });
    const refused = retire([repeated]);
    assertFailure(
      Result.mapError(
        refused,
        A.map(([reason, subject]) => [reason, subject])
      ),
      [["shard-invalid", repeated.path]]
    );
    expect(Result.match(refused, { onFailure: (rows) => rows[0][2], onSuccess: () => "" })).toContain(
      "Expected ShardDeprecation rows strictly ascending by key, with no duplicate."
    );
  });

  it("refuses the namespace itself as the successor of a retired term", () => {
    const refused = planDeprecate(
      inputOf([plain], previous),
      DeprecateRequest.make({ curie: "fabio:Note", replacement: O.some("fabio:") })
    );
    expect(reasonsOf(refused)).toStrictEqual(["replacement-unknown"]);
    assertFailure(
      Result.mapError(
        refused,
        A.map((refusal) => refusal.detail)
      ),
      ['A term is succeeded by a term, never by its namespace IRI; name a live term of "fabio".']
    );
  });

  it("refuses a malformed CURIE, an unknown or bound term, and a replacement it cannot record", () => {
    const refusalOf = (curie: string, replacement: O.Option<string> = O.none()) =>
      reasonsOf(planDeprecate(inputOf([plain]), DeprecateRequest.make({ curie, replacement })));
    const twoShards = [
      plain,
      shardFile({ ...fabio(["Report"]), namespace: { prefix: "doco", iri: "http://purl.org/spar/doco/" } }),
    ];
    expect(refusalOf("TechnicalReport")).toStrictEqual(["invalid-curie"]);
    expect(
      reasonsOf(
        planDeprecate(inputOf(twoShards), DeprecateRequest.make({ curie: "fabio:Gone", replacement: O.none() }))
      )
    ).toStrictEqual(["unknown-term"]);
    expect(
      reasonsOf(
        planDeprecate(
          inputOf(twoShards),
          DeprecateRequest.make({ curie: "fabio:Note", replacement: O.some("doco:Report") })
        )
      )
    ).toStrictEqual(["replacement-outside-namespace"]);
    expect(
      reasonsOf(
        planDeprecate(
          inputOf([plain]),
          DeprecateRequest.make({ curie: "fabio:Note", replacement: O.some("fabio:Note") })
        )
      )
    ).toStrictEqual(["replacement-unknown"]);
    expect(
      reasonsOf(
        planDeprecate(
          inputOf([bindingFixture]),
          DeprecateRequest.make({ curie: "fabio:Report", replacement: O.none() })
        )
      )
    ).toStrictEqual(["term-bound"]);
  });

  it.prop(
    "deprecating any live term leaves no break against the snapshot it succeeds",
    [S.Array(AsciiLocal).check(S.isMinLength(1), S.isMaxLength(5))],
    ([locals]) => {
      const terms = A.sort(A.dedupe(locals), Order.String);
      const file = shardFile(fabio(terms));
      const before = RegistryTable.snapshot(tableOf([file]), TermSnapshot.empty);
      const [retired = "", ...rest] = terms;
      const [edited] = Result.getOrThrow(
        planDeprecate(
          inputOf([file], before),
          DeprecateRequest.make({
            curie: `fabio:${retired}`,
            replacement: O.map(A.head(rest), (local) => `fabio:${local}`),
          })
        )
      );
      const after = RegistryTable.snapshot(tableOf([edited ?? file]), before);
      expect(snapshotViolations(before, after)).toStrictEqual([]);
      expect(baseSnapshotIssues(before, after, layout.snapshot)).toStrictEqual([]);
      expect(after.release).toBe("2.0.0");
    },
    { arbitrary: fcRuns(25) }
  );
});

describe("base snapshot findings", () => {
  it("reads an absent base as the empty snapshot and refuses a base that does not decode", () => {
    const absent = Result.getOrThrow(decodeBaseSnapshot(layout.snapshot, O.none()));
    expect(absent.release).toBe(TermSnapshot.empty.release);
    expect(absent.terms).toHaveLength(0);
    const broken = decodeBaseSnapshot(layout.snapshot, O.some("{}"));
    assertSome(
      O.map(Result.getFailure(broken), (issue) => issue.kind),
      "registry-generated-drift"
    );
  });

  it("names a removal and a prefix change against the base", () => {
    const base = RegistryTable.snapshot(tableOf([shardFile(fabio(["Report", "TechnicalReport"]))]), TermSnapshot.empty);
    const removed = RegistryTable.snapshot(tableOf([shardFile(fabio(["Report"]))]), base);
    expect(A.map(baseSnapshotIssues(base, removed, layout.snapshot), (issue) => issue.kind)).toStrictEqual([
      "term-removed-without-deprecation",
    ]);
    // A head regenerated from an older base keeps that base's release, which the change outgrew.
    const stale = RegistryTable.snapshot(
      tableOf([shardFile(fabio(["Report", "TechnicalReport", "Thesis"]))]),
      TermSnapshot.empty
    );
    const [understated] = baseSnapshotIssues(base, stale, layout.snapshot);
    expect(understated?.kind).toBe("release-regressed");
    expect(understated?.detail).toContain("the change calls for 1.1.0");
    expect(understated?.detail).toContain("bun run beep identity registry --write");
    const renamed = RegistryTable.snapshot(
      tableOf([
        shardFile({
          ...fabio(["Report", "TechnicalReport"]),
          namespace: { prefix: "fab", iri: "http://purl.org/spar/fabio/" },
        }),
      ]),
      base
    );
    expect(A.map(baseSnapshotIssues(base, renamed, layout.snapshot), (issue) => issue.kind)).toStrictEqual([
      "namespace-prefix-changed",
    ]);
  });
});

it.layer(NodeTestLayer, { concurrent: false, timeout: "60 seconds" })((it) => {
  describe("identity shard edit commands", { concurrent: false }, () => {
    const fabioPath = `${layout.shards}/fabio.json`;
    const writeFixture = Effect.fn("IdentityShardEditTest.writeFixture")(function* (shard: RegistryShard.Encoded) {
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
      yield* fs.writeFileString(fabioPath, renderRegistryJson(shard));
    });
    const deprecateNote = ["deprecate", "fabio:Note", "--replacement", "fabio:Report"];

    it.effect("deprecates in a checkout with no committed snapshot and publishes the first release", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* writeFixture(fabio(["Note", "Report"]));

          yield* runIdentityCommand(deprecateNote);

          const logs = yield* TestConsole.logLines;
          expect(logs).toStrictEqual([
            `[identity:deprecate] rewrote ${fabioPath}`,
            `[identity:deprecate] regenerated ${layout.data}`,
            `[identity:deprecate] regenerated ${layout.snapshot}`,
          ]);
          const shardText = yield* fs.readFileString(fabioPath);
          expect(shardText).toBe(
            renderRegistryJson({
              ...fabio(["Report"]),
              deprecations: [{ term: "http://purl.org/spar/fabio/Note", since: "1.0.0", replacement: "Report" }],
            })
          );
          const snapshotText = yield* fs.readFileString(layout.snapshot);
          expect(snapshotText).toContain('"release": "1.0.0"');
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses to edit over a committed snapshot that does not decode", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const shard = fabio(["Note", "Report"]);
          yield* writeFixture(shard);
          yield* fs.writeFileString(layout.snapshot, "{}");

          const refused = yield* Effect.exit(runIdentityCommand(deprecateNote));

          expectReportedExit(refused);
          const errors = yield* TestConsole.errorLines;
          expect(errors).toContainEqual(
            expect.stringContaining(
              `${layout.snapshot} [registry-generated-drift] The base ref's snapshot does not decode:`
            )
          );
          const untouched = yield* fs.readFileString(fabioPath);
          expect(untouched).toBe(renderRegistryJson(shard));
          const dataWritten = yield* fs.exists(layout.data);
          expect(dataWritten).toBe(false);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("fails with the file it cannot read when the snapshot path is a directory", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* writeFixture(fabio(["Note", "Report"]));
          yield* fs.makeDirectory(layout.snapshot);
          const root = yield* Effect.sync(() => process.cwd());

          const error = yield* Effect.flip(readShardEditInput(root));

          expect(error._tag).toBe("IdentityRegistryGeneratorError");
          expect(error.message).toBe(`Cannot read ${layout.snapshot}.`);
          expect(error.cause).toMatchObject({ _tag: "PlatformError" });
        })
      )
    );

    it.effect("leaves the checkout as it was when the edited shards do not regenerate", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          // The shard projects into a package this checkout does not have, which only regeneration checks.
          const shard = { ...fabio(["Note", "Report"]), projection: "@beep/test-runner" } as const;
          yield* writeFixture(shard);

          const refused = yield* Effect.exit(runIdentityCommand(deprecateNote));

          expectReportedExit(refused);
          const errors = yield* TestConsole.errorLines;
          expect(errors).toStrictEqual([
            `${fabioPath} [registry-shard-invalid] The shard projects into @beep/test-runner, which this checkout does not have.`,
          ]);
          const logs = yield* TestConsole.logLines;
          expect(logs).toStrictEqual([]);
          const untouched = yield* fs.readFileString(fabioPath);
          expect(untouched).toBe(renderRegistryJson(shard));
          const dataWritten = yield* fs.exists(layout.data);
          expect(dataWritten).toBe(false);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses a rebind whose source or target is not a code identity", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const shard = fabio(["Report"], [{ code: "@beep/widget/Old/Report", local: "Report", since: "1.0.0" }]);
          yield* writeFixture(shard);

          const badSource = yield* Effect.exit(runIdentityCommand(["rebind", "widget/Old", "@beep/widget/New"]));
          expectReportedExit(badSource);
          const badTarget = yield* Effect.exit(runIdentityCommand(["rebind", "@beep/widget/Old", "widget/New"]));
          expectReportedExit(badTarget);

          const errors = yield* TestConsole.errorLines;
          expect(errors).toStrictEqual([
            "[identity:rebind] refused: 1 reason(s).",
            "widget/Old [invalid-code] Expected a code identity of the form @beep/<package>/<path>.",
            "[identity:rebind] refused: 1 reason(s).",
            "widget/New [invalid-code] Expected a code identity of the form @beep/<package>/<path>.",
          ]);
          const untouched = yield* fs.readFileString(fabioPath);
          expect(untouched).toBe(renderRegistryJson(shard));
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});
