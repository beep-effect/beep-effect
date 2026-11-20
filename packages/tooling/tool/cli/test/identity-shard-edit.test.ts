import { fcRuns } from "@beep/fc-runs";
import { CodeId, RegistryShard, RegistryTable, snapshotViolations, TermLocal, TermSnapshot } from "@beep/identity/Term";
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
  ShardEditInput,
} from "@beep/repo-cli/commands/Identity/ShardEdit";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

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

  it("refuses the namespace itself as the successor of a retired term", () => {
    const refused = planDeprecate(
      inputOf([plain], previous),
      DeprecateRequest.make({ curie: "fabio:Note", replacement: O.some("fabio:") })
    );
    expect(reasonsOf(refused)).toStrictEqual(["replacement-unknown"]);
    expect(Result.isFailure(refused) && refused.failure[0]?.detail).toContain("never by its namespace IRI");
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
    const removed = RegistryTable.snapshot(tableOf([shardFile(fabio(["Report"]))]), TermSnapshot.empty);
    expect(A.map(baseSnapshotIssues(base, removed, layout.snapshot), (issue) => issue.kind)).toStrictEqual([
      "term-removed-without-deprecation",
    ]);
    const renamed = RegistryTable.snapshot(
      tableOf([
        shardFile({
          ...fabio(["Report", "TechnicalReport"]),
          namespace: { prefix: "fab", iri: "http://purl.org/spar/fabio/" },
        }),
      ]),
      TermSnapshot.empty
    );
    expect(A.map(baseSnapshotIssues(base, renamed, layout.snapshot), (issue) => issue.kind)).toStrictEqual([
      "namespace-prefix-changed",
    ]);
  });
});
