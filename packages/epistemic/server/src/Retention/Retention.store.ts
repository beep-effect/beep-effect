/**
 * Disposable retention report store.
 * @packageDocumentation
 * @since 0.0.0
 */
import {
  encodeRetentionReport,
  generateRetentionReport,
  RetentionUnavailable,
  renderRetentionReport,
} from "@beep/epistemic-use-cases/Retention";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import type { RetentionPolicy, RetentionQuery } from "@beep/epistemic-domain/values/Retention";
import type * as O from "effect/Option";

/**
 * Rebuild both disposable artifacts beneath a dedicated caller-owned projection directory.
 *
 * **Details**
 * The directory must belong exclusively to this projection. JSON is authoritative for this disposable
 * store; text is a presentation of the same returned report. Neither file is ever a rebuild input.
 * Delete the entire directory and call again to recover from authority and configuration alone.
 *
 * **Example** (Inspect the rebuild operation)
 * ```ts
 * import { rebuildRetentionStore } from "@beep/epistemic-server/Retention"
 * console.log(rebuildRetentionStore)
 * ```
 * @category projections
 * @since 0.0.0
 */
export const rebuildRetentionStore = Effect.fn("Retention.rebuildStore")(function* (
  root: string,
  query: RetentionQuery,
  policy: O.Option<RetentionPolicy>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const report = yield* generateRetentionReport(query, policy);
  const json = yield* encodeRetentionReport(report);
  const text = renderRetentionReport(report);
  yield* Effect.gen(function* () {
    yield* fs.makeDirectory(root, { recursive: true });
    const staging = yield* fs.makeTempDirectoryScoped({ directory: root, prefix: ".rebuild-" });
    yield* fs.writeFileString(path.join(staging, "report.json"), json);
    yield* fs.writeFileString(path.join(staging, "report.txt"), text);
    yield* fs.rename(path.join(staging, "report.txt"), path.join(root, "report.txt"));
    yield* fs.rename(path.join(staging, "report.json"), path.join(root, "report.json"));
  }).pipe(
    Effect.scoped,
    Effect.mapError(() =>
      RetentionUnavailable.make({ operation: "store", message: "Disposable report store unavailable" })
    )
  );
  return report;
});
