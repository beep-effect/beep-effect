import {
  committedGoalCompletionClaims,
  GoalCompletionClaimsReader,
  GoalSourcedDecision,
  goalCompletionClaims,
  readGoalCompletionClaims,
} from "@beep/repo-cli/commands/Goals/RedAttribution";
import {
  GoalAttributionConflict,
  GoalClaimSet,
  GoalCompletionClaims,
  GoalOperatorRulingClaim,
  GoalRedAttributionClaim,
} from "@beep/repo-cli/test/Goals";
import { runRepoCommandCapture } from "@beep/repo-cli/test/RepoRun";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { NodeCommandTestLayer } from "./support/CommandTest.ts";
import type { GoalClaimScope } from "@beep/repo-cli/commands/Goals/RedAttribution";
import type { GoalAttributedRedCause, GoalClaimSource } from "@beep/repo-cli/test/Goals";

const FINAL = 2966;
const DIRECTORY = "goals/demo/decisions";

const red = (context: string, attribution: string, fix: number) =>
  `    - { context: "${context}", attribution: ${attribution}, fixPullRequest: ${fix} }`;

const reds = (final: number, ...rows: ReadonlyArray<string>) => [
  "redAttribution:",
  `  finalPullRequest: ${final}`,
  "  reds:",
  ...rows,
];

const ruling = (final: number) => ["operatorRuling:", `  finalPullRequest: ${final}`];

const decisionText = (title: string, claims: ReadonlyArray<string>, extra: ReadonlyArray<string> = []) =>
  A.join(
    [
      "---",
      `title: "${title}"`,
      "date: 2026-11-14",
      'reversal: "Delete this file."',
      ...extra,
      ...claims,
      "---",
      "",
      "Evidence.",
      "",
    ],
    "\n"
  );

const sourced = (file: string, source: GoalClaimSource, text: string) =>
  GoalSourcedDecision.make({ path: `${DIRECTORY}/${file}`, source, text });

const claim = (
  context: string,
  attribution: GoalAttributedRedCause,
  fixPullRequest: number,
  file: string,
  source: GoalClaimSource
) =>
  GoalRedAttributionClaim.make({ context, attribution, fixPullRequest, decisionFile: `${DIRECTORY}/${file}`, source });

const rulingClaim = (file: string, source: GoalClaimSource) =>
  GoalOperatorRulingClaim.make({ finalPullRequest: FINAL, decisionFile: `${DIRECTORY}/${file}`, source });

const CHECK_INHERITED = decisionText("Check", reds(FINAL, red("Heavy / Check", "inherited", 2994)));

