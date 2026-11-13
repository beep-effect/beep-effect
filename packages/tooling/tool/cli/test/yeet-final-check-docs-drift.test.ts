import { isHeavyDocsOnlyPath } from "@beep/repo-cli/commands/Ci";
import {
  COVERAGE_SCANNED_OWNER_ROWS,
  CoverageScopeOwner,
  planCoverageAffectedScope,
} from "@beep/repo-cli/test/Quality";
import { FinalCheckGate } from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { assertInclude } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { rowOwnerNames } from "./support/CoverageOwnerRows.ts";

// route-soundness-repair YEET-08 slice 1: the prose that tells a lane what
// `yeet final-check` replays must name exactly the FinalCheckGate gates.
// Keyed by every gate, so a new gate does not type-check until it has names.
// `cheap-gates` has none: the docs describe the gates "the cheap tier skips".
const GATE_DOC_NAMES: { readonly [Gate in FinalCheckGate]: ReadonlyArray<string> } = {
  "expectation-rewrite": ["test expectations rewritten to match new output", "rewritten test expectations"],
  "cheap-gates": [],
  "lint-policy": ["Lint Policy"],
  lint: ["Lint"],
  "repo-sanity": ["Repo Sanity"],
  check: ["Check"],
  docgen: ["Docgen"],
  fallow: ["Fallow"],
  coverage: ["Coverage"],
};

// Each document names the gates in one sentence, between these markers.
const DOC_LISTS = [
  { file: "AGENTS.md", start: "every hosted gate the cheap tier skips (", end: ")" },
  { file: ".claude/skills/yeet/SKILL.md", start: "gate: the affected replay of ", end: "." },
] as const;

// The gate table under "## Final check" in the skill's gates reference lists
// every gate, cheap-gates included, in run order.
const GATE_TABLE = ".claude/skills/yeet/references/gates-and-proof.md";

const gateForName = (name: string): O.Option<FinalCheckGate> =>
  A.findFirst(FinalCheckGate.literals, (gate) => A.contains(GATE_DOC_NAMES[gate], name));

const collapse = (text: string) => Str.trim(Str.replace(/\s+/g, " ")(text));

/**
 * Judge one gate list against the gates the cheap tier skips.
 * Returns the problems; an empty array means the list is exact.
 */
const judgeGateList = (list: string): ReadonlyArray<string> => {
  const names = A.filter(
    A.map(Str.split(", ")(Str.replace(/,? and /g, ", ")(collapse(list))), Str.trim),
    Str.isNonEmpty
  );
  const unknown = A.filter(names, (name) => O.isNone(gateForName(name)));
  const named = A.getSomes(A.map(names, gateForName));
  const expected = A.filter(FinalCheckGate.literals, (gate) => A.isReadonlyArrayNonEmpty(GATE_DOC_NAMES[gate]));
  const missing = A.filter(expected, (gate) => !A.contains(named, gate));
  const repeated = A.filter(A.dedupe(named), (gate) => A.filter(named, (other) => other === gate).length > 1);
  return [
    ...A.map(unknown, (name) => `names "${name}", which is not a final-check gate`),
    ...A.map(missing, (gate) => `omits the ${gate} gate`),
    ...A.map(repeated, (gate) => `names the ${gate} gate twice`),
  ];
};

const extractList = (text: string, start: string, end: string): O.Option<string> => {
  const flat = collapse(text);
  return O.flatMap(Str.indexOf(start)(flat), (from) => {
    const rest = Str.slice(from + start.length)(flat);
    return O.map(Str.indexOf(end)(rest), (to) => Str.slice(0, to)(rest));
  });
};

const gateTableRows = (text: string): ReadonlyArray<string> => {
  const section = O.match(Str.indexOf("## Final check")(text), {
    onNone: () => "",
    onSome: (from) => Str.slice(from)(text),
  });
  return A.getSomes(A.map(Str.split("\n")(section), (line) => O.fromNullishOr(/^\| `([a-z-]+)` \|/.exec(line)?.[1])));
};

