import { RunsHosted } from "@proto/runs-model/Runs.ports";
import * as Layer from "effect/Layer";
import { RunsAuthority } from "./Authority.adapter.ts";

/**
 * The runs model with its handlers and its authority adapter, on the
 * platform you give it. It still needs the authority context's gateway,
 * which the app composes from the authority host.
 *
 * **Gotchas**
 *
 * Its output includes the library's single `Model.Internals`; give it to the
 * runs gateway privately rather than merging it beside another hosted model.
 *
 * **Example** (The runs model in memory)
 * ```ts
 * import * as Domain from "@alchemy.run/domain";
 * import { hostRuns } from "@proto/runs-host/Host";
 *
 * const runs = hostRuns(Domain.InMemory);
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const hostRuns = <ROut, E, RIn>(platform: Layer.Layer<ROut, E, RIn>) =>
  RunsHosted.pipe(Layer.provideMerge(RunsAuthority), Layer.provide(platform));
