// The oracle for the case-insensitive contract: the same suite the memory
// engine runs, against the real filesystem through @effect/platform-node
// (NodeServices serves the node adapter's `FileSystem.FileSystem`). It only
// says something where os.tmpdir() sits on a case-folding volume (default
// APFS, NTFS); on a case-sensitive host every case is reported skipped, which
// is the honest outcome there.

import { NodeServices } from "@effect/platform-node";
import { describe, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { caseInsensitiveCases } from "../CaseInsensitiveContract.ts";

layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
  // The host folds case when a file stored as `probe` resolves under the
  // spelling `PROBE`.
  const hostFoldsCase = Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const probe = yield* fs.makeTempDirectoryScoped({ prefix: "memfs-case-" });
      yield* fs.writeFileString(`${probe}/probe`, "");
      const exit1 = yield* Effect.exit(fs.realPath(`${probe}/PROBE`));
      return Exit.isSuccess(exit1);
    })
  );

  describe("case-insensitive volume (node)", () => caseInsensitiveCases(it, hostFoldsCase));
});
