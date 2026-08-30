/**
 * Schemas for the shared per-user runtime root chosen by `RuntimeRoot.ts`.
 *
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/repo-run/RuntimeRoot.schemas");

/**
 * How the per-user runtime root was chosen.
 *
 * **Example** (Recognise the temporary fallback)
 *
 * ```ts
 * import { RuntimeRootKind } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(RuntimeRootKind.is.tmpdir("tmpdir")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RuntimeRootKind = LiteralKit(["run-user", "tmpdir", "test-override"]).pipe(
  $I.annoteSchema("RuntimeRootKind", {
    description:
      "Origin of the chosen runtime root: a usable /run/user/<uid>, the system temporary directory, or an injected test override.",
  })
);

/**
 * The chosen per-user base root plus its origin.
 *
 * **Example** (Construct a run-user choice)
 *
 * ```ts
 * import { RuntimeRootChoice } from "@beep/repo-cli/test/RepoRun"
 *
 * const choice = RuntimeRootChoice.make({ kind: "run-user", root: "/run/user/1000" })
 * console.log(choice.root) // "/run/user/1000"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuntimeRootChoice extends S.Class<RuntimeRootChoice>($I`RuntimeRootChoice`)(
  {
    kind: RuntimeRootKind,
    root: S.String,
  },
  $I.annote("RuntimeRootChoice", {
    description: "Absolute base directory for machine-wide coordination state and how it was selected.",
  })
) {}
