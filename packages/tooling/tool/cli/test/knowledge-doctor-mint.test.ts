import {
  decideKnowledgeDoctorCiMode,
  encodeKnowledgeBaselineText,
  KNOWLEDGE_DOCTOR_BASELINE_PATH,
  KNOWLEDGE_DOCTOR_PROMOTIONS_PATH,
  KNOWLEDGE_MINT_BRANCH,
  KnowledgeBaselineEntry,
  KnowledgeDoctorBaseline,
  KnowledgeDoctorCiModeInput,
  KnowledgeDoctorPromotion,
  KnowledgeDoctorPromotions,
  KnowledgeMintAcceptance,
  KnowledgeMintOutcome,
  KnowledgeMintPullRequest,
  KnowledgeMintWriteContext,
  KnowledgeSealFiles,
  KnowledgeSealGuardInput,
  knowledgeMintAppLogin,
  knowledgeMintPullRequestRefusals,
  knowledgeMintWriteRefusals,
  knowledgeSealGuard,
  makeKnowledgeDoctorMemoryTree,
  mintKnowledgeBaselineText,
  scanKnowledgeDoctorTree,
  verifyKnowledgeBaselineText,
} from "@beep/repo-cli/commands/Knowledge";
import { renderKnowledgeMintOutcome } from "@beep/repo-cli/test/Knowledge";
import { it } from "@beep/test-runner";
import { NodeCrypto } from "@effect/platform-node";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { KnowledgeDoctorTree } from "@beep/repo-cli/commands/Knowledge";

const platformLayer = NodeCrypto.layer;

const MINTED = "0000000000000000000000000000000000000000";
const EARLIER = "2222222222222222222222222222222222222222";
const SLUG = "beep-knowledge-mint";
const REPOSITORY = "beep-effect/beep-effect";

const EMPTY_SEAL = KnowledgeSealFiles.make({
  baseline: O.none(),
  baselineText: O.none(),
  codeowners: O.some("* @kriegcloud\n"),
  identity: O.none(),
  leases: O.none(),
  promotions: O.none(),
});

const seal = (overrides: Partial<KnowledgeSealFiles>): KnowledgeSealFiles =>
  KnowledgeSealFiles.make({ ...EMPTY_SEAL, ...overrides });

const promotionRow = KnowledgeDoctorPromotion.make({
  kind: "broken-tracked-path",
  promotedAt: EARLIER,
  windowEvidence: "c7 window for broken-tracked-path",
});

const tree = (files: Readonly<Record<string, string>>): KnowledgeDoctorTree => makeKnowledgeDoctorMemoryTree({ files });

const SEALED_TREE = { "docs/a.md": "See `docs/gone.md` and `docs/also-gone.md`." };

const mintText = Effect.fnUntraced(function* (
  doctorTree: KnowledgeDoctorTree,
  files: KnowledgeSealFiles = EMPTY_SEAL,
  previousPromotions: ReadonlyArray<KnowledgeDoctorPromotion> = []
) {
  return yield* mintKnowledgeBaselineText({
    tree: doctorTree,
    report: yield* scanKnowledgeDoctorTree(doctorTree),
    removals: O.some([]),
    files,
    previousPromotions,
  });
});

// The committed form of a baseline minted earlier: same entries, an older mintedAt, exact text.
const committedAt = Effect.fnUntraced(function* (baseline: KnowledgeDoctorBaseline, mintedAt: string) {
  const committed = KnowledgeDoctorBaseline.make({ ...baseline, mintedAt });
  const argument = O.some(committed);
  const encodedKnowledgeBaselineText = yield* encodeKnowledgeBaselineText(committed);
  return seal({ baseline: argument, baselineText: O.some(encodedKnowledgeBaselineText) });
});

