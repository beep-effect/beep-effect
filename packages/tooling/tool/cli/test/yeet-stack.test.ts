// The pure stack decisions of slice C (goals/yeet-async-merge-and-stacks):
// whether a lane may publish a layer on a parent, what one merge request from a
// pull request would merge, and which branch's ruleset governs a layer.
import {
  GithubPullRequestRecord,
  GithubPullRequestStackRef,
  GithubStackLayerRecord,
  GithubStackRecord,
} from "@beep/repo-cli/test/SharedInternals";
import {
  decideYeetStackMergeScope,
  decideYeetStackPublish,
  renderYeetStackPublishRefusal,
  YeetStackLayer,
  YeetStackMergeScope,
  YeetStackPublishDecision,
  YeetStackPublishFacts,
  YeetTrunkHealth,
  yeetStackParentLayer,
  yeetStackRulesBranch,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, deepStrictEqual } from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as Str from "effect/String";

const PARENT = 41;
const CHILD = 42;
const STACK = 43;
const PARENT_HEAD = Str.repeat(40)("a");
const CHILD_HEAD = Str.repeat(40)("b");
const MAIN = Str.repeat(40)("c");
const at = DateTime.makeUnsafe("2026-11-13T00:00:00Z");

const pull = (overrides: Partial<GithubPullRequestRecord> = {}): GithubPullRequestRecord =>
  GithubPullRequestRecord.make({
    number: PARENT,
    nodeId: "PR_kw41",
    title: "feat: parent",
    body: "",
    state: "open",
    draft: false,
    merged: false,
    mergeableState: O.some("clean"),
    headRef: "feat/parent",
    headSha: PARENT_HEAD,
    baseRef: "main",
    baseSha: MAIN,
    htmlUrl: "https://github.com/beep-effect/beep-effect/pull/41",
    author: "octocat",
    labels: [],
    createdAt: at,
    updatedAt: at,
    ...overrides,
  });

const stackRef = (position: number, number: number = STACK) =>
  O.some(GithubPullRequestStackRef.make({ number, position, size: 2, baseRef: "main" }));

const child = (overrides: Partial<GithubPullRequestRecord> = {}): GithubPullRequestRecord =>
  pull({
    number: CHILD,
    nodeId: "PR_kw42",
    title: "feat: child",
    headRef: "feat/child",
    headSha: CHILD_HEAD,
    baseRef: "feat/parent",
    baseSha: PARENT_HEAD,
    ...overrides,
  });

const green = O.some(YeetTrunkHealth.cases.Green.make({ sha: MAIN }));

const facts = (overrides: Partial<YeetStackPublishFacts> = {}): YeetStackPublishFacts =>
  YeetStackPublishFacts.make({
    branch: "feat/child",
    trunk: "main",
    parent: pull(),
    existing: O.none(),
    builtOnParent: true,
    trunkHealth: green,
    ...overrides,
  });

const layer = (stackNumber: O.Option<number>, parentMoved: boolean): YeetStackPublishDecision =>
  YeetStackPublishDecision.cases.Layer.make({
    parentNumber: PARENT,
    parentHeadRef: "feat/parent",
    parentHeadSha: PARENT_HEAD,
    trunk: "main",
    stackNumber,
    parentMoved,
  });

const refusalOf = (decision: YeetStackPublishDecision): string =>
  YeetStackPublishDecision.match(decision, { Layer: () => "layer", Refused: ({ reason }) => reason });

describe("decideYeetStackPublish", () => {
  it.each([
    ["parent-is-self", facts({ branch: "feat/parent" })],
    ["parent-not-open", facts({ parent: pull({ merged: true, state: "closed" }) })],
    ["parent-not-open", facts({ parent: pull({ state: "closed" }) })],
    ["parent-off-trunk", facts({ parent: pull({ baseRef: "feat/other" }) })],
    ["parent-stacked", facts({ parent: pull({ stack: stackRef(1) }) })],
    ["not-built-on-parent", facts({ builtOnParent: false })],
    ["trunk-red", facts({ trunkHealth: O.some(YeetTrunkHealth.cases.Red.make({ sha: MAIN, contexts: ["Lint"] })) })],
    ["trunk-unknown", facts({ trunkHealth: O.none() })],
    ["trunk-unknown", facts({ trunkHealth: O.some(YeetTrunkHealth.cases.Unknown.make({ detail: "no run" })) })],
    ["existing-base-mismatch", facts({ existing: O.some(child({ baseRef: "main" })) })],
    [
      "stack-mismatch",
      facts({ parent: pull({ stack: stackRef(1, 44) }), existing: O.some(child({ stack: stackRef(2) })) }),
    ],
    ["stack-mismatch", facts({ existing: O.some(child({ stack: stackRef(2) })) })],
    ["parent-stacked", facts({ parent: pull({ stack: stackRef(1) }), existing: O.some(child()) })],
  ] as const)("refuses with %s", (reason, input) => {
    expect(refusalOf(decideYeetStackPublish(input))).toBe(reason);
  });

  it("names what it observed in the refusal sentence", () => {
    const decision = decideYeetStackPublish(
      facts({ trunkHealth: O.some(YeetTrunkHealth.cases.Red.make({ sha: MAIN, contexts: ["Lint", "Test Unit"] })) })
    );
    deepStrictEqual(
      decision,
      YeetStackPublishDecision.cases.Refused.make({
        reason: "trunk-red",
        detail: `main's required checks are red at ${Str.slice(0, 10)(MAIN)} (Lint, Test Unit); open a stack only on a green trunk`,
      })
    );
    expect(renderYeetStackPublishRefusal("trunk-red", "red")).toBe("--stack-on refused (trunk-red): red");
  });

  it("publishes a new layer on an unstacked parent over a green trunk", () => {
    deepStrictEqual(decideYeetStackPublish(facts()), layer(O.none(), false));
  });

  it("keeps publishing an existing linked layer without reading the trunk", () => {
    const decision = decideYeetStackPublish(
      facts({
        parent: pull({ stack: stackRef(1) }),
        existing: O.some(child({ stack: stackRef(2) })),
        trunkHealth: O.none(),
      })
    );
    deepStrictEqual(decision, layer(O.some(STACK), false));
  });

  it("links an existing layer whose earlier link failed", () => {
    deepStrictEqual(
      decideYeetStackPublish(facts({ existing: O.some(child()), trunkHealth: O.none() })),
      layer(O.none(), false)
    );
  });

  it("flags an existing layer whose parent moved instead of refusing it", () => {
    const decision = decideYeetStackPublish(
      facts({
        parent: pull({ stack: stackRef(1) }),
        existing: O.some(child({ stack: stackRef(2) })),
        builtOnParent: false,
      })
    );
    deepStrictEqual(decision, layer(O.some(STACK), true));
  });
});

