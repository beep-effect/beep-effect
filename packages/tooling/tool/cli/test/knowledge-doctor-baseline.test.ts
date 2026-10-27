import {
  checkKnowledgeDoctorReport,
  classifyKnowledgeBaselineGroup,
  encodeKnowledgeBaselineText,
  evaluateKnowledgeLeases,
  isKnowledgeLeaseEffective,
  KNOWLEDGE_DOCTOR_BASELINE_PATH,
  KNOWLEDGE_DOCTOR_BASELINE_PENDING_MESSAGE,
  KNOWLEDGE_DOCTOR_LEASES_PATH,
  KNOWLEDGE_DOCTOR_PROMOTIONS_PATH,
  KnowledgeBaselineEntry,
  KnowledgeBaselineGroupInput,
  KnowledgeDebtLease,
  KnowledgeDebtLeases,
  KnowledgeDoctor,
  KnowledgeDoctorBaseline,
  KnowledgeDoctorCheckInput,
  KnowledgeDoctorCheckOptions,
  KnowledgeDoctorIdentity,
  KnowledgeDoctorLeasesOptions,
  KnowledgeDoctorLive,
  KnowledgeDoctorPromotion,
  KnowledgeDoctorPromotions,
  KnowledgeIdentityInput,
  KnowledgeIdentityMapping,
  KnowledgeLeaseEvaluationInput,
  KnowledgeMintAcceptance,
  KnowledgePathRemoval,
  KnowledgeSealFiles,
  KnowledgeSealGuardInput,
  knowledgeDoctorGateFailure,
  knowledgeRemovedPackageNames,
  knowledgeSealGuard,
  knowledgeShallowHistoryError,
  makeKnowledgeDoctorMemoryTree,
  mintKnowledgeBaseline,
  readKnowledgeSealFiles,
  resolveKnowledgeCodeowners,
  resolveKnowledgeDocumentIdentity,
  scanKnowledgeDoctorTree,
  verifyKnowledgeBaselineText,
} from "@beep/repo-cli/commands/Knowledge";
import { CacheRuntimeProcess as StepExec } from "@beep/repo-cli/test/Cache";
import { renderKnowledgeDoctorCheckReport } from "@beep/repo-cli/test/Knowledge";
import { CapturedStreams } from "@beep/repo-cli/test/Process";
import { knowledgeLeaseWarningLines, warnKnowledgeLeases } from "@beep/repo-cli/test/Yeet";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { assert, describe, vi } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { temporaryWorkingDirectory } from "./support/CommandTest.ts";
import type { KnowledgeDoctorReport, KnowledgeDoctorTree } from "@beep/repo-cli/commands/Knowledge";

const platformLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);
const testLayer = Layer.provideMerge(KnowledgeDoctorLive, platformLayer);

const MINTED = "0000000000000000000000000000000000000000";
const MERGE_BASE = "1111111111111111111111111111111111111111";
const PROMOTED_AT = "2222222222222222222222222222222222222222";
const NOW = DateTime.makeUnsafe("2026-10-14T00:00:00Z");
const CODEOWNERS = "* @kriegcloud\n";

const doc = (...lines: ReadonlyArray<string>): string => A.join(lines, "\n");

const EMPTY_SEAL = KnowledgeSealFiles.make({
  baseline: O.none(),
  baselineText: O.none(),
  codeowners: O.some(CODEOWNERS),
  identity: O.none(),
  leases: O.none(),
  promotions: O.none(),
});

const seal = (overrides: Partial<KnowledgeSealFiles>): KnowledgeSealFiles =>
  KnowledgeSealFiles.make({ ...EMPTY_SEAL, ...overrides });

const promotions = (...kinds: ReadonlyArray<KnowledgeDoctorPromotion["kind"]>) =>
  KnowledgeDoctorPromotions.make({
    promotions: A.map(kinds, (kind) =>
      KnowledgeDoctorPromotion.make({ kind, promotedAt: PROMOTED_AT, windowEvidence: `c7 window for ${kind}` })
    ),
  });

const lease = (overrides: Readonly<Record<string, string>> & { readonly key: string }) =>
  S.decodeUnknownEffect(KnowledgeDebtLease)({
    document: "docs/a.md",
    owner: "@kriegcloud",
    reason: "The target lands in the next PR.",
    issued: "2026-10-01T00:00:00Z",
    expires: "2026-10-28T00:00:00Z",
    ...overrides,
  });

const leaseFile = (...rows: ReadonlyArray<KnowledgeDebtLease>) => KnowledgeDebtLeases.make({ leases: rows });

const baseTree = (extra: Readonly<Record<string, string>> = {}): KnowledgeDoctorTree =>
  makeKnowledgeDoctorMemoryTree({
    files: {
      "docs/a.md": doc("See `docs/gone.md` and `docs/also-gone.md`."),
      "docs/b.md": doc("`@beep/schema` is retired; see `docs/retired.md`."),
      ...extra,
    },
  });

const mintFirstSeal = Effect.fnUntraced(function* (tree: KnowledgeDoctorTree, files: KnowledgeSealFiles = EMPTY_SEAL) {
  const report = yield* scanKnowledgeDoctorTree(tree);
  const baseline = yield* mintKnowledgeBaseline({
    tree,
    report,
    removals: O.some([]),
    files,
    previousPromotions: [],
  });
  return { report, baseline } as const;
});