// Vite inlines each document's raw text at transform time, and the test task
// declares the three files as Turbo inputs so an edit to one re-keys it.
const DOC_TEXT: Readonly<Record<string, string>> = import.meta.glob<string>(
  [
    "../../../../../AGENTS.md",
    "../../../../../.claude/skills/yeet/SKILL.md",
    "../../../../../.claude/skills/yeet/references/gates-and-proof.md",
  ],
  { eager: true, import: "default", query: "?raw" }
);

const readRepoFile = (file: string): O.Option<string> => R.get(DOC_TEXT, `../../../../../${file}`);

describe("final-check gate list judge", () => {
  const exact = "Lint Policy, Lint, Check, Docgen, Repo Sanity, Fallow, Coverage, and rewritten test expectations";

  it("accepts a list naming exactly the gates the cheap tier skips", () => {
    expect(judgeGateList(exact)).toStrictEqual([]);
  });

  it("refuses a name that is not a final-check gate", () => {
    const problems = judgeGateList(`Effect Diagnostics, ${exact}`);
    expect(problems).toStrictEqual(['names "Effect Diagnostics", which is not a final-check gate']);
  });

  it("refuses a list that omits a gate", () => {
    const problems = judgeGateList("Lint Policy, Lint, Check, Docgen, Repo Sanity, Fallow, and Coverage");
    expect(problems).toStrictEqual(["omits the expectation-rewrite gate"]);
  });

  it("gives every gate but cheap-gates a documented name", () => {
    const unnamed = A.filter(FinalCheckGate.literals, (gate) => A.isReadonlyArrayEmpty(GATE_DOC_NAMES[gate]));
    expect(unnamed).toStrictEqual(["cheap-gates"]);
  });
});

describe("final-check gate names in the docs", () => {
  for (const doc of DOC_LISTS) {
    it(`${doc.file} names exactly the final-check gates`, () => {
      const problems = O.match(
        O.flatMap(readRepoFile(doc.file), (text) => extractList(text, doc.start, doc.end)),
        {
          onNone: () => [`no longer holds "${doc.start}"`],
          onSome: judgeGateList,
        }
      );
      expect(problems).toStrictEqual([]);
    });
  }

  it("keeps every document it reads on the code route, so a docs-only edit still runs it", () => {
    const docs = A.map(R.keys(DOC_TEXT), Str.replace("../../../../../", ""));
    expect(docs).toHaveLength(3);
    expect(A.filter(docs, isHeavyDocsOnlyPath)).toStrictEqual([]);
  });

  // The skill files also select the skill tree's scanned readers (TURB-01 slice 1b), so every
  // package a scanned owner row names is a coverage-bearing owner here.
  it("selects the repo-cli tests for an edit to a document it reads, never a full coverage scope", () => {
    const owners = A.map(rowOwnerNames(COVERAGE_SCANNED_OWNER_ROWS), (packageName) =>
      CoverageScopeOwner.make({ packageName, packagePath: `packages/${packageName}`, hasCoverage: true })
    );
    const docs = A.map(R.keys(DOC_TEXT), Str.replace("../../../../../", ""));
    const scopes = A.map(docs, (doc) => planCoverageAffectedScope(owners, [doc]));
    expect(
      A.map(scopes, (scope) => [
        scope._tag,
        scope._tag === "selected" && A.contains(scope.packageNames, "@beep/repo-cli"),
      ])
    ).toStrictEqual(A.map(docs, () => ["selected", true]));
  });

  it(`${GATE_TABLE} tables every final-check gate in run order`, () => {
    const text = O.getOrElse(readRepoFile(GATE_TABLE), () => "");
    assertInclude(text, "## Final check");
    expect(gateTableRows(text)).toStrictEqual(FinalCheckGate.literals);
  });
});