const pullRequest = (overrides: Partial<KnowledgeMintPullRequest> = {}) =>
  KnowledgeMintPullRequest.make({
    appSlug: O.some(SLUG),
    author: O.some(knowledgeMintAppLogin(SLUG)),
    headRef: O.some(KNOWLEDGE_MINT_BRANCH),
    headRepository: O.some(REPOSITORY),
    repository: O.some(REPOSITORY),
    ...overrides,
  });

const writeContext = (overrides: Partial<KnowledgeMintWriteContext> = {}) =>
  KnowledgeMintWriteContext.make({
    baseRef: "origin/main",
    ci: true,
    clean: true,
    commit: MINTED,
    headIsMinted: true,
    onBase: true,
    ...overrides,
  });

describe("knowledge doctor mint workflow", () => {
  it.layer(platformLayer, { timeout: "60 seconds" })((it) => {
    it.effect(
      "mints identical bytes twice and reports a change only when the entries or note move",
      Effect.fnUntraced(function* () {
        const first = yield* mintText(tree(SEALED_TREE));
        const second = yield* mintText(tree(SEALED_TREE));
        assert.strictEqual(first.text, second.text);
        assert.isTrue(first.changed);
        assert.strictEqual(first.baseline.mintedAt, MINTED);
        assert.isTrue(A.isReadonlyArrayNonEmpty(first.baseline.entries));
        yield* verifyKnowledgeBaselineText(first.text, second.baseline);

        // The committed baseline already holds these entries under an older mintedAt: nothing to write.
        const argument1 = tree(SEALED_TREE);
        const committedAt1 = yield* committedAt(first.baseline, EARLIER);
        const same = yield* mintText(argument1, committedAt1);
        assert.isFalse(same.changed);
        assert.strictEqual(same.text, first.text);

        // An entry whose finding is resolved drops out, so the file changes.
        const stale = KnowledgeDoctorBaseline.make({
          ...first.baseline,
          entries: A.append(
            first.baseline.entries,
            KnowledgeBaselineEntry.make({
              ...O.getOrThrow(A.head(first.baseline.entries)),
              key: `knowledge-doctor/v1:${Str.repeat(64)("f")}`,
            })
          ),
        });
        const argument2 = tree(SEALED_TREE);
        const committedAt2 = yield* committedAt(stale, EARLIER);
        const dropped = yield* mintText(argument2, committedAt2);
        assert.isTrue(dropped.changed);
        assert.strictEqual(A.length(dropped.baseline.entries), A.length(first.baseline.entries));

        // A committed file that is not the canonical rendering also changes.
        const committed = yield* committedAt(first.baseline, EARLIER);
        const drifted = yield* mintText(
          tree(SEALED_TREE),
          seal({ ...committed, baselineText: O.map(committed.baselineText, (text) => `${text} `) })
        );
        assert.isTrue(drifted.changed);
      })
    );

    it.effect(
      "refuses to launder a new finding of a promoted kind and names it",
      Effect.fnUntraced(function* () {
        const first = yield* mintText(tree(SEALED_TREE));
        const grown = tree({ "docs/a.md": "See `docs/gone.md` and `docs/also-gone.md`.\nThen `docs/new-gap.md`." });
        const files = seal({
          ...(yield* committedAt(first.baseline, EARLIER)),
          promotions: O.some(KnowledgeDoctorPromotions.make({ promotions: [promotionRow] })),
        });
        const refusal = yield* Effect.flip(mintText(grown, files, [promotionRow]));
        assert.strictEqual(refusal._tag, "KnowledgeMintRefusal");
        if (refusal._tag === "KnowledgeMintRefusal") {
          assert.strictEqual(A.length(refusal.refused), 1);
          const report = yield* scanKnowledgeDoctorTree(grown);
          const gap = A.findFirst(report.findings, (row) => row.finding.subject === "repo-path:docs/new-gap.md");
          assert.deepStrictEqual(refusal.refused, [O.getOrThrow(gap).finding.findingId]);
        }
        // The same finding while its kind is newly promoted since the previous mint is admitted.
        const admitted = yield* mintText(grown, files, []);
        assert.strictEqual(A.length(admitted.baseline.entries), A.length(first.baseline.entries) + 1);
      })
    );
  });

  it("refuses --accept-mint unless the mint App opened the pull request from the mint branch (condition i)", () => {
    assert.deepStrictEqual(knowledgeMintPullRequestRefusals(pullRequest()), []);
    assert.strictEqual(knowledgeMintAppLogin(SLUG), "beep-knowledge-mint[bot]");
    const fixtures: ReadonlyArray<readonly [string, Partial<KnowledgeMintPullRequest>, ReadonlyArray<string>]> = [
      ["another branch", { headRef: O.some("feat/x") }, [`The head branch is feat/x, not ${KNOWLEDGE_MINT_BRANCH}.`]],
      [
        "a human author on the mint branch",
        { author: O.some("kriegcloud") },
        ["The pull request author is kriegcloud, not beep-knowledge-mint[bot]."],
      ],
      [
        "a fork's mint branch",
        { headRepository: O.some("someone/beep-effect"), author: O.some("someone") },
        [
          `The head branch lives in someone/beep-effect, not ${REPOSITORY}.`,
          "The pull request author is someone, not beep-knowledge-mint[bot].",
        ],
      ],
      [
        "an unset App slug",
        { appSlug: O.none() },
        ["KNOWLEDGE_MINT_APP_SLUG is unset, so the mint App's pull-request author is unknown."],
      ],
      [
        "an empty App slug",
        { appSlug: O.some("") },
        ["KNOWLEDGE_MINT_APP_SLUG is unset, so the mint App's pull-request author is unknown."],
      ],
      [
        "no pull-request payload",
        { author: O.none(), headRef: O.none(), headRepository: O.none() },
        [
          `The head branch is unknown, not ${KNOWLEDGE_MINT_BRANCH}.`,
          `The head branch lives in unknown, not ${REPOSITORY}.`,
          "The pull request author is unknown, not beep-knowledge-mint[bot].",
        ],
      ],
    ];
    for (const [name, overrides, expected] of fixtures) {
      assert.deepStrictEqual(knowledgeMintPullRequestRefusals(pullRequest(overrides)), expected, name);
    }
  });

  it("admits a baseline change only when conditions (i) through (iv) all hold", () => {
    const entry = KnowledgeBaselineEntry.make({
      key: `knowledge-doctor/v1:${Str.repeat(64)("a")}`,
      group: "unresolved-reference",
      kind: "broken-tracked-path",
      document: "docs/a.md",
      subject: "repo-path:docs/gone.md",
      spanClass: "verified",
      owners: ["@kriegcloud"],
    });
    const head = seal({
      baseline: O.some(
        KnowledgeDoctorBaseline.make({ mintedAt: MINTED, note: "Sealed knowledge-doctor baseline.", entries: [entry] })
      ),
    });
    // The quality lane passes the acceptance facts only when condition (i) holds.
    const rules = (
      pr: KnowledgeMintPullRequest,
      acceptance: KnowledgeMintAcceptance,
      changedPaths: ReadonlyArray<string>
    ) =>
      A.map(
        knowledgeSealGuard(
          KnowledgeSealGuardInput.make({
            acceptMint: A.isReadonlyArrayEmpty(knowledgeMintPullRequestRefusals(pr)) ? O.some(acceptance) : O.none(),
            base: EMPTY_SEAL,
            head,
            changedPaths,
          })
        ),
        (candidate) => candidate.subject
      );
    const rule = (name: string) => `baseline-tamper:${KNOWLEDGE_DOCTOR_BASELINE_PATH}:${name}`;
    const holds = KnowledgeMintAcceptance.make({ mintedAtIsAncestor: true, reproduces: true });
    const baselineOnly = [KNOWLEDGE_DOCTOR_BASELINE_PATH];
    assert.deepStrictEqual(rules(pullRequest(), holds, baselineOnly), []);
    // (i) fails: any other author or branch is a plain non-removal tamper.
    assert.deepStrictEqual(rules(pullRequest({ author: O.some("kriegcloud") }), holds, baselineOnly), [
      rule("non-removal"),
    ]);
    assert.deepStrictEqual(rules(pullRequest({ headRef: O.some("feat/seal") }), holds, baselineOnly), [
      rule("non-removal"),
    ]);
    // (ii) fails: the mint diff touches another path.
    assert.deepStrictEqual(rules(pullRequest(), holds, [...baselineOnly, "docs/a.md"]), [
      rule("mint-diff-not-baseline-only"),
    ]);
    // (iii) fails: mintedAt is not an ancestor of the merge-base.
    assert.deepStrictEqual(
      rules(pullRequest(), KnowledgeMintAcceptance.make({ mintedAtIsAncestor: false, reproduces: true }), baselineOnly),
      [rule("minted-at-not-ancestor")]
    );
    // (iv) fails: the re-mint at mintedAt does not reproduce the bytes.
    assert.deepStrictEqual(
      rules(pullRequest(), KnowledgeMintAcceptance.make({ mintedAtIsAncestor: true, reproduces: false }), baselineOnly),
      [rule("mint-not-reproducible")]
    );
  });

  it("writes only in CI, on a clean checkout of the minted commit, at a commit the base contains", () => {
    assert.deepStrictEqual(knowledgeMintWriteRefusals(writeContext()), []);
    assert.deepStrictEqual(
      knowledgeMintWriteRefusals(writeContext({ ci: false, clean: false, headIsMinted: false, onBase: false })),
      [
        "CI is not true; only the mint workflow writes the sealed baseline.",
        "Tracked files differ from HEAD; the mint writes only onto a clean checkout.",
        `HEAD is not ${MINTED}; check out the minted commit before writing its baseline.`,
        `origin/main does not contain ${MINTED}; mint a default-branch commit.`,
      ]
    );
  });

  it("keeps the quality lane report-only until the merge-base is sealed or the branch touches the seal", () => {
    const mode = (sealedAtBase: boolean, changedPaths: ReadonlyArray<string>) =>
      decideKnowledgeDoctorCiMode(KnowledgeDoctorCiModeInput.make({ sealedAtBase, changedPaths }));
    assert.strictEqual(mode(false, ["docs/a.md"]), "report");
    assert.strictEqual(mode(false, []), "report");
    assert.strictEqual(mode(false, ["goals/knowledge-doctor.leases.jsonc"]), "report");
    assert.strictEqual(mode(false, [KNOWLEDGE_DOCTOR_BASELINE_PATH]), "gate");
    assert.strictEqual(mode(false, ["docs/a.md", KNOWLEDGE_DOCTOR_PROMOTIONS_PATH]), "gate");
    assert.strictEqual(mode(true, ["docs/a.md"]), "gate");
    assert.strictEqual(mode(true, []), "gate");
  });

  it("renders the mint outcome without the file text", () => {
    const baseline = KnowledgeDoctorBaseline.make({ mintedAt: MINTED, note: "n", entries: [] });
    const outcome = (changed: boolean) => KnowledgeMintOutcome.make({ baseline, text: "SECRET-TEXT", changed });
    const render = (changed: boolean, write: boolean) => renderKnowledgeMintOutcome(outcome(changed), write);
    assert.include(render(true, true), "written: goals/knowledge-doctor.baseline.jsonc");
    assert.include(render(true, false), "dry run");
    assert.include(render(false, true), "unchanged");
    assert.notInclude(render(true, true), "SECRET-TEXT");
    assert.include(render(true, false), `knowledge doctor mint @ ${MINTED}: 0 sealed entr(ies)`);
  });
});
