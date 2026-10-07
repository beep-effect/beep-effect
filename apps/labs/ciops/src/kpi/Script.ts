/**
 * Shared runner and artifact sync for the KPI scripts (the reading and its adoption table).
 *
 * **Details**
 *
 * Both scripts are check-by-default: {@link syncKpiArtifacts} compares each
 * committed artifact with its recomputed bytes and fails naming the stale
 * paths, and only `write` mode rewrites them. {@link runKpiScript} provides the
 * live KPI layer over the Bun platform services.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CiopsId } from "@beep/identity/packages";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, FileSystem, Layer } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { EvidenceMode } from "../projection/Evidence.ts";
import { CiOpsKpiLive } from "./CiOpsKpi.ts";
import type { EvidenceWriteScript } from "../projection/Evidence.ts";
import type { RepoRelativePath } from "../projection/Schemas.ts";
import type { CiOpsKpi } from "./CiOpsKpi.ts";

const $I = $CiopsId.create("kpi/Script");

/**
 * A KPI artifact could not be read or written, or differs from its recomputed bytes.
 *
 * **Example** (Construct a stale-artifact failure)
 *
 * ```ts
 * import { KpiArtifactError } from "@/kpi/Script"
 *
 * const error = KpiArtifactError.make({ message: "kpi-reading.json differs" })
 * console.log(error._tag) // "KpiArtifactError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class KpiArtifactError extends S.TaggedError<KpiArtifactError>($I`KpiArtifactError`)(
  "KpiArtifactError",
  { message: S.String },
  $I.annoteError<KpiArtifactError>("KpiArtifactError", {
    description: "A committed KPI artifact is unreadable, unwritable, or stale against its recomputed bytes.",
  })
) {}

const ioFailure = (operation: string, path: string) =>
  KpiArtifactError.make({ message: `Failed to ${operation} KPI artifact "${path}".` });

/**
 * Checks (default) or rewrites committed KPI artifacts against their recomputed bytes.
 *
 * **Details**
 *
 * Each output is a repo-relative path and its rendered bytes. `check` reads
 * every committed file and fails once, naming every stale path and the write
 * script that regenerates them; `write` rewrites every file.
 *
 * **Example** (Check nothing)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { syncKpiArtifacts } from "@/kpi/Script"
 *
 * const program = syncKpiArtifacts("check", ".", "evidence:kpi:write", [])
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category scripts
 * @since 0.0.0
 */
export const syncKpiArtifacts = Effect.fn("KpiScript.syncKpiArtifacts")(function* (
  mode: EvidenceMode,
  repoRoot: string,
  writeScript: EvidenceWriteScript,
  outputs: ReadonlyArray<readonly [RepoRelativePath, string]>
): Effect.fn.Return<void, KpiArtifactError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  if (EvidenceMode.is.write(mode)) {
    yield* Effect.forEach(outputs, ([path, rendered]) =>
      fs.writeFileString(`${repoRoot}/${path}`, rendered).pipe(Effect.mapError(() => ioFailure("write", path)))
    );
    return;
  }
  const stale = yield* Effect.filter(outputs, ([path, rendered]) =>
    fs.readFileString(`${repoRoot}/${path}`).pipe(
      Effect.mapError(() => ioFailure("read", path)),
      Effect.map((committed) => committed !== rendered)
    )
  );
  if (A.isReadonlyArrayNonEmpty(stale)) {
    return yield* KpiArtifactError.make({
      message: `${A.join(
        A.map(stale, ([path]) => path),
        ", "
      )} differ from the recomputed bytes; run \`bun run ${writeScript}\`.`,
    });
  }
});

const platform = Layer.provideMerge(CiOpsKpiLive, BunServices.layer);

/**
 * Runs a KPI script with the live KPI layer over the Bun platform services.
 *
 * **Details**
 *
 * strictEffectProvide bans Layer-provide outside composed entry layers, so the
 * platform layer is built in a scope and its context provided to the run.
 *
 * @category scripts
 * @since 0.0.0
 */
export const runKpiScript = <E>(program: Effect.Effect<void, E, CiOpsKpi | BunServices.BunServices>): void =>
  BunRuntime.runMain(
    Layer.build(platform).pipe(
      Effect.flatMap((context) => Effect.provide(program, context)),
      Effect.scoped
    )
  );