describe("goal completion claims (pure)", () => {
  it.effect("matches claims by final and ignores blocks for other finals", () =>
    Effect.gen(function* () {
      const claims = yield* goalCompletionClaims(
        [
          sourced("2026-11-14-a.md", "origin-main", CHECK_INHERITED),
          sourced(
            "2026-11-14-b.md",
            "origin-main",
            decisionText("Other final", reds(2963, red("Heavy / Lint", "mixed", 3001)))
          ),
          sourced("2026-11-14-c.md", "origin-main", decisionText("Other ruling", ruling(2963))),
        ],
        FINAL
      );
      expect(claims.committed).toEqual(
        GoalClaimSet.make({
          redAttributions: [claim("Heavy / Check", "inherited", 2994, "2026-11-14-a.md", "origin-main")],
        })
      );
      expect(claims.preview).toEqual(claims.committed);
      const other = yield* goalCompletionClaims(
        [
          sourced(
            "2026-11-14-b.md",
            "head",
            decisionText("Other final", reds(2963, red("Heavy / Lint", "mixed", 3001)))
          ),
        ],
        2963
      );
      expect(other.committed.redAttributions).toEqual([
        claim("Heavy / Lint", "mixed", 3001, "2026-11-14-b.md", "head"),
      ]);
      const none = yield* goalCompletionClaims([], FINAL);
      expect(none).toEqual(GoalCompletionClaims.make({}));
    })
  );

  it.effect("fails closed on a context two files attribute differently", () =>
    Effect.gen(function* () {
      const claims = yield* goalCompletionClaims(
        [
          sourced("2026-11-14-a.md", "origin-main", CHECK_INHERITED),
          sourced(
            "2026-11-14-b.md",
            "head",
            decisionText(
              "Check again",
              reds(FINAL, red("Heavy / Check", "mixed", 2994), red("Heavy / Docgen", "introduced", 2995))
            )
          ),
        ],
        FINAL
      );
      expect(claims.committed.redAttributions).toEqual([
        claim("Heavy / Docgen", "introduced", 2995, "2026-11-14-b.md", "head"),
      ]);
      expect(claims.committed.conflicts).toEqual([
        GoalAttributionConflict.make({
          context: "Heavy / Check",
          decisionFiles: [`${DIRECTORY}/2026-11-14-a.md`, `${DIRECTORY}/2026-11-14-b.md`],
        }),
      ]);
      // One file whose working-tree copy changes the value conflicts in the preview only.
      const edited = yield* goalCompletionClaims(
        [
          sourced("2026-11-14-a.md", "origin-main", CHECK_INHERITED),
          sourced(
            "2026-11-14-a.md",
            "working-tree",
            decisionText("Check", reds(FINAL, red("Heavy / Check", "inherited", 2999)))
          ),
        ],
        FINAL
      );
      expect(edited.committed.redAttributions).toEqual([
        claim("Heavy / Check", "inherited", 2994, "2026-11-14-a.md", "origin-main"),
      ]);
      expect(edited.committed.conflicts).toEqual([]);
      expect(edited.preview.redAttributions).toEqual([]);
      expect(edited.preview.conflicts).toEqual([
        GoalAttributionConflict.make({ context: "Heavy / Check", decisionFiles: [`${DIRECTORY}/2026-11-14-a.md`] }),
      ]);
      // Several conflicts list in context order.
      const twice = yield* goalCompletionClaims(
        [
          sourced(
            "2026-11-14-a.md",
            "origin-main",
            decisionText(
              "Both",
              reds(FINAL, red("Heavy / Lint", "inherited", 2994), red("Heavy / Check", "inherited", 2994))
            )
          ),
          sourced(
            "2026-11-14-b.md",
            "origin-main",
            decisionText(
              "Both again",
              reds(FINAL, red("Heavy / Lint", "mixed", 2995), red("Heavy / Check", "mixed", 2995))
            )
          ),
        ],
        FINAL
      );
      expect(A.map(twice.committed.conflicts, (conflict) => conflict.context)).toEqual([
        "Heavy / Check",
        "Heavy / Lint",
      ]);
    })
  );

  it.effect("never attributes through an invalid file", () =>
    Effect.gen(function* () {
      const claims = yield* goalCompletionClaims(
        [
          sourced("notes.md", "origin-main", CHECK_INHERITED),
          sourced("2026-11-13-a.md", "origin-main", CHECK_INHERITED),
          sourced("2026-11-14-b.md", "origin-main", decisionText("Checkpoint", ruling(FINAL), ["kind: checkpoint"])),
          sourced("2026-11-14-c.md", "origin-main", "no frontmatter\n"),
          sourced(
            "2026-11-14-d.md",
            "origin-main",
            decisionText("Fix is final", reds(FINAL, red("Heavy / Check", "inherited", FINAL)))
          ),
        ],
        FINAL
      );
      expect(claims).toEqual(GoalCompletionClaims.make({}));
    })
  );

  it.effect("collects operator rulings for the final, one per file under its strongest source", () =>
    Effect.gen(function* () {
      const text = decisionText("Ruling", ruling(FINAL));
      const claims = yield* goalCompletionClaims(
        [
          sourced("2026-11-14-b.md", "working-tree", text),
          sourced("2026-11-14-b.md", "head", text),
          sourced(
            "2026-11-14-a.md",
            "head",
            decisionText("Ruling and red", [...ruling(FINAL), ...reds(FINAL, red("Heavy / Check", "inherited", 2994))])
          ),
          sourced("2026-11-14-c.md", "origin-main", decisionText("Other ruling", ruling(2963))),
          sourced("2026-11-14-d.md", "working-tree", decisionText("Preview ruling", ruling(FINAL))),
        ],
        FINAL
      );
      expect(claims.committed.operatorRulings).toEqual([
        rulingClaim("2026-11-14-a.md", "head"),
        rulingClaim("2026-11-14-b.md", "head"),
      ]);
      expect(claims.preview.operatorRulings).toEqual([
        rulingClaim("2026-11-14-a.md", "head"),
        rulingClaim("2026-11-14-b.md", "head"),
        rulingClaim("2026-11-14-d.md", "working-tree"),
      ]);
      expect(claims.committed.redAttributions).toEqual([
        claim("Heavy / Check", "inherited", 2994, "2026-11-14-a.md", "head"),
      ]);
      // One ruling file whose text differs between sources parses twice and keeps its strongest source.
      const edited = yield* goalCompletionClaims(
        [
          sourced("2026-11-14-e.md", "head", decisionText("Ruling, edited", ruling(FINAL))),
          sourced("2026-11-14-e.md", "origin-main", text),
        ],
        FINAL
      );
      expect(edited.committed.operatorRulings).toEqual([rulingClaim("2026-11-14-e.md", "origin-main")]);
    })
  );

  it.effect("collapses identical claims to the strongest source", () =>
    Effect.gen(function* () {
      const claims = yield* goalCompletionClaims(
        [
          sourced("2026-11-14-a.md", "working-tree", CHECK_INHERITED),
          sourced("2026-11-14-a.md", "head", CHECK_INHERITED),
          sourced("2026-11-14-a.md", "origin-main", CHECK_INHERITED),
          // A second file that agrees adds nothing: the strongest source wins, then the file name.
          sourced(
            "2026-11-14-0.md",
            "head",
            decisionText("Same", reds(FINAL, red("Heavy / Check", "inherited", 2994)))
          ),
        ],
        FINAL
      );
      expect(claims.committed.redAttributions).toEqual([
        claim("Heavy / Check", "inherited", 2994, "2026-11-14-a.md", "origin-main"),
      ]);
      expect(claims.preview).toEqual(claims.committed);
      const headOnly = yield* goalCompletionClaims(
        [sourced("2026-11-14-b.md", "head", CHECK_INHERITED), sourced("2026-11-14-a.md", "head", CHECK_INHERITED)],
        FINAL
      );
      expect(headOnly.committed.redAttributions).toEqual([
        claim("Heavy / Check", "inherited", 2994, "2026-11-14-a.md", "head"),
      ]);
    })
  );

  it.effect("keeps working-tree files out of the committed set and in the preview", () =>
    Effect.gen(function* () {
      const claims = yield* goalCompletionClaims(
        [
          sourced("2026-11-14-a.md", "origin-main", CHECK_INHERITED),
          sourced(
            "2026-11-14-b.md",
            "working-tree",
            decisionText("Docgen", [...reds(FINAL, red("Heavy / Docgen", "mixed", 2995)), ...ruling(FINAL)])
          ),
        ],
        FINAL
      );
      expect(committedGoalCompletionClaims(claims)).toEqual(claims.committed);
      expect(claims.committed).toEqual(
        GoalClaimSet.make({
          redAttributions: [claim("Heavy / Check", "inherited", 2994, "2026-11-14-a.md", "origin-main")],
        })
      );
      expect(claims.preview).toEqual(
        GoalClaimSet.make({
          redAttributions: [
            claim("Heavy / Check", "inherited", 2994, "2026-11-14-a.md", "origin-main"),
            claim("Heavy / Docgen", "mixed", 2995, "2026-11-14-b.md", "working-tree"),
          ],
          operatorRulings: [rulingClaim("2026-11-14-b.md", "working-tree")],
        })
      );
    })
  );
});

