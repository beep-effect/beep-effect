import { isPrivateObservationFile, readBoundedMetadata } from "@beep/repo-ai-metrics/observation-file";
import { ObservationLaunchError } from "@beep/repo-ai-metrics/observation-launch";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";

const errors = {
  readFailed: ObservationLaunchError.make({ reason: "directory" }),
  oversize: ObservationLaunchError.make({ reason: "configuration" }),
  encodingFailed: ObservationLaunchError.make({ reason: "namespace" }),
};
it.layer(NodeServices.layer, { timeout: "20 seconds" })((it) => {
  it.effect("enforces the byte ceiling before decoding and preserves each caller-owned refusal", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped();
      const file = `${directory}/synthetic-private-input`;
      yield* fs.writeFileString(file, "€", { mode: 0o600 });
      expect(yield* readBoundedMetadata(file, 3, errors)).toBe("€");
      expect(yield* readBoundedMetadata(3, errors)(file)).toBe("€");
      expect(yield* readBoundedMetadata(file, 2, errors).pipe(Effect.flip)).toEqual(errors.oversize);
      yield* fs.writeFile(file, new Uint8Array([0xc3, 0x28]));
      expect(yield* readBoundedMetadata(file, 2, errors).pipe(Effect.flip)).toEqual(errors.encodingFailed);
      expect(yield* readBoundedMetadata(`${directory}/absent`, 3, errors).pipe(Effect.flip)).toEqual(errors.readFailed);
      yield* fs.writeFile(file, new Uint8Array(0));
      expect(yield* readBoundedMetadata(file, 0, errors)).toBe("");
      yield* fs.writeFileString(file, "x");
      expect(yield* readBoundedMetadata(file, 0, errors).pipe(Effect.flip)).toEqual(errors.oversize);
    })
  );
  it.effect("refuses missing owner/link metadata, exposed modes, hardlinks and non-files", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped();
      const file = `${directory}/owned`;
      yield* fs.writeFileString(file, "synthetic", { mode: 0o600 });
      const info = yield* fs.lstat(file);
      const uid = O.getOrThrow(info.uid);
      expect(isPrivateObservationFile(info, uid)).toBe(true);
      expect(isPrivateObservationFile(uid)(info)).toBe(true);
      expect(isPrivateObservationFile(info, uid + 1)).toBe(false);
      expect(isPrivateObservationFile({ ...info, uid: O.none() }, -1)).toBe(false);
      expect(isPrivateObservationFile({ ...info, nlink: O.none() }, uid)).toBe(false);
      expect(isPrivateObservationFile({ ...info, nlink: O.some(BigInt(2)) }, uid)).toBe(false);
      expect(isPrivateObservationFile({ ...info, mode: 0o644 }, uid)).toBe(false);
      expect(isPrivateObservationFile({ ...info, type: "SymbolicLink" }, uid)).toBe(false);
      expect(isPrivateObservationFile({ ...info, type: "Directory" }, uid)).toBe(false);
    })
  );
});