const checkOf = (report: KnowledgeDoctorReport, overrides: Partial<KnowledgeDoctorCheckInput>) =>
  checkKnowledgeDoctorReport(
    KnowledgeDoctorCheckInput.make({
      acceptMint: O.none(),
      base: EMPTY_SEAL,
      baseRef: "origin/main",
      changedPaths: [],
      head: EMPTY_SEAL,
      headPaths: HashSet.empty(),
      mergeBase: MERGE_BASE,
      mintedAtPaths: HashSet.empty(),
      now: NOW,
      renames: [],
      report,
      removals: O.some([]),
      ...overrides,
    })
  );

const ratchetOf = (report: KnowledgeDoctorReport) => Effect.fromOption(report.ratchet);

const tamperRules = (head: KnowledgeSealFiles, base: KnowledgeSealFiles, changedPaths: ReadonlyArray<string> = []) =>
  A.map(
    knowledgeSealGuard(KnowledgeSealGuardInput.make({ acceptMint: O.none(), base, head, changedPaths })),
    (candidate) => candidate.subject
  );

describe("knowledge doctor sealed baseline", () => {
  it.layer(testLayer, { timeout: "60 seconds" })((it) => {
    it.effect(
      "mints the first seal over every baselineable finding, deterministically and byte-reproducibly",
      Effect.fnUntraced(function* () {
        const { report, baseline } = yield* mintFirstSeal(baseTree());
        const owned = A.filter(report.findings, (row) => row.spanClass !== "unclassified");
        assert.strictEqual(A.length(baseline.entries), A.length(owned));
        assert.strictEqual(baseline.mintedAt, MINTED);
        const again = yield* mintFirstSeal(baseTree());
        const text = yield* encodeKnowledgeBaselineText(baseline);
        assert.strictEqual(text, yield* encodeKnowledgeBaselineText(again.baseline));
        assert.isTrue(Str.endsWith("\n")(text));
        yield* verifyKnowledgeBaselineText(text, again.baseline);
        const broken = yield* Effect.flip(verifyKnowledgeBaselineText(`${text} `, again.baseline));
        assert.strictEqual(broken._tag, "KnowledgeSealBroken");
        const reordered = KnowledgeDoctorBaseline.make({ ...baseline, entries: A.reverse(baseline.entries) });
        assert.strictEqual(yield* encodeKnowledgeBaselineText(reordered), text);
      })
    );

    it.effect(
      "groups inherited debt by name: prohibition lines, deleted-target rot, and other unresolved targets",
      Effect.fnUntraced(function* () {
        const tree = baseTree();
        const report = yield* scanKnowledgeDoctorTree(tree);
        const baseline = yield* mintKnowledgeBaseline({
          tree,
          report,
          removals: O.some([
            KnowledgePathRemoval.make({
              path: "docs/gone.md",
              commit: PROMOTED_AT,
              subject: "docs: drop the guide",
              change: "deleted",
              renamedTo: O.none(),
            }),
          ]),
          files: EMPTY_SEAL,
          previousPromotions: [],
        });
        const groupOf = (subject: string) =>
          A.findFirst(baseline.entries, (entry) => entry.subject === subject).pipe(O.map((entry) => entry.group));
        // The rot group needs the cause group's attribution, which the report computes from the
        // tree's own removals; the memory tree has none, so docs/gone.md stays unresolved here.
        assertSome(groupOf("repo-path:docs/gone.md"), "unresolved-reference");
        assertSome(groupOf("repo-path:docs/retired.md"), "prohibition-of-retired-surface");
        const rot = yield* mintFirstSeal(
          makeKnowledgeDoctorMemoryTree({
            files: { "docs/a.md": "See `docs/gone.md`." },
            pathRemovals: O.some([
              KnowledgePathRemoval.make({
                path: "docs/gone.md",
                commit: PROMOTED_AT,
                subject: "docs: drop the guide",
                change: "deleted",
                renamedTo: O.none(),
              }),
            ]),
          })
        );
        assert.deepStrictEqual(
          A.map(rot.baseline.entries, (entry) => entry.group),
          ["deleted-target-rot"]
        );
        assert.deepStrictEqual(rot.baseline.entries[0]?.owners, ["@kriegcloud"]);
        const removedPackages = knowledgeRemovedPackageNames([
          KnowledgePathRemoval.make({
            path: "packages/law-practice/domain/package.json",
            commit: PROMOTED_AT,
            subject: "chore: retire",
            change: "deleted",
            renamedTo: O.none(),
          }),
        ]);
        assert.isTrue(HashSet.has(removedPackages, "domain"));
        assert.isTrue(HashSet.has(removedPackages, "law-practice-domain"));
        assertSome(groupOf("beep-package:@beep/schema"), "prohibition-of-retired-surface");
        const removedLineGroup = classifyKnowledgeBaselineGroup(
          KnowledgeBaselineGroupInput.make({
            row: O.getOrThrow(A.head(report.findings)),
            line: O.some("`docs/gone.md` was removed in #12."),
            attributed: false,
            removedPackages: HashSet.empty(),
          })
        );
        assert.strictEqual(removedLineGroup, "prohibition-of-retired-surface");
      })
    );

    it.effect(
      "refuses to launder: a new finding of a promoted kind blocks the mint, a newly promoted kind is admitted, a leased one is never minted",
      Effect.fnUntraced(function* () {
        const first = yield* mintFirstSeal(
          makeKnowledgeDoctorMemoryTree({ files: { "docs/a.md": "See `docs/gone.md`." } })
        );
        const grown = makeKnowledgeDoctorMemoryTree({
          files: { "docs/a.md": doc("See `docs/gone.md`.", "Then `docs/new-gap.md`.") },
        });
        const report = yield* scanKnowledgeDoctorTree(grown);
        const promoted = seal({
          baseline: O.some(first.baseline),
          promotions: O.some(promotions("broken-tracked-path")),
        });
        const refusal = yield* Effect.flip(
          mintKnowledgeBaseline({
            tree: grown,
            report,
            removals: O.some([]),
            files: promoted,
            previousPromotions: promotions("broken-tracked-path").promotions,
          })
        );
        assert.strictEqual(refusal._tag, "KnowledgeMintRefusal");
        assert.strictEqual(refusal._tag === "KnowledgeMintRefusal" ? A.length(refusal.refused) : 0, 1);
        const newlyPromoted = yield* mintKnowledgeBaseline({
          tree: grown,
          report,
          removals: O.some([]),
          files: promoted,
          previousPromotions: [],
        });
        assert.strictEqual(A.length(newlyPromoted.entries), 2);
        const reportOnly = yield* mintKnowledgeBaseline({
          tree: grown,
          report,
          removals: O.some([]),
          files: seal({ baseline: O.some(first.baseline) }),
          previousPromotions: [],
        });
        assert.deepStrictEqual(reportOnly.entries, first.baseline.entries);
        const newKey = A.findFirst(newlyPromoted.entries, (entry) => entry.subject === "repo-path:docs/new-gap.md");
        const leased = yield* lease({ key: O.getOrThrow(newKey).key });
        const withLease = yield* mintKnowledgeBaseline({
          tree: grown,
          report,
          removals: O.some([]),
          files: seal({ ...promoted, leases: O.some(leaseFile(leased)) }),
          previousPromotions: promotions("broken-tracked-path").promotions,
        });
        assert.deepStrictEqual(withLease.entries, first.baseline.entries);
        const shallow = yield* Effect.flip(
          mintKnowledgeBaseline({ tree: grown, report, removals: O.none(), files: EMPTY_SEAL, previousPromotions: [] })
        );
        assert.strictEqual(
          shallow._tag === "KnowledgeDoctorInputError" ? shallow.reason : shallow._tag,
          "shallow-history"
        );
      })
    );

    it.effect(
      "classifies introduced-only: inherited keys stay advisory, promoted new keys block, report-only kinds stay pending",
      Effect.fnUntraced(function* () {
        const first = yield* mintFirstSeal(
          makeKnowledgeDoctorMemoryTree({ files: { "docs/a.md": "See `docs/gone.md`." } })
        );
        const report = yield* scanKnowledgeDoctorTree(
          makeKnowledgeDoctorMemoryTree({
            files: {
              "docs/a.md": doc("See `docs/gone.md`.", "Then `docs/new-gap.md`."),
              "history/x.md": "`docs/q.md`",
            },
          })
        );
        const baselineFiles = seal({ baseline: O.some(first.baseline) });
        const pending = yield* checkOf(report, { head: baselineFiles, base: baselineFiles });
        const pendingRatchet = yield* ratchetOf(pending);
        assert.strictEqual(A.length(pendingRatchet.inherited), 1);
        assert.strictEqual(A.length(pendingRatchet.pending), 1);
        assert.strictEqual(A.length(pendingRatchet.introduced), 0);
        assertNone(knowledgeDoctorGateFailure(pending));
        const promotedBase = seal({
          baseline: O.some(first.baseline),
          promotions: O.some(promotions("broken-tracked-path")),
        });
        const gated = yield* checkOf(report, { head: promotedBase, base: promotedBase });
        const gatedRatchet = yield* ratchetOf(gated);
        assert.strictEqual(A.length(gatedRatchet.introduced), 1);
        assert.strictEqual(gated.mode, "check");
        const failure = knowledgeDoctorGateFailure(gated);
        assert.strictEqual(O.getOrThrow(failure).introducedCount, 1);
        assert.include(renderKnowledgeDoctorCheckReport(gated), "introduced (1):");
        const ratcheted = HashSet.fromIterable(
          A.flatMap(
            [gatedRatchet.introduced, gatedRatchet.pending, gatedRatchet.inherited, gatedRatchet.leased],
            A.map((entry) => entry.findingId)
          )
        );
        for (const row of report.findings) {
          if (row.spanClass === "unclassified" || row.origin === "delegated") {
            assert.isFalse(HashSet.has(ratcheted, row.finding.findingId), row.finding.subject);
          }
        }
        // Counterfactual: the inherited finding is introduced again once its key leaves the baseline.
        const pruned = KnowledgeDoctorBaseline.make({ ...first.baseline, entries: [] });
        const prunedFiles = seal({ baseline: O.some(pruned), promotions: O.some(promotions("broken-tracked-path")) });
        const counterfactual = yield* ratchetOf(
          yield* checkOf(report, { head: prunedFiles, base: seal({ ...promotedBase, baseline: O.some(pruned) }) })
        );
        assert.strictEqual(A.length(counterfactual.introduced), 2);
        assert.strictEqual(A.length(counterfactual.inherited), 0);
        assert.deepStrictEqual(
          (yield* ratchetOf(yield* checkOf(report, { head: prunedFiles, base: promotedBase }))).resolved,
          []
        );
      })
    );

    it.effect(
      "keeps the key across a rename through git lineage and through an admitted sidecar mapping",
      Effect.fnUntraced(function* () {
        const first = yield* mintFirstSeal(
          makeKnowledgeDoctorMemoryTree({ files: { "docs/old.md": "See `docs/gone.md`." } })
        );
        const moved = yield* scanKnowledgeDoctorTree(
          makeKnowledgeDoctorMemoryTree({ files: { "docs/new.md": "See `docs/gone.md`." } })
        );
        const files = seal({ baseline: O.some(first.baseline), promotions: O.some(promotions("broken-tracked-path")) });
        const withoutLineage = yield* ratchetOf(yield* checkOf(moved, { head: files, base: files }));
        assert.strictEqual(A.length(withoutLineage.introduced), 1);
        const lineage = yield* ratchetOf(
          yield* checkOf(moved, { head: files, base: files, renames: [["docs/old.md", "docs/new.md"]] })
        );
        assert.strictEqual(A.length(lineage.inherited), 1);
        const sidecar = KnowledgeDoctorIdentity.make({
          mappings: [KnowledgeIdentityMapping.make({ from: "docs/old.md", to: "docs/new.md" })],
        });
        const viaSidecar = yield* ratchetOf(
          yield* checkOf(moved, {
            head: seal({ ...files, identity: O.some(sidecar) }),
            base: files,
            mintedAtPaths: HashSet.make("docs/old.md"),
            headPaths: HashSet.make("docs/new.md"),
          })
        );
        assert.strictEqual(A.length(viaSidecar.inherited), 1);
        const rejected = resolveKnowledgeDocumentIdentity(
          KnowledgeIdentityInput.make({
            renames: [],
            sidecar: [
              KnowledgeIdentityMapping.make({ from: "docs/old.md", to: "docs/new.md" }),
              KnowledgeIdentityMapping.make({ from: "docs/kept.md", to: "docs/other.md" }),
            ],
            mintedAtPaths: HashSet.make("docs/old.md", "docs/kept.md"),
            headPaths: HashSet.make("docs/new.md", "docs/kept.md", "docs/other.md"),
          })
        );
        assert.deepStrictEqual(rejected.rejected, ["docs/kept.md -> docs/other.md: source still present"]);
        assertSome(HashMap.get(rejected.identity, "docs/new.md"), "docs/old.md");
      })
    );

    it.effect(
      "blocks every non-mint baseline edit and lets pure deletion and key reordering through",
      Effect.fnUntraced(function* () {
        const { baseline } = yield* mintFirstSeal(baseTree());
        const base = seal({ baseline: O.some(baseline) });
        const entry = O.getOrThrow(A.head(baseline.entries));
        const replaceFirst = (next: KnowledgeBaselineEntry) =>
          seal({
            baseline: O.some(
              KnowledgeDoctorBaseline.make({ ...baseline, entries: [next, ...A.drop(baseline.entries, 1)] })
            ),
          });
        assert.deepStrictEqual(
          tamperRules(
            seal({
              baseline: O.some(KnowledgeDoctorBaseline.make({ ...baseline, entries: A.drop(baseline.entries, 1) })),
            }),
            base
          ),
          []
        );
        assert.deepStrictEqual(
          tamperRules(
            seal({
              baseline: O.some(KnowledgeDoctorBaseline.make({ ...baseline, entries: A.reverse(baseline.entries) })),
            }),
            base
          ),
          []
        );
        const nonRemoval = `baseline-tamper:${KNOWLEDGE_DOCTOR_BASELINE_PATH}:non-removal`;
        for (const head of [
          replaceFirst(KnowledgeBaselineEntry.make({ ...entry, kind: "unknown-beep-command" })),
          replaceFirst(KnowledgeBaselineEntry.make({ ...entry, subject: "repo-path:docs/elsewhere.md" })),
          replaceFirst(KnowledgeBaselineEntry.make({ ...entry, spanClass: "historical-with-commit" })),
          replaceFirst(KnowledgeBaselineEntry.make({ ...entry, group: "deleted-target-rot" })),
          seal({
            baseline: O.some(
              KnowledgeDoctorBaseline.make({
                ...baseline,
                entries: A.append(
                  baseline.entries,
                  KnowledgeBaselineEntry.make({ ...entry, key: `knowledge-doctor/v1:${Str.repeat(64)("f")}` })
                ),
              })
            ),
          }),
          seal({ baseline: O.some(KnowledgeDoctorBaseline.make({ ...baseline, mintedAt: PROMOTED_AT })) }),
          seal({ baseline: O.some(KnowledgeDoctorBaseline.make({ ...baseline, note: "edited" })) }),
        ]) {
          assert.deepStrictEqual(tamperRules(head, base), [nonRemoval]);
        }
        assert.deepStrictEqual(tamperRules(EMPTY_SEAL, base), [
          `baseline-tamper:${KNOWLEDGE_DOCTOR_BASELINE_PATH}:removed`,
        ]);
        assert.deepStrictEqual(tamperRules(base, EMPTY_SEAL), [nonRemoval]);
        const mintRules = (acceptance: KnowledgeMintAcceptance, changedPaths: ReadonlyArray<string>) =>
          A.map(
            knowledgeSealGuard(
              KnowledgeSealGuardInput.make({
                acceptMint: O.some(acceptance),
                base: EMPTY_SEAL,
                head: base,
                changedPaths,
              })
            ),
            (candidate) => candidate.subject
          );
        const good = KnowledgeMintAcceptance.make({ mintedAtIsAncestor: true, reproduces: true });
        assert.deepStrictEqual(mintRules(good, [KNOWLEDGE_DOCTOR_BASELINE_PATH]), []);
        assert.deepStrictEqual(mintRules(good, [KNOWLEDGE_DOCTOR_BASELINE_PATH, "docs/a.md"]), [
          `baseline-tamper:${KNOWLEDGE_DOCTOR_BASELINE_PATH}:mint-diff-not-baseline-only`,
        ]);
        assert.deepStrictEqual(
          mintRules(KnowledgeMintAcceptance.make({ mintedAtIsAncestor: true, reproduces: false }), [
            KNOWLEDGE_DOCTOR_BASELINE_PATH,
          ]),
          [`baseline-tamper:${KNOWLEDGE_DOCTOR_BASELINE_PATH}:mint-not-reproducible`]
        );
        assert.deepStrictEqual(
          mintRules(KnowledgeMintAcceptance.make({ mintedAtIsAncestor: false, reproduces: true }), [
            KNOWLEDGE_DOCTOR_BASELINE_PATH,
          ]),
          [`baseline-tamper:${KNOWLEDGE_DOCTOR_BASELINE_PATH}:minted-at-not-ancestor`]
        );
        const report = yield* scanKnowledgeDoctorTree(baseTree());
        const tampered = yield* checkOf(report, {
          base,
          head: seal({ baseline: O.some(KnowledgeDoctorBaseline.make({ ...baseline, note: "edited" })) }),
        });
        assert.strictEqual(O.getOrThrow(knowledgeDoctorGateFailure(tampered)).governanceCount, 1);
      })
    );

    it.effect(
      "admits promotion rows only as one appended row in a promotions-only diff",
      Effect.fnUntraced(function* () {
        const base = seal({ promotions: O.some(promotions("broken-tracked-path")) });
        const rule = (name: string) => `baseline-tamper:${KNOWLEDGE_DOCTOR_PROMOTIONS_PATH}:${name}`;
        assert.deepStrictEqual(
          tamperRules(seal({ promotions: O.some(promotions("broken-tracked-path", "unknown-beep-command")) }), base, [
            KNOWLEDGE_DOCTOR_PROMOTIONS_PATH,
          ]),
          []
        );
        assert.deepStrictEqual(tamperRules(seal({ promotions: O.some(promotions()) }), base), [
          rule("edited-or-removed"),
        ]);
        assert.deepStrictEqual(tamperRules(EMPTY_SEAL, base), [rule("edited-or-removed")]);
        assert.deepStrictEqual(tamperRules(seal({ promotions: O.some(promotions("unknown-beep-command")) }), base), [
          rule("edited-or-removed"),
        ]);
        assert.deepStrictEqual(
          tamperRules(
            seal({
              promotions: O.some(promotions("broken-tracked-path", "unknown-beep-command", "unknown-beep-symbol")),
            }),
            base,
            [KNOWLEDGE_DOCTOR_PROMOTIONS_PATH]
          ),
          [rule("more-than-one-row")]
        );
        assert.deepStrictEqual(
          tamperRules(seal({ promotions: O.some(promotions("broken-tracked-path", "unknown-beep-command")) }), base, [
            KNOWLEDGE_DOCTOR_PROMOTIONS_PATH,
            "docs/a.md",
          ]),
          [rule("promotion-diff-not-promotions-only")]
        );
        assert.deepStrictEqual(
          tamperRules(seal({ promotions: O.some(promotions("broken-tracked-path", "broken-tracked-path")) }), base, [
            KNOWLEDGE_DOCTOR_PROMOTIONS_PATH,
          ]),
          [rule("kind-already-promoted")]
        );
      })
    );

    it.effect(
      "binds leases to merge-base CODEOWNERS and enforces lifetime, immutable issued, and quotas",
      Effect.fnUntraced(function* () {
        const key = (digit: string) => `knowledge-doctor/v1:${Str.repeat(64)(digit)}`;
        const evaluate = (
          leases: ReadonlyArray<KnowledgeDebtLease>,
          baseLeases: ReadonlyArray<KnowledgeDebtLease> = [],
          codeowners: O.Option<string> = O.some(CODEOWNERS)
        ) => evaluateKnowledgeLeases(KnowledgeLeaseEvaluationInput.make({ leases, baseLeases, codeowners, now: NOW }));
        const violationsOf = (rows: ReadonlyArray<{ readonly violations: ReadonlyArray<string> }>) =>
          A.map(rows, (row) => row.violations);

        assert.deepStrictEqual(violationsOf(yield* evaluate([yield* lease({ key: key("1") })])), [[]]);
        assert.deepStrictEqual(violationsOf(yield* evaluate([yield* lease({ key: key("1"), owner: "@someone" })])), [
          ["lease-owner-unresolved"],
        ]);
        // A branch cannot grant itself ownership: only the merge-base CODEOWNERS text is consulted.
        assert.deepStrictEqual(
          violationsOf(
            yield* evaluate([yield* lease({ key: key("1"), owner: "@self" })], [], O.some("* @kriegcloud\n"))
          ),
          [["lease-owner-unresolved"]]
        );
        const future = yield* evaluate([
          yield* lease({
            key: key("1"),
            issued: "2099-01-01T00:00:00Z",
            expires: "2099-01-30T00:00:00Z",
          }),
        ]);
        assert.deepStrictEqual(violationsOf(future), [["lease-issued-in-future"]]);
        assert.strictEqual(isKnowledgeLeaseEffective(future[0]!), false);
        assert.deepStrictEqual(resolveKnowledgeCodeowners("* @a\ndocs/ @b @c\ndocs/x.md\n", "docs/y.md"), ["@b", "@c"]);
        assert.deepStrictEqual(resolveKnowledgeCodeowners("* @a\ndocs/ @b @c\ndocs/x.md\n", "docs/x.md"), []);
        assert.deepStrictEqual(
          violationsOf(
            yield* evaluate([
              yield* lease({ key: key("1"), issued: "2026-10-01T00:00:00Z", expires: "2026-11-01T00:00:00Z" }),
            ])
          ),
          [["lease-lifetime-exceeded"]]
        );
        assert.deepStrictEqual(
          violationsOf(
            yield* evaluate(
              [yield* lease({ key: key("1"), issued: "2026-10-10T00:00:00Z", expires: "2026-11-05T00:00:00Z" })],
              [yield* lease({ key: key("1"), issued: "2026-10-01T00:00:00Z" })]
            )
          ),
          [["lease-lifetime-exceeded"]]
        );
        const third = yield* evaluate([
          yield* lease({ key: key("1"), issued: "2026-10-01T00:00:00Z" }),
          yield* lease({ key: key("2"), issued: "2026-10-02T00:00:00Z" }),
          yield* lease({ key: key("3"), issued: "2026-10-03T00:00:00Z" }),
        ]);
        assert.deepStrictEqual(violationsOf(third), [[], [], ["lease-quota-exceeded"]]);
        const repoWide = yield* evaluate(
          yield* Effect.forEach(A.range(1, 21), (index) =>
            lease({
              key: `knowledge-doctor/v1:${Str.padStart(64, "0")(`${index}`)}`,
              document: `docs/doc-${index}.md`,
              issued: "2026-10-01T00:00:00Z",
              expires: "2026-10-30T00:00:00Z",
            })
          )
        );
        assert.strictEqual(A.length(A.filter(repoWide, (row) => A.isReadonlyArrayNonEmpty(row.violations))), 1);
        const statuses = yield* evaluate([
          yield* lease({ key: key("1"), expires: "2026-10-20T00:00:00Z" }),
          yield* lease({ key: key("2"), document: "docs/b.md", expires: "2026-10-14T00:00:00Z" }),
        ]);
        assert.deepStrictEqual(
          A.map(statuses, (row) => row.status),
          ["expiring", "expired"]
        );
        const missing = yield* Effect.flip(evaluate([yield* lease({ key: key("1") })], [], O.none()));
        assert.strictEqual(missing.reason, "missing-codeowners");
        assert.deepStrictEqual(yield* evaluate([], [], O.none()), []);
      })
    );

    it.effect(
      "suppresses an introduced finding under an effective lease and re-blocks it at expiry with lease-expired",
      Effect.fnUntraced(function* () {
        const first = yield* mintFirstSeal(
          makeKnowledgeDoctorMemoryTree({ files: { "docs/a.md": "See `docs/gone.md`." } })
        );
        const report = yield* scanKnowledgeDoctorTree(
          makeKnowledgeDoctorMemoryTree({
            files: { "docs/a.md": doc("See `docs/gone.md`.", "Then `docs/new-gap.md`.") },
          })
        );
        const files = seal({ baseline: O.some(first.baseline), promotions: O.some(promotions("broken-tracked-path")) });
        const probe = yield* ratchetOf(yield* checkOf(report, { head: files, base: files }));
        const introducedKey = O.getOrThrow(A.head(probe.introduced)).key;
        const active = yield* lease({ key: introducedKey });
        const leasedRatchet = yield* checkOf(report, {
          head: seal({ ...files, leases: O.some(leaseFile(active)) }),
          base: files,
        });
        assert.strictEqual(A.length((yield* ratchetOf(leasedRatchet)).leased), 1);
        assertNone(knowledgeDoctorGateFailure(leasedRatchet));
        const future = yield* lease({
          key: introducedKey,
          issued: "2099-01-01T00:00:00Z",
          expires: "2099-01-30T00:00:00Z",
        });
        const futureCheck = yield* checkOf(report, {
          head: seal({ ...files, leases: O.some(leaseFile(future)) }),
          base: files,
        });
        assert.strictEqual(A.length((yield* ratchetOf(futureCheck)).introduced), 1);
        assert.strictEqual(
          A.length(A.filter(futureCheck.findings, (row) => row.finding.kind === "lease-issued-in-future")),
          1
        );
        assert.strictEqual(O.isSome(knowledgeDoctorGateFailure(futureCheck)), true);
        assert.include(renderKnowledgeDoctorCheckReport(futureCheck), "lease-issued-in-future");
        const elsewhere = yield* lease({ key: introducedKey, document: "docs/b.md" });
        const misplaced = yield* ratchetOf(
          yield* checkOf(report, { head: seal({ ...files, leases: O.some(leaseFile(elsewhere)) }), base: files })
        );
        assert.strictEqual(A.length(misplaced.introduced), 1);
        const expired = yield* checkOf(report, {
          head: seal({ ...files, leases: O.some(leaseFile(active)) }),
          base: files,
          now: DateTime.makeUnsafe("2026-10-28T00:00:00Z"),
        });
        const expiredRatchet = yield* ratchetOf(expired);
        assert.strictEqual(A.length(expiredRatchet.introduced), 1);
        const expiredRow = O.getOrThrow(A.findFirst(expired.findings, (row) => row.finding.kind === "lease-expired"));
        assert.strictEqual(expiredRow.finding.location.path, KNOWLEDGE_DOCTOR_LEASES_PATH);
        const introducedRow = O.getOrThrow(
          A.findFirst(expired.findings, (row) => row.finding.findingId === expiredRatchet.introduced[0]?.findingId)
        );
        assert.strictEqual(expiredRow.causeKey, introducedRow.causeKey);
        const gate = O.getOrThrow(knowledgeDoctorGateFailure(expired));
        assert.deepStrictEqual([gate.introducedCount, gate.governanceCount], [1, 1]);
      })
    );

    it.effect(
      "fails closed with a typed input error for every degraded seal input",
      Effect.fnUntraced(function* () {
        const reasonOf = (files: Readonly<Record<string, string>>) =>
          Effect.flip(readKnowledgeSealFiles(makeKnowledgeDoctorMemoryTree({ files }))).pipe(
            Effect.map((error) => (error._tag === "KnowledgeDoctorInputError" ? error.reason : error._tag))
          );
        assert.strictEqual(yield* reasonOf({ [KNOWLEDGE_DOCTOR_BASELINE_PATH]: "{ nope" }), "undecodable-baseline");
        assert.strictEqual(
          yield* reasonOf({
            [KNOWLEDGE_DOCTOR_PROMOTIONS_PATH]: '{ "schemaVersion": "knowledge-doctor-promotions/v1" }',
          }),
          "undecodable-promotions"
        );
        assert.strictEqual(
          yield* reasonOf({
            [KNOWLEDGE_DOCTOR_LEASES_PATH]: '{ "schemaVersion": "knowledge-doctor-leases/v1", "leases": [{}] }',
          }),
          "undecodable-leases"
        );
        assert.strictEqual(
          yield* reasonOf({ "goals/knowledge-doctor.identity.jsonc": '{ "mappings": [] }' }),
          "undecodable-identity"
        );
        const tree = makeKnowledgeDoctorMemoryTree({ files: { [KNOWLEDGE_DOCTOR_BASELINE_PATH]: "{}" } });
        const malformed = yield* Effect.flip(
          readKnowledgeSealFiles({ ...tree, readBytes: () => Effect.succeed(new Uint8Array([0xff, 0xfe, 0x00])) })
        );
        assert.strictEqual(malformed._tag === "KnowledgeDoctorInputError" ? malformed.reason : "", "malformed-utf8");
        const files = yield* readKnowledgeSealFiles(
          makeKnowledgeDoctorMemoryTree({
            files: {
              [KNOWLEDGE_DOCTOR_PROMOTIONS_PATH]:
                '// promotions\n{ "schemaVersion": "knowledge-doctor-promotions/v1", "promotions": [] }',
            },
          })
        );
        assert.strictEqual(O.getOrThrow(files.promotions).promotions.length, 0);
        assertNone(files.baseline);
        const report = yield* scanKnowledgeDoctorTree(baseTree());
        const refusal = yield* Effect.flip(checkOf(report, {}));
        assert.strictEqual(
          refusal._tag === "KnowledgeDoctorInputError" ? refusal.message : "",
          KNOWLEDGE_DOCTOR_BASELINE_PENDING_MESSAGE
        );
        assert.strictEqual(O.getOrThrow(knowledgeShallowHistoryError("true", "origin/main")).reason, "shallow-history");
        assertNone(knowledgeShallowHistoryError("false", "origin/main"));
        const absent = yield* Effect.flip(
          Effect.gen(function* () {
            const doctor = yield* KnowledgeDoctor;
            return yield* doctor.leases(
              KnowledgeDoctorLeasesOptions.make({ baseRef: "refs/heads/knowledge-doctor-no-such-ref", now: NOW })
            );
          })
        );
        assert.strictEqual(absent._tag === "KnowledgeDoctorInputError" ? absent.reason : absent._tag, "absent-ref");
      })
    );

    it.effect(
      "mints, verifies, and checks a sealed baseline through the live Git boundary",
      Effect.fnUntraced(function* () {
        const root = yield* temporaryWorkingDirectory;
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory("docs", { recursive: true });
        yield* fs.makeDirectory("goals", { recursive: true });
        yield* fs.makeDirectory(".github", { recursive: true });
        yield* fs.writeFileString(".github/CODEOWNERS", CODEOWNERS);
        yield* fs.writeFileString("package.json", '{"name":"synthetic-knowledge-repository","private":true}');
        yield* fs.writeFileString("docs/a.md", "# Synthetic document\n");
        yield* Effect.forEach(
          [
            ["init", "--initial-branch=main"],
            ["add", "."],
            [
              "-c",
              "user.name=Fixture",
              "-c",
              "user.email=fixture@example.invalid",
              "-c",
              "commit.gpgsign=false",
              "commit",
              "-m",
              "fixture",
            ],
            ["branch", "fixture-base"],
          ],
          (args) => StepExec.runCapturedStreams({ command: "git", args, cwd: root, extendEnv: true }),
          { discard: true }
        );
        const doctor = yield* KnowledgeDoctor;
        const missing = yield* doctor
          .check(KnowledgeDoctorCheckOptions.make({ acceptMint: false, baseRef: "fixture-base", now: NOW }))
          .pipe(Effect.flip);
        assert.strictEqual(missing._tag, "KnowledgeDoctorInputError");
        assert.include(missing.message, "baseline");
        const baseline = yield* doctor.mint("HEAD");
        yield* fs.writeFileString(KNOWLEDGE_DOCTOR_BASELINE_PATH, yield* encodeKnowledgeBaselineText(baseline));
        yield* fs.writeFileString(
          "goals/knowledge-doctor.identity.jsonc",
          '{"schemaVersion":"knowledge-doctor-identity/v1","mappings":[]}'
        );
        yield* StepExec.runCapturedStreams({ command: "git", args: ["add", "."], cwd: root, extendEnv: true });
        yield* StepExec.runCapturedStreams({
          command: "git",
          args: [
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "-c",
            "commit.gpgsign=false",
            "commit",
            "-m",
            "sealed baseline",
          ],
          cwd: root,
          extendEnv: true,
        });

        assert.strictEqual((yield* doctor.verifyMint).mintedAt, baseline.mintedAt);
        const checked = yield* doctor.check(
          KnowledgeDoctorCheckOptions.make({ acceptMint: true, baseRef: "fixture-base", now: NOW })
        );
        assert.strictEqual(O.isSome(checked.ratchet), true);
        assert.deepStrictEqual(
          (yield* doctor.leases(KnowledgeDoctorLeasesOptions.make({ baseRef: "fixture-base", now: NOW }))).leases,
          []
        );
        const ordinary = yield* doctor.check(
          KnowledgeDoctorCheckOptions.make({ acceptMint: false, baseRef: "HEAD", now: NOW })
        );
        assert.strictEqual(O.isSome(ordinary.ratchet), true);
        assert.strictEqual((yield* doctor.mint("HEAD")).mintedAt, ordinary.tree);
        yield* fs.writeFileString(
          KNOWLEDGE_DOCTOR_LEASES_PATH,
          `{"schemaVersion":"knowledge-doctor-leases/v1","leases":[{"key":"knowledge-doctor/v1:${Str.repeat(64)("a")}","document":"docs/a.md","owner":"@kriegcloud","reason":"Synthetic boundary fixture.","issued":"2026-10-01T00:00:00Z","expires":"2026-10-28T00:00:00Z"}]}`
        );
        yield* StepExec.runCapturedStreams({ command: "git", args: ["add", "."], cwd: root, extendEnv: true });
        yield* StepExec.runCapturedStreams({
          command: "git",
          args: [
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "-c",
            "commit.gpgsign=false",
            "commit",
            "-m",
            "lease fixture",
          ],
          cwd: root,
          extendEnv: true,
        });
        const leases = yield* doctor.leases(KnowledgeDoctorLeasesOptions.make({ baseRef: "fixture-base", now: NOW }));
        assert.strictEqual(A.length(leases.leases), 1);
        assert.strictEqual(leases.leases[0]?.status, "active");
      })
    );
    it.effect(
      "turns the lease report into yeet warnings and never fails on an unreadable report",
      Effect.fnUntraced(function* () {
        const expiring = yield* lease({
          key: `knowledge-doctor/v1:${Str.repeat(64)("a")}`,
          expires: "2026-10-18T00:00:00Z",
        });
        const rows = yield* evaluateKnowledgeLeases(
          KnowledgeLeaseEvaluationInput.make({
            leases: [expiring],
            baseLeases: [],
            codeowners: O.some(CODEOWNERS),
            now: NOW,
          })
        );
        const stdout = `$ bun run beep\n{"schemaVersion":"knowledge-doctor-leases-report/v1","tree":"${MINTED}","mergeBase":"${MERGE_BASE}","now":"2026-10-14T00:00:00.000Z","leases":[{"key":"${expiring.key}","document":"docs/a.md","owner":"@kriegcloud","expires":"2026-10-18T00:00:00.000Z","status":"${rows[0]?.status ?? ""}","violations":[],"details":[]}]}\n`;
        const lines = yield* knowledgeLeaseWarningLines(0, stdout);
        assert.strictEqual(A.length(lines), 1);
        assert.include(lines[0] ?? "", "expiring");
        assert.include((yield* knowledgeLeaseWarningLines(1, ""))[0] ?? "", "exit 1");
        assert.include((yield* knowledgeLeaseWarningLines(0, "not json"))[0] ?? "", "did not decode");
        assert.include((yield* knowledgeLeaseWarningLines(0, " \n "))[0] ?? "", "did not decode");
      })
    );
    it.effect(
      "keeps unreadable lease commands advisory and restores process capture",
      Effect.fnUntraced(function* () {
        const stdout = `{"schemaVersion":"knowledge-doctor-leases-report/v1","tree":"${MINTED}","mergeBase":"${MERGE_BASE}","now":"2026-10-14T00:00:00.000Z","leases":[]}`;
        const capture = vi
          .spyOn(StepExec, "runCapturedStreams")
          .mockReturnValueOnce(
            Effect.succeed(CapturedStreams.make({ exitCode: 0, stdout, stderr: "", truncated: false }))
          )
          .mockReturnValueOnce(
            Effect.succeed(CapturedStreams.make({ exitCode: 1, stdout: "", stderr: "", truncated: false }))
          )
          .mockReturnValueOnce(
            Effect.fail(PlatformError.systemError({ _tag: "NotFound", module: "ChildProcess", method: "spawn" }))
          );
        yield* Effect.gen(function* () {
          yield* warnKnowledgeLeases("/synthetic-checkout");
          yield* warnKnowledgeLeases("/synthetic-checkout");
          yield* warnKnowledgeLeases("/synthetic-checkout");
          const errors = yield* TestConsole.errorLines;
          assert.strictEqual(A.length(errors), 2);
          assert.include(errors[0] ?? "", "exit 1");
          assert.include(errors[1] ?? "", "did not start");
          assert.deepStrictEqual(capture.mock.calls[0]?.[0], {
            command: "bun",
            args: ["run", "beep", "knowledge", "doctor", "leases", "--json"],
            cwd: "/synthetic-checkout",
            extendEnv: true,
          });
        }).pipe(Effect.ensuring(Effect.sync(() => capture.mockRestore())));
      })
    );
  });
});