const GIT_ENV = { GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
const GIT_IDENTITY = [
  "-c",
  "user.name=Claims Fixture",
  "-c",
  "user.email=claims@example.invalid",
  "-c",
  "commit.gpgsign=false",
];

it.layer(NodeCommandTestLayer, { timeout: "60 seconds" })("goal completion claims reader (live)", (it) => {
  const fixture = Effect.fn("RedAttributionTest.fixture")(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "goal-claims-" });
    const git = Effect.fn("RedAttributionTest.git")(function* (...args: ReadonlyArray<string>) {
      const result = yield* runRepoCommandCapture("git", [...GIT_IDENTITY, ...args], root, GIT_ENV);
      expect(result.exitCode).toBe(0);
      return Str.trim(result.output);
    });
    const write = Effect.fn("RedAttributionTest.write")(function* (relative: string, text: string) {
      const target = path.join(root, relative);
      yield* fs.makeDirectory(path.dirname(target), { recursive: true });
      yield* fs.writeFileString(target, text);
    });
    const commit = Effect.fn("RedAttributionTest.commit")(function* (message: string) {
      yield* git("add", "--all");
      yield* git("commit", "--quiet", "--no-verify", "-m", message);
    });
    const services = yield* Layer.build(GoalCompletionClaimsReader.layer);
    const reader = Context.get(services, GoalCompletionClaimsReader);
    const read = (slug = "demo", scope: GoalClaimScope = "checkout") => reader.read(root, slug, FINAL, scope);
    yield* git("init", "--quiet", "--template=", "--initial-branch=main", ".");
    return { root, git, write, commit, read };
  });

  it.effect("layerTest returns its claims, and readGoalCompletionClaims prefers a provided reader", () =>
    Effect.gen(function* () {
      const fixed = GoalCompletionClaims.make({
        committed: GoalClaimSet.make({
          redAttributions: [claim("Heavy / Check", "inherited", 2994, "2026-11-14-a.md", "origin-main")],
        }),
      });
      const services = yield* Layer.build(GoalCompletionClaimsReader.layerTest(fixed));
      const reader = Context.get(services, GoalCompletionClaimsReader);
      const viaService = yield* reader.read("/nowhere", "demo", FINAL);
      expect(viaService).toEqual(fixed);
      const viaRead = yield* readGoalCompletionClaims("/nowhere", "other", 1).pipe(
        Effect.provideService(GoalCompletionClaimsReader, reader)
      );
      expect(viaRead).toEqual(fixed);
    })
  );

  it.effect("reads origin/main, HEAD and the working tree, and only committed files count", () =>
    Effect.gen(function* () {
      const { git, write, commit, read } = yield* fixture();
      yield* write("README.md", "# fixture\n");
      yield* commit("base");
      // No decisions/ directory anywhere: nothing to read, nothing fails.
      const empty = yield* read();
      expect(empty).toEqual(GoalCompletionClaims.make({}));

      yield* write(`${DIRECTORY}/2026-11-14-a.md`, CHECK_INHERITED);
      // Invalid files: a name outside the grammar, a claim on a checkpoint, and a nested file.
      yield* write(`${DIRECTORY}/notes.md`, CHECK_INHERITED);
      yield* write(`${DIRECTORY}/2026-11-14-bad.md`, decisionText("Checkpoint", ruling(FINAL), ["kind: checkpoint"]));
      yield* write(`${DIRECTORY}/archive/2026-11-14-nested.md`, decisionText("Nested", ruling(FINAL)));
      yield* commit("attribute");

      // Without an origin/main ref the HEAD commit still counts; the missing ref contributes nothing.
      const headOnly = yield* read();
      expect(headOnly.committed).toEqual(
        GoalClaimSet.make({ redAttributions: [claim("Heavy / Check", "inherited", 2994, "2026-11-14-a.md", "head")] })
      );
      expect(headOnly.preview).toEqual(headOnly.committed);

      // Copied to origin/main, the same file collapses to the stronger origin-main source.
      yield* git("update-ref", "refs/remotes/origin/main", "HEAD");
      const onMain = yield* read();
      expect(onMain.committed).toEqual(
        GoalClaimSet.make({
          redAttributions: [claim("Heavy / Check", "inherited", 2994, "2026-11-14-a.md", "origin-main")],
        })
      );

      // A file committed at HEAD only.
      yield* write(
        `${DIRECTORY}/2026-11-14-b.md`,
        decisionText("Docgen", [...reds(FINAL, red("Heavy / Docgen", "mixed", 2995)), ...ruling(FINAL)])
      );
      yield* commit("head only");
      // An untracked working-tree file.
      yield* write(
        `${DIRECTORY}/2026-11-14-c.md`,
        decisionText("Lint", reds(FINAL, red("Heavy / Lint", "introduced", 2996)))
      );

      const claims = yield* read();
      expect(claims.committed).toEqual(
        GoalClaimSet.make({
          redAttributions: [
            claim("Heavy / Check", "inherited", 2994, "2026-11-14-a.md", "origin-main"),
            claim("Heavy / Docgen", "mixed", 2995, "2026-11-14-b.md", "head"),
          ],
          operatorRulings: [rulingClaim("2026-11-14-b.md", "head")],
        })
      );
      expect(claims.preview).toEqual(
        GoalClaimSet.make({
          redAttributions: [
            claim("Heavy / Check", "inherited", 2994, "2026-11-14-a.md", "origin-main"),
            claim("Heavy / Docgen", "mixed", 2995, "2026-11-14-b.md", "head"),
            claim("Heavy / Lint", "introduced", 2996, "2026-11-14-c.md", "working-tree"),
          ],
          operatorRulings: [rulingClaim("2026-11-14-b.md", "head")],
        })
      );
      // The origin-main scope reads neither HEAD nor the working tree.
      const mainOnly = yield* read("demo", "origin-main");
      expect(mainOnly).toEqual(
        GoalCompletionClaims.make({
          committed: GoalClaimSet.make({
            redAttributions: [claim("Heavy / Check", "inherited", 2994, "2026-11-14-a.md", "origin-main")],
          }),
          preview: GoalClaimSet.make({
            redAttributions: [claim("Heavy / Check", "inherited", 2994, "2026-11-14-a.md", "origin-main")],
          }),
        })
      );
      // Another packet has no decisions/ directory.
      const otherPacket = yield* read("other");
      expect(otherPacket).toEqual(GoalCompletionClaims.make({}));
    })
  );

  it.effect("outside a git repository only the working tree previews, and the live read is the default", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "goal-claims-plain-" });
      const target = path.join(root, DIRECTORY, "2026-11-14-a.md");
      yield* fs.makeDirectory(path.dirname(target), { recursive: true });
      yield* fs.writeFileString(target, CHECK_INHERITED);
      const claims = yield* readGoalCompletionClaims(root, "demo", FINAL);
      expect(claims.committed).toEqual(GoalClaimSet.make({}));
      expect(claims.preview.redAttributions).toEqual([
        claim("Heavy / Check", "inherited", 2994, "2026-11-14-a.md", "working-tree"),
      ]);
    })
  );
});
