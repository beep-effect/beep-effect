import { GitHubMarkdown } from "@beep/github-reporting/GitHubMarkdown";
import { admission } from "@beep/github-reporting/internal/admission";
import { Html, Table, TableCell, TableRow } from "@beep/markdown/MarkdownNode";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const Cell = S.String.check(S.isPattern(/^[a-z|\\` ]{1,12}$/u));
const Row = S.Tuple([Cell, Cell, Cell]);
const HEADERS = ["check", "state", "outcome"];

const passthroughAdmissions = 3 * 1;
const cellAdmissions = 3 * 2;
const rowSubtreeSize = 7;
const tableAndRootRewalks = 2 * rowSubtreeSize;
const PER_ROW = passthroughAdmissions + cellAdmissions + rowSubtreeSize + tableAndRootRewalks;

const childrenOf = (node: unknown): ReadonlyArray<unknown> =>
  P.hasProperty(node, "children") && A.isArray(node.children) ? node.children : A.empty();

const subtreeSize = (node: unknown): number =>
  A.reduce(childrenOf(node), 1, (size, child) => size + subtreeSize(child));

class AdmissionCount extends Context.Service<
  AdmissionCount,
  { readonly admissionsOf: (build: () => unknown) => Effect.Effect<number> }
>()("@beep/github-reporting/test/GitHubMarkdown.admission.test/AdmissionCount") {
  static readonly layer = Layer.effect(
    AdmissionCount,
    Effect.acquireRelease(
      Effect.sync(() => {
        const tally = MutableRef.make(0);
        const admit = admission.admit;
        admission.admit = <Self extends S.Top>(schema: Self, input: Self["~type.make.in"]): Self["Type"] => {
          MutableRef.update(tally, (count) => count + subtreeSize(input));
          return admit(schema, input);
        };
        return {
          admit,
          service: AdmissionCount.of({
            admissionsOf: Effect.fn("AdmissionCount.admissionsOf")((build: () => unknown) =>
              Effect.sync(() => {
                MutableRef.set(tally, 0);
                build();
                return MutableRef.get(tally);
              })
            ),
          }),
        };
      }),
      ({ admit }) =>
        Effect.sync(() => {
          admission.admit = admit;
        })
    ).pipe(Effect.map(({ service }) => service))
  );
}

const quadraticTable = (rows: ReadonlyArray<ReadonlyArray<string>>): Table => {
  const row = (values: ReadonlyArray<string>): TableRow =>
    admission.admit(TableRow, {
      children: A.map(values, (value) => admission.admit(TableCell, { children: [admission.admit(Html, { value })] })),
    });
  return A.reduce(rows, admission.admit(Table, { children: [row(HEADERS)] }), (table, values) =>
    admission.admit(Table, { children: [...table.children, row(values)] })
  );
};

describe("GitHubMarkdown admission", () => {
  it.layer(AdmissionCount.layer, { timeout: "5 seconds" })((it) => {
    it.effect("table admission work is exactly affine in rows: 30 node admissions per row on a fixed seed", () =>
      Effect.gen(function* () {
        const { admissionsOf } = yield* AdmissionCount;
        const rows = yield* Arbitrary.sampleEffect(Arbitrary.schema(Row), { count: 10_000, seed: 31 });
        const tableOf = (input: ReadonlyArray<ReadonlyArray<string>>) =>
          admissionsOf(() => GitHubMarkdown.table(HEADERS, input));
        const none = yield* tableOf(A.empty());
        const small = yield* tableOf(A.take(rows, 5_000));
        const large = yield* tableOf(rows);
        assert.strictEqual(none, PER_ROW + 3, "the header row, plus 1 for the table and 2 for the root");
        assert.strictEqual(small, none + PER_ROW * 5_000, `admissions(5k) = ${small}`);
        assert.strictEqual(
          large,
          none + PER_ROW * 10_000,
          `admissions(10k) = ${large}; make copies a node's whole subtree, so admission stays O(nodes) only while the construct (root, table, row, cell, passthrough), never the input, fixes the depth`
        );
      })
    );

    it.effect("the counter flags a builder that re-admits the growing table per row", () =>
      Effect.gen(function* () {
        const { admissionsOf } = yield* AdmissionCount;
        const rows = yield* Arbitrary.sampleEffect(Arbitrary.schema(Row), { count: 40, seed: 31 });
        const tableOf = (input: ReadonlyArray<ReadonlyArray<string>>) => admissionsOf(() => quadraticTable(input));
        const none = yield* tableOf(A.empty());
        const small = yield* tableOf(A.take(rows, 20));
        const large = yield* tableOf(rows);
        assert.isAbove(large - small, small - none, `second difference ${large - 2 * small + none}`);
      })
    );
  });
});
