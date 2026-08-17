/**
 * Derived goals-index guard for Yeet publish.
 *
 * `goals/INDEX.md` is a whole-file deterministic projection of
 * `goals/<slug>/ops/manifest.json`, so a textual merge of two branches can only
 * ever produce a plausible-but-false index. Publish therefore renders the
 * projection itself immediately before the commit and refuses any hand-staged
 * copy that disagrees with it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Console, Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { GOALS_DIR } from "../../Goals/Inventory.ts";
import { buildPortfolioIndexContent, PORTFOLIO_INDEX_PATH } from "../../Goals/PortfolioIndex.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runGitOutput } from "./GitExec.ts";
import { failPublishScopeWithPacket } from "./PublishScope.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { YeetStagedPublishIntent } from "../Yeet.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/PortfolioIndexGuard");

/**
 * Command an operator runs to regenerate the goals index by hand.
 *
 * **Example** (Read the regeneration command)
 *
 * ```ts
 * import { PORTFOLIO_INDEX_WRITE_COMMAND } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PORTFOLIO_INDEX_WRITE_COMMAND) // "bun run beep goals index --write"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PORTFOLIO_INDEX_WRITE_COMMAND = "bun run beep goals index --write";

/**
 * What publish decided to do about the derived goals index.
 *
 * **Details**
 *
 * `absent` means the checkout carries no `goals/` portfolio at all, so the guard
 * does not apply. `current` means the committed projection already matches the
 * manifests. `regenerated` means publish rendered a fresh projection and staged
 * it into the commit. `drifted` means the publish intent hand-stages an index
 * that disagrees with the manifests, which publish refuses rather than
 * overwrite.
 *
 * **Example** (Check a disposition)
 *
 * ```ts
 * import { PortfolioIndexPublishDisposition } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PortfolioIndexPublishDisposition.is.drifted("drifted")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PortfolioIndexPublishDisposition = LiteralKit(["absent", "current", "regenerated", "drifted"]).pipe(
  $I.annoteSchema("PortfolioIndexPublishDisposition", {
    description: "Outcome of the derived goals-index guard for one yeet publish commit.",
  })
);

/**
 * Type-level union of derived goals-index publish dispositions.
 *
 * **Example** (Annotate a value as PortfolioIndexPublishDisposition)
 *
 * ```ts
 * import type { PortfolioIndexPublishDisposition } from "@beep/repo-cli/test/Yeet"
 *
 * const disposition: PortfolioIndexPublishDisposition = "regenerated"
 * console.log(disposition) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PortfolioIndexPublishDisposition = typeof PortfolioIndexPublishDisposition.Type;

/**
 * Decide what publish must do about `goals/INDEX.md` for one commit.
 *
 * **Details**
 *
 * The decision is pure so the whole behavior matrix is testable without a Git
 * fixture: a committed copy that already equals the projection is accepted
 * whether or not it was staged, a staged copy that disagrees is refused, and an
 * unstaged disagreement is regenerated into the commit.
 *
 * **Example** (Refuse a hand-staged index that disagrees)
 *
 * ```ts
 * import { portfolioIndexPublishDisposition } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const disposition = portfolioIndexPublishDisposition({
 *   committed: O.some("# Goals Index\n\nhand edited\n"),
 *   present: true,
 *   regenerated: "# Goals Index\n\ngenerated\n",
 *   staged: true
 * })
 *
 * console.log(disposition) // "drifted"
 * ```
 *
 * @param input - Whether a goals portfolio exists, whether the index sits in the
 * publish intent, the committed index content, and the freshly rendered
 * projection.
 * @returns The disposition publish must act on.
 * @category validation
 * @since 0.0.0
 */
export const portfolioIndexPublishDisposition = (input: {
  readonly committed: O.Option<string>;
  readonly present: boolean;
  readonly regenerated: string;
  readonly staged: boolean;
}): PortfolioIndexPublishDisposition =>
  !input.present
    ? "absent"
    : O.contains(input.committed, input.regenerated)
      ? "current"
      : input.staged
        ? "drifted"
        : "regenerated";

