import { fcRuns } from "@beep/fc-runs";
import {
  CodeId,
  CodeIdMove,
  CodePackage,
  CodePackageMove,
  RegistryShard,
  RegistryTable,
  ReleaseVersion,
  snapshotViolations,
  TermLocal,
  TermSnapshot,
} from "@beep/identity/Term";
import { identityCommand } from "@beep/repo-cli/commands/Identity";
import {
  BaseSnapshot,
  baseSnapshotIssues,
  decodeBaseSnapshot,
  planRegistryArtifacts,
  RegistryLayout,
  RegistryPlanInput,
  RegistryProjectionTarget,
  RegistrySourceFile,
  regeneratedSnapshot,
  releasePolicy,
  renderRegistryJson,
  renderRegistryProjection,
  renderTermSnapshot,
} from "@beep/repo-cli/commands/Identity/Registry";
import {
  DeprecateRequest,
  planDeprecate,
  planRebind,
  readShardEditInput,
  ShardEditInput,
} from "@beep/repo-cli/commands/Identity/ShardEdit";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFailure, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as PlatformError from "effect/PlatformError";
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
import type { ShardEditRefusal } from "@beep/repo-cli/commands/Identity/ShardEdit";

const runIdentityCommand = Command.runWith(identityCommand, { version: "0.0.0" });
const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

const layout = RegistryLayout.of("packages/identity");
const PROJECTION_REMEDY =
  "After renaming the package, put its new name in the RegistryProjection literal (`@beep/identity/Term`) and in the shard's `projection`, then move its bindings with `bun run beep identity rebind @beep/<old package> @beep/<new package>`; otherwise drop the shard's `projection`.";

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

const decodeSnapshotText = flow(S.decodeUnknownResult(S.fromJsonString(TermSnapshot)), Result.getOrThrow);

const decodeShardText = (file: RegistrySourceFile): RegistryShard => Result.getOrThrow(decodeShardJson(file.content));

const tableOf = (files: ReadonlyArray<RegistrySourceFile>): RegistryTable =>
  Result.getOrThrow(RegistryTable.fromShards(A.map(files, decodeShardText)));

const inputOf = (files: ReadonlyArray<RegistrySourceFile>, previous: TermSnapshot = TermSnapshot.empty) =>
  ShardEditInput.make({ layout, shardFiles: files, previous });

const reasonsOf = (result: Result.Result<unknown, ReadonlyArray<{ readonly reason: string }>>) =>
  Result.match(result, { onFailure: A.map((refusal) => refusal.reason), onSuccess: () => [] });

const baseOf = (snapshot: TermSnapshot) => BaseSnapshot.make({ snapshot });

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