const stackLayer = (number: number, headRef: string, state: "open" | "merged" | "closed" = "open") =>
  GithubStackLayerRecord.make({
    number,
    state: state === "open" ? "open" : "closed",
    draft: false,
    merged: state === "merged",
    headRef,
    headSha: Str.repeat(40)(`${number % 10}`),
  });

const stackOf = (...layers: ReadonlyArray<GithubStackLayerRecord>) =>
  GithubStackRecord.make({ number: STACK, open: true, baseRef: "main", layers });

const positioned = (entry: GithubStackLayerRecord, position: number) =>
  YeetStackLayer.make({ number: entry.number, position, headRef: entry.headRef, headSha: entry.headSha });

describe("decideYeetStackMergeScope", () => {
  const lower = stackLayer(PARENT, "feat/parent");
  const top = stackLayer(CHILD, "feat/child");

  it("merges the top with the open layer below it as one group", () => {
    deepStrictEqual(
      decideYeetStackMergeScope(CHILD, stackOf(lower, top)),
      YeetStackMergeScope.cases.Group.make({
        stackNumber: STACK,
        trunk: "main",
        lower: positioned(lower, 1),
        top: positioned(top, 2),
      })
    );
  });

  it("holds a lower layer with an open layer above it", () => {
    deepStrictEqual(
      decideYeetStackMergeScope(PARENT, stackOf(lower, top)),
      YeetStackMergeScope.cases.BelowTop.make({ stackNumber: STACK, upper: positioned(top, 2) })
    );
  });

  it("merges the last open layer alone once the one below merged", () => {
    deepStrictEqual(
      decideYeetStackMergeScope(CHILD, stackOf(stackLayer(PARENT, "feat/parent", "merged"), top)),
      YeetStackMergeScope.cases.Single.make({})
    );
  });

  it("ignores a merged bottom layer and groups the two open layers above it", () => {
    const bottom = stackLayer(40, "feat/bottom", "merged");
    deepStrictEqual(
      decideYeetStackMergeScope(CHILD, stackOf(bottom, lower, top)),
      YeetStackMergeScope.cases.Group.make({
        stackNumber: STACK,
        trunk: "main",
        lower: positioned(lower, 2),
        top: positioned(top, 3),
      })
    );
  });

  it("holds more open layers than the cap", () => {
    deepStrictEqual(
      decideYeetStackMergeScope(CHILD, stackOf(stackLayer(40, "feat/bottom"), lower, top)),
      YeetStackMergeScope.cases.TooDeep.make({ stackNumber: STACK, openLayers: 3 })
    );
  });

  it("holds a stack that does not list the pull request", () => {
    deepStrictEqual(
      decideYeetStackMergeScope(99, stackOf(lower, top)),
      YeetStackMergeScope.cases.Unknown.make({ stackNumber: STACK, detail: `stack #${STACK} does not list #99` })
    );
  });
});

describe("yeetStackParentLayer", () => {
  const lower = stackLayer(PARENT, "feat/parent");
  const top = stackLayer(CHILD, "feat/child");

  it("finds the open layer below the top", () => {
    assertSome(yeetStackParentLayer(CHILD, stackOf(lower, top)), positioned(lower, 1));
  });

  it("finds nothing below the bottom, below a merged layer, or for an unlisted pull request", () => {
    assertNone(yeetStackParentLayer(PARENT, stackOf(lower, top)));
    assertNone(yeetStackParentLayer(CHILD, stackOf(stackLayer(PARENT, "feat/parent", "merged"), top)));
    assertNone(yeetStackParentLayer(99, stackOf(lower, top)));
  });
});

describe("yeetStackRulesBranch", () => {
  it("reads a layer's rules from the stack's trunk and anything else from its own base", () => {
    expect(yeetStackRulesBranch(child({ stack: stackRef(2) }))).toBe("main");
    expect(yeetStackRulesBranch(child())).toBe("feat/parent");
  });
});