/**
 * Regenerate the derived goals index into the commit publish is about to make.
 *
 * **Details**
 *
 * Call this only once the worktree already equals the Git index — after
 * {@link stageReviewedPublishIntent} and after the `--staged-only` stash has
 * parked residue. At that instant the files on disk are exactly the tree the
 * commit will contain, so the rendered projection describes the committed
 * manifests rather than uncommitted edits. Running it earlier would embed
 * unstaged packet state into the published index.
 *
 * **Gotchas**
 *
 * This guard only covers commits publish itself creates. An `existing-commit`
 * intent (`--push-only`, `--reuse-verified`, or a clean local commit already
 * ahead of the publish target) is left alone, because repairing its index would
 * mean rewriting a commit that may already be pushed.
 *
 * **Example** (Guard a reviewed publish intent)
 *
 * ```ts
 * import { enforcePortfolioIndexPublishIntent, RepoRunContext, YeetStagedPublishIntent } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * const intent = YeetStagedPublishIntent.make({ paths: ["goals/ship-velocity/ops/manifest.json"] })
 *
 * console.log(Effect.isEffect(enforcePortfolioIndexPublishIntent(context, intent))) // true
 * ```
 *
 * @param context - Repo context whose worktree and Git index are updated.
 * @param intent - Reviewed staged paths publish is about to commit.
 * @returns The disposition, after staging a regenerated index or refusing a
 * hand-staged one.
 * @effects Writes and stages {@link PORTFOLIO_INDEX_PATH} when the committed
 * projection is stale.
 * @category execution
 * @since 0.0.0
 */
export const enforcePortfolioIndexPublishIntent = Effect.fn("Yeet.enforcePortfolioIndexPublishIntent")(function* (
  context: RepoRunContext,
  intent: YeetStagedPublishIntent
): Effect.fn.Return<
  PortfolioIndexPublishDisposition,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const present = yield* fs.exists(path.join(context.repoRoot, GOALS_DIR)).pipe(Effect.orElseSucceed(() => false));
  if (!present) {
    return "absent";
  }

  const indexPath = path.join(context.repoRoot, PORTFOLIO_INDEX_PATH);
  const regenerated = yield* buildPortfolioIndexContent(context.repoRoot).pipe(
    Effect.mapError(
      YeetCommandError.new(`Failed to render ${PORTFOLIO_INDEX_PATH} from ${GOALS_DIR}/*/ops/manifest.json.`)
    )
  );
  const committed = yield* fs.readFileString(indexPath).pipe(Effect.map(O.some), Effect.orElseSucceed(O.none<string>));
  const disposition = portfolioIndexPublishDisposition({
    committed,
    present,
    regenerated,
    staged: A.contains(intent.paths, PORTFOLIO_INDEX_PATH),
  });

  if (PortfolioIndexPublishDisposition.is.current(disposition)) {
    return disposition;
  }

  if (PortfolioIndexPublishDisposition.is.drifted(disposition)) {
    return yield* failPublishScopeWithPacket(context, {
      message: `yeet publish refuses a hand-staged ${PORTFOLIO_INDEX_PATH}. It is a generated whole-file projection of ${GOALS_DIR}/*/ops/manifest.json, and the staged copy disagrees with the current manifests, so committing it would publish a false index.`,
      paths: [PORTFOLIO_INDEX_PATH],
      remediation: `Run \`${PORTFOLIO_INDEX_WRITE_COMMAND}\` and stage the regenerated file, or unstage ${PORTFOLIO_INDEX_PATH} and let yeet publish regenerate it into the commit.`,
      subCategory: "derived-index-hand-staged",
    });
  }

  yield* fs
    .writeFileString(indexPath, regenerated)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to write the regenerated ${PORTFOLIO_INDEX_PATH}.`)));
  yield* runGitOutput(context.repoRoot, ["add", "--", PORTFOLIO_INDEX_PATH]);
  yield* Console.log(
    `[yeet] regenerated ${PORTFOLIO_INDEX_PATH} from ${GOALS_DIR}/*/ops/manifest.json and staged it into the commit`
  );
  return disposition;
});