const rebind = (from: string, to: string) => CodeIdMove.make({ from: CodeId.make(from), to: CodeId.make(to) });

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

  it("moves every code of a renamed package, across shards, and no other package's", () => {
    const notes = shardFile(
      doco({ bindings: [{ code: "@beep/widget/Parts/Section", local: "Section", since: "1.0.0" }] })
    );
    const ui = shardFile({
      namespace: { prefix: "ui", iri: "https://example.test/ui/" },
      terms: ["Panel"],
      bindings: [{ code: "@beep/widget-ui/Panel/Panel", local: "Panel", since: "1.0.0" }],
      deprecations: [],
    });
    const moved = Result.getOrThrow(
      planRebind(
        inputOf([notes, bindingFixture, ui]),
        CodePackageMove.make({ from: CodePackage.make("@beep/widget"), to: CodePackage.make("@beep/gadget") })
      )
    );
    expect(
      A.map(moved, (file) => [file.path, A.map(decodeShardText(file).bindings, (binding) => binding.code)])
    ).toStrictEqual([
      [notes.path, ["@beep/gadget/Parts/Section"]],
      [bindingFixture.path, ["@beep/gadget/Old/Report", "@beep/gadget/Old/Report/Section", "@beep/gadget/Other/Note"]],
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

  it("records one release for every retirement of a change, and leaves the release", () => {
    const retire = (files: ReadonlyArray<RegistrySourceFile>, curie: string) =>
      Result.getOrThrow(
        planDeprecate(inputOf(files, previous), DeprecateRequest.make({ curie, replacement: O.none() }))
      );
    const once = retire([plain], "fabio:Note");
    const twice = retire(once, "fabio:Report");
    const shard = decodeShardText(twice[0] ?? plain);
    expect(A.map(shard.deprecations, (row) => [row.term, row.since])).toStrictEqual([
      ["http://purl.org/spar/fabio/Note", "2.0.0"],
      ["http://purl.org/spar/fabio/Report", "2.0.0"],
    ]);
    const next = RegistryTable.snapshot(tableOf(twice), previous);
    expect(next.release).toBe("2.0.0");
    expect(snapshotViolations(previous, next)).toStrictEqual([]);
  });

  it("keeps the committed release for every retirement over a base that publishes nothing", () => {
    const committed = TermSnapshot.make({ ...previous, release: ReleaseVersion.make("2.0.0") });
    const retire = (files: ReadonlyArray<RegistrySourceFile>, curie: string) =>
      Result.getOrThrow(
        planDeprecate(
          ShardEditInput.make({ layout, shardFiles: files, previous: committed, policy: "keep" }),
          DeprecateRequest.make({ curie, replacement: O.none() })
        )
      );
    const once = retire([plain], "fabio:Note");
    const afterOnce = regeneratedSnapshot(tableOf(once), "keep", committed);
    expect(afterOnce.release).toBe("2.0.0");
    const twice = Result.getOrThrow(
      planDeprecate(
        ShardEditInput.make({ layout, shardFiles: once, previous: afterOnce, policy: "keep" }),
        DeprecateRequest.make({ curie: "fabio:Report", replacement: O.none() })
      )
    );
    expect(A.map(decodeShardText(twice[0] ?? plain).deprecations, (row) => [row.term, row.since])).toStrictEqual([
      ["http://purl.org/spar/fabio/Note", "2.0.0"],
      ["http://purl.org/spar/fabio/Report", "2.0.0"],
    ]);
    expect(regeneratedSnapshot(tableOf(twice), "keep", afterOnce).release).toBe("2.0.0");
    // Succeeding the committed snapshot instead counts the second retirement again.
    expect(regeneratedSnapshot(tableOf(twice), "succeed", afterOnce).release).toBe("3.0.0");
    expect(pipe(tableOf(twice), regeneratedSnapshot("keep", afterOnce)).release).toBe("2.0.0");
    expect(releasePolicy(O.some(baseOf(TermSnapshot.empty)))).toBe("keep");
    expect(releasePolicy(O.some(baseOf(previous)))).toBe("succeed");
    expect(releasePolicy(O.none())).toBe("succeed");
    // A checkout with no base commit says nothing about what is published, so its writers succeed.
    expect(releasePolicy(BaseSnapshot.makeOption({ snapshot: TermSnapshot.empty, resolved: false }))).toBe("succeed");
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
    assertFailure(
      refusalRowsOf(
        planDeprecate(
          inputOf([bindingFixture]),
          DeprecateRequest.make({ curie: "fabio:Report", replacement: O.none() })
        )
      ),
      [
        [
          "term-bound",
          "fabio:Report",
          `fabio:Report is bound by @beep/widget/Old/Report; remove the binding from ${bindingFixture.path} before deprecating the term. A rebind does not help: it keeps the term bound.`,
        ],
      ]
    );
    // The refused remedy: a rebind leaves the term bound under its new code.
    const [rebound] = Result.getOrThrow(
      planRebind(inputOf([bindingFixture]), rebind("@beep/widget/Old", "@beep/widget/New"))
    );
    expect(
      reasonsOf(
        planDeprecate(
          inputOf([rebound ?? bindingFixture]),
          DeprecateRequest.make({ curie: "fabio:Report", replacement: O.none() })
        )
      )
    ).toStrictEqual(["term-bound"]);
    // The remedy it names: without the binding the term retires.
    assertTrue(
      planDeprecate(
        inputOf([shardFile(fabio(["Note", "Report", "Section"], A.drop(bound, 1)))]),
        DeprecateRequest.make({ curie: "fabio:Report", replacement: O.none() })
      ).pipe(Result.isSuccess)
    );
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
      expect(baseSnapshotIssues(baseOf(before), after, layout)).toStrictEqual([]);
      expect(after.release).toBe("2.0.0");
    },
    { arbitrary: fcRuns(25) }
  );
});

// One step of a change: declare a term, take back one the change declared, or retire one.
const ChangeStep = S.TaggedUnion({
  Declare: { local: AsciiLocal },
  TakeBack: { index: S.Int.check(S.isBetween({ minimum: 0, maximum: 5 })) },
  Retire: { index: S.Int.check(S.isBetween({ minimum: 0, maximum: 5 })) },
});

describe("a change in many steps", () => {
  const published = A.map(["Article", "Note", "Report", "Thesis"], (local) => `P${local}`);
  const baseFile = shardFile(fabio(published));
  const base = RegistryTable.snapshot(tableOf([baseFile]), TermSnapshot.empty);

  // The shard after one step, as the commands edit it: `deprecate` retires, and a shard edit does the rest.
  // A step that has nothing to act on leaves the shard as it is.
  const applyStep = (file: RegistrySourceFile, step: typeof ChangeStep.Type): RegistrySourceFile => {
    const shard = decodeShardText(file);
    const withTerms = (terms: ReadonlyArray<string>) =>
      shardFile({ ...Result.getOrThrow(S.encodeResult(RegistryShard)(shard)), terms: A.sort(terms, Order.String) });
    const retired = A.map(shard.deprecations, (row): string => row.term);
    return ChangeStep.match(step, {
      // A declared local never collides with a published one, which starts with "P", or with a retired IRI.
      Declare: ({ local }) => {
        const name = `d${local}`;
        return A.contains(shard.terms, name) || A.contains(retired, `${shard.namespace.iri}${name}`)
          ? file
          : withTerms([...shard.terms, name]);
      },
      TakeBack: ({ index }) => {
        const own = A.filter(shard.terms, Str.startsWith("d"));
        return O.match(A.get(own, index), {
          onNone: () => file,
          onSome: (local) => withTerms(A.filter(shard.terms, (term) => term !== local)),
        });
      },
      Retire: ({ index }) =>
        O.match(A.get(shard.terms, index), {
          onNone: () => file,
          onSome: (local) =>
            pipe(
              planDeprecate(
                inputOf([file], base),
                DeprecateRequest.make({ curie: `fabio:${local}`, replacement: O.none() })
              ),
              Result.getOrThrow,
              A.head,
              O.getOrElse(() => file)
            ),
        }),
    });
  };

  it.prop(
    "L0-3 every step's write gives the release the whole change so far calls for",
    [S.Array(ChangeStep).check(S.isMaxLength(8))],
    ([steps]) => {
      const write = (file: RegistrySourceFile, committed: string) =>
        Result.getOrThrow(
          planRegistryArtifacts(
            RegistryPlanInput.make({
              layout,
              shardFiles: [file],
              committed: O.some(committed),
              base: O.some(baseOf(base)),
            })
          )
        );
      // Each write is checked before the next one replaces its snapshot, so one wrong step cannot hide.
      const expectRelease = (file: RegistrySourceFile, written: TermSnapshot) => {
        expect(written.release).toBe(RegistryTable.releaseAfter(tableOf([file]), base));
        const changed = written.terms.length !== base.terms.length || written.deprecations.length > 0;
        expect(written.release).toBe(written.deprecations.length > 0 ? "2.0.0" : changed ? "1.1.0" : "1.0.0");
        expect(baseSnapshotIssues(baseOf(base), written, layout)).toStrictEqual([]);
      };
      const start = { file: baseFile, committed: renderTermSnapshot(base) };
      const end = A.reduce(steps, start, ({ committed, file }, step) => {
        const edited = applyStep(file, step);
        const written = write(edited, committed).snapshot;
        expectRelease(edited, written);
        return { file: edited, committed: renderTermSnapshot(written) };
      });
      // The writer is idempotent, and a hermetic regeneration keeps what it wrote.
      expect(renderTermSnapshot(write(end.file, end.committed).snapshot)).toBe(end.committed);
      const checked = planRegistryArtifacts(
        RegistryPlanInput.make({ layout, shardFiles: [end.file], committed: O.some(end.committed) })
      );
      expect(renderTermSnapshot(Result.getOrThrow(checked).snapshot)).toBe(end.committed);
    },
    { arbitrary: fcRuns(50) }
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
    expect(A.map(baseSnapshotIssues(baseOf(base), removed, layout), (issue) => issue.kind)).toStrictEqual([
      "term-removed-without-deprecation",
    ]);
    // A head regenerated from an older base keeps that base's release, which the change outgrew.
    const stale = RegistryTable.snapshot(
      tableOf([shardFile(fabio(["Report", "TechnicalReport", "Thesis"]))]),
      TermSnapshot.empty
    );
    const [understated] = baseSnapshotIssues(baseOf(base), stale, layout);
    expect(understated?.kind).toBe("release-regressed");
    expect(understated?.detail).toBe(
      "Against the base ref: The snapshot changes the rows of release 1.0.0 but is released as 1.0.0; the change calls for 1.1.0. Merge origin/main if it is not merged yet, set every `since` reported as since-misstated, then run `bun run beep identity registry --write`."
    );
    // The same findings with the base applied last.
    expect(baseSnapshotIssues(stale, layout)(baseOf(base))).toStrictEqual([understated]);
    const renamed = RegistryTable.snapshot(
      tableOf([
        shardFile({
          ...fabio(["Report", "TechnicalReport"]),
          namespace: { prefix: "fab", iri: "http://purl.org/spar/fabio/" },
        }),
      ]),
      base
    );
    expect(A.map(baseSnapshotIssues(baseOf(base), renamed, layout), (issue) => issue.kind)).toStrictEqual([
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
    const NO_BASE =
      "[identity:deprecate] no merge base with origin/main; the term-stability base is the empty snapshot.";
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
            NO_BASE,
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

    it.effect("fails outside a repository", () =>
      Effect.gen(function* () {
        const directory = yield* temporaryWorkingDirectory;

        const error = yield* runIdentityCommand(deprecateNote).pipe(withAncestorsHidden(directory), Effect.flip);

        expect(error).toMatchObject({
          _tag: "IdentityRegistryGeneratorError",
          message: "Cannot find the repository root.",
        });
      })
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
              `${layout.snapshot} [registry-generated-drift] The committed snapshot does not decode, so its release history is unknown:`
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

          const error = yield* Effect.flip(readShardEditInput(root, layout, baseOf(TermSnapshot.empty)));

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
            `${fabioPath} [registry-shard-invalid] The shard projects into @beep/test-runner, which this checkout does not have. ${PROJECTION_REMEDY}`,
          ]);
          const logs = yield* TestConsole.logLines;
          expect(logs).toStrictEqual([NO_BASE]);
          const untouched = yield* fs.readFileString(fabioPath);
          expect(untouched).toBe(renderRegistryJson(shard));
          const dataWritten = yield* fs.exists(layout.data);
          expect(dataWritten).toBe(false);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("leaves the checkout as it was when another shard's projection package is absent", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          // The edited shard is sound; the vitest shard beside it is the one that cannot regenerate.
          const shard = fabio(["Note", "Report"]);
          yield* writeFixture(shard);
          const vitestPath = `${layout.shards}/vitest.json`;
          const vitest = renderRegistryJson({
            namespace: { prefix: "vitest", iri: "https://example.test/vitest/" },
            terms: ["TestHang"],
            bindings: [{ code: "@beep/test-runner/Vitest/TestHang", local: "TestHang", since: "1.0.0" }],
            deprecations: [],
            projection: "@beep/test-runner",
          });
          yield* fs.writeFileString(vitestPath, vitest);

          const refused = yield* Effect.exit(runIdentityCommand(deprecateNote));

          expectReportedExit(refused);
          const errors = yield* TestConsole.errorLines;
          expect(errors).toStrictEqual([
            `${vitestPath} [registry-shard-invalid] The shard projects into @beep/test-runner, which this checkout does not have. ${PROJECTION_REMEDY}`,
          ]);
          const untouched = yield* fs.readFileString(fabioPath);
          expect(untouched).toBe(renderRegistryJson(shard));
          const otherUntouched = yield* fs.readFileString(vitestPath);
          expect(otherUntouched).toBe(vitest);
          const dataWritten = yield* fs.exists(layout.data);
          expect(dataWritten).toBe(false);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    // A workspace package with one module for the bindings to name.
    const writePackage = Effect.fn("IdentityShardEditTest.writePackage")(function* (directory: string, name: string) {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.makeDirectory(`packages/${directory}/src`, { recursive: true });
      yield* fs.writeFileString(
        `packages/${directory}/package.json`,
        `${encodeJson({ name, version: "0.0.0", type: "module" })}\n`
      );
      yield* fs.writeFileString(`packages/${directory}/src/Vitest.ts`, "export const hang = 1;\n");
    });
    const vitestShard = (packageName: string) => ({
      namespace: { prefix: "vitest", iri: "https://example.test/vitest/" },
      terms: ["TestHang"],
      bindings: [{ code: `${packageName}/Vitest/TestHang`, local: "TestHang", since: "1.0.0" }],
      deprecations: [],
      projection: "@beep/test-runner",
    });

    it.effect("refuses the rename of a projected package until the projection names it, and says so", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* writeFixture(fabio(["Note", "Report"]));
          const vitestPath = `${layout.shards}/vitest.json`;
          const vitest = renderRegistryJson(vitestShard("@beep/test-runner"));
          yield* fs.writeFileString(vitestPath, vitest);
          yield* writePackage("test-runner", "@beep/test-runner");
          yield* runIdentityCommand(["registry", "--write"]);
          yield* fs.remove("packages/test-runner", { recursive: true });
          yield* writePackage("test-kit", "@beep/test-kit");

          const refused = yield* Effect.exit(runIdentityCommand(["rebind", "@beep/test-runner", "@beep/test-kit"]));

          expectReportedExit(refused);
          const errors = yield* TestConsole.errorLines;
          expect(errors).toStrictEqual([
            `${vitestPath} [registry-shard-invalid] The shard projects into @beep/test-runner, which this checkout does not have. ${PROJECTION_REMEDY}`,
          ]);
          const untouched = yield* fs.readFileString(vitestPath);
          expect(untouched).toBe(vitest);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("renames a projected package once its projection names the new package, and keeps every IRI", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* writeFixture(fabio(["Report"]));
          const vitestPath = `${layout.shards}/vitest.json`;
          // @beep/old-runner becomes the package of the RegistryProjection literal. The shard names its projection by
          // the new name already, which is the state the remedy's two source edits leave.
          yield* writePackage("test-runner", "@beep/test-runner");
          yield* fs.writeFileString(vitestPath, renderRegistryJson(vitestShard("@beep/old-runner")));
          yield* runIdentityCommand(["registry", "--write"]);
          const before = yield* Effect.map(fs.readFileString(layout.snapshot), decodeSnapshotText);
          const stale = yield* Effect.exit(runIdentityCommand(["registry", "--check"]));
          expectReportedExit(stale);

          yield* runIdentityCommand(["rebind", "@beep/old-runner", "@beep/test-runner"]);

          yield* runIdentityCommand(["registry", "--check"]);
          const projected = yield* fs.readFileString("packages/test-runner/src/internal/generated/RegistryTerms.ts");
          expect(projected).toContain('"@beep/test-runner/Vitest/TestHang"');
          expect(projected).toContain("https://example.test/vitest/TestHang");
          const after = yield* Effect.map(fs.readFileString(layout.snapshot), decodeSnapshotText);
          expect(after.terms).toStrictEqual(before.terms);
          expect(after.namespaces).toStrictEqual(before.namespaces);
          expect(snapshotViolations(before, after)).toStrictEqual([]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("removes a stale projection module together with the edit that regenerates the registry", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* writeFixture(fabio(["Note", "Report"]));
          const target = RegistryProjectionTarget.of("@beep/test-runner", "packages/test-runner");
          yield* fs.makeDirectory("packages/test-runner/src/internal/generated", { recursive: true });
          yield* fs.writeFileString(
            "packages/test-runner/package.json",
            `${encodeJson({ name: "@beep/test-runner", version: "0.0.0", type: "module" })}\n`
          );
          yield* fs.writeFileString(
            target.path,
            renderRegistryProjection(tableOf([shardFile(fabio(["Note", "Report"]))]), [])
          );

          yield* runIdentityCommand(deprecateNote);

          const logs = yield* TestConsole.logLines;
          expect(logs).toContain(`[identity:deprecate] removed ${target.path}`);
          const stale = yield* fs.exists(target.path);
          expect(stale).toBe(false);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    // A file system that refuses to put a file in place when its path ends with `name`.
    const refusingRename = Effect.fn("IdentityShardEditTest.refusingRename")(function* (name: string) {
      const fs = yield* FileSystem.FileSystem;
      return FileSystem.FileSystem.of({
        ...fs,
        rename: Effect.fn("IdentityShardEditTest.deniedRename")((from, to) =>
          Str.endsWith(name)(to)
            ? Effect.fail(
                PlatformError.systemError({ _tag: "PermissionDenied", module: "FileSystem", method: "rename" })
              )
            : fs.rename(from, to)
        ),
      });
    });

    it.effect("says the edit was applied, and how to finish it, when an artifact cannot be written", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* writeFixture(fabio(["Note", "Report"]));
          yield* runIdentityCommand(["registry", "--write"]);
          const failingFs = yield* refusingRename(layout.snapshot);

          const error = yield* runIdentityCommand(deprecateNote).pipe(
            Effect.provideService(FileSystem.FileSystem, failingFs),
            Effect.flip
          );

          expect(error).toMatchObject({
            _tag: "IdentityRegistryGeneratorError",
            message: `Cannot write ${layout.snapshot}. The shard edit was applied (${fabioPath}), so do not run it again: fix the error, then run \`bun run beep identity registry --write\`.`,
          });
          const edited = yield* fs.readFileString(fabioPath);
          expect(edited).toContain('"since": "2.0.0"');
          // The failed file keeps its old bytes, and no staged copy is left beside it.
          const oldSnapshot = yield* fs.readFileString(layout.snapshot);
          expect(oldSnapshot).toContain('"release": "1.0.0"');
          const staged = yield* fs.exists(`${layout.snapshot}.tmp`);
          expect(staged).toBe(false);

          // Running the edit again is what the message rules out; the command it names finishes the edit.
          const again = yield* Effect.exit(runIdentityCommand(deprecateNote));
          expectReportedExit(again);
          const errors = yield* TestConsole.errorLines;
          expect(errors).toContainEqual(expect.stringContaining("fabio:Note [unknown-term]"));
          yield* runIdentityCommand(["registry", "--write"]);
          yield* runIdentityCommand(["registry", "--check"]);
          const snapshotText = yield* fs.readFileString(layout.snapshot);
          expect(snapshotText).toContain('"release": "2.0.0"');
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("finishes a rebind that stopped between two shards when it is run again", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* writeFixture(
            fabio(["Report"], [{ code: "@beep/widget/Old/Report", local: "Report", since: "1.0.0" }])
          );
          const docoPath = `${layout.shards}/doco.json`;
          yield* fs.writeFileString(
            docoPath,
            renderRegistryJson(
              doco({ bindings: [{ code: "@beep/widget/Old/Section", local: "Section", since: "1.0.0" }] })
            )
          );
          yield* fs.makeDirectory("packages/gadget/src", { recursive: true });
          yield* fs.writeFileString(
            "packages/gadget/package.json",
            `${encodeJson({ name: "@beep/gadget", version: "0.0.0", type: "module" })}\n`
          );
          yield* fs.writeFileString("packages/gadget/src/Old.ts", "export const old = 1;\n");
          const failingFs = yield* refusingRename("fabio.json");
          const rename = ["rebind", "@beep/widget", "@beep/gadget"];

          const error = yield* runIdentityCommand(rename).pipe(
            Effect.provideService(FileSystem.FileSystem, failingFs),
            Effect.flip
          );

          expect(error).toMatchObject({
            _tag: "IdentityRegistryGeneratorError",
            message: `Cannot write ${fabioPath}. Fix the error, then run the same command again to edit the shards that are left.`,
          });
          const first = yield* fs.readFileString(docoPath);
          expect(first).toContain("@beep/gadget/Old/Section");
          const second = yield* fs.readFileString(fabioPath);
          expect(second).toContain("@beep/widget/Old/Report");
          const dataWritten = yield* fs.exists(layout.data);
          expect(dataWritten).toBe(false);

          yield* runIdentityCommand(rename);

          const finished = yield* fs.readFileString(fabioPath);
          expect(finished).toContain("@beep/gadget/Old/Report");
          yield* runIdentityCommand(["registry", "--check"]);
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
          const mixed = yield* Effect.exit(runIdentityCommand(["rebind", "@beep/widget/Old", "@beep/gadget"]));
          expectReportedExit(mixed);

          const errors = yield* TestConsole.errorLines;
          expect(errors).toStrictEqual([
            "[identity:rebind] refused: 1 reason(s).",
            "widget/Old [invalid-code] Expected a code identity of the form @beep/<package>/<path>, or a package of the form @beep/<package>.",
            "[identity:rebind] refused: 1 reason(s).",
            "widget/New [invalid-code] Expected a code identity of the form @beep/<package>/<path>, or a package of the form @beep/<package>.",
            "[identity:rebind] refused: 1 reason(s).",
            "@beep/widget/Old -> @beep/gadget [mixed-move] A package moves to a package and a code identity to a code identity; name both ends of the same kind.",
          ]);
          const untouched = yield* fs.readFileString(fabioPath);
          expect(untouched).toBe(renderRegistryJson(shard));
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});
