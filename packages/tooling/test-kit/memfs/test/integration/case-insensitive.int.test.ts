import { NodeServices } from "@effect/platform-node";
import { describe, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { caseInsensitiveCases } from "../CaseInsensitiveContract.ts";

layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
  const hostFoldsCase = Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const probe = yield* fs.makeTempDirectoryScoped({ prefix: "memfs-case-" });
      yield* fs.writeFileString(`${probe}/probe`, "");
      const exit1 = yield* Effect.exit(fs.realPath(`${probe}/PROBE`));
      return Exit.isSuccess(exit1);
    })
  );

  describe("case-insensitive volume (node), the host oracle: meaningful on APFS or NTFS, skipped when case-sensitive", () =>
    caseInsensitiveCases(it, hostFoldsCase));
});
