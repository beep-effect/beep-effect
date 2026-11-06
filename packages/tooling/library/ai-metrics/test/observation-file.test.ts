import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { isPrivateObservationFile, readBoundedMetadata } from "@beep/repo-ai-metrics/observation-file";
import { ObservationLaunchError } from "@beep/repo-ai-metrics/observation-launch";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";

// The memory filesystem models the owner, mode and link metadata these checks read.
const TestFileSystem = Layer.merge(MemoryFileSystem.layer, Path.layer);

const errors = {
  readFailed: ObservationLaunchError.make({ reason: "directory" }),
  oversize: ObservationLaunchError.make({ reason: "configuration" }),
  encodingFailed: ObservationLaunchError.make({ reason: "namespace" }),
};
it.layer(TestFileSystem, { timeout: "20 seconds" })((it) => {
  it.effect("enforces the byte ceiling before decoding and preserves each caller-owned refusal", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped();
      const file = `${directory}/synthetic-private-input`;
      yield* fs.writeFileString(file, "€", { mode: 0o600 });
      const readBoundedMetadata1 = yield* readBoundedMetadata(file, 3, errors);
      expect(readBoundedMetadata1).toBe("€");
      const value = yield* readBoundedMetadata(3, errors)(file);
      expect(value).toBe("€");
      const pipe2 = yield* readBoundedMetadata(file, 2, errors).pipe(Effect.flip);
      expect(pipe2).toEqual(errors.oversize);
      yield* fs.writeFile(file, new Uint8Array([0xc3, 0x28]));
      const pipe3 = yield* readBoundedMetadata(file, 2, errors).pipe(Effect.flip);
      expect(pipe3).toEqual(errors.encodingFailed);
      const pipe4 = yield* readBoundedMetadata(`${directory}/absent`, 3, errors).pipe(Effect.flip);
      expect(pipe4).toEqual(errors.readFailed);
      yield* fs.writeFile(file, new Uint8Array(0));
      const readBoundedMetadata5 = yield* readBoundedMetadata(file, 0, errors);
      expect(readBoundedMetadata5).toBe("");
      yield* fs.writeFileString(file, "x");
      const pipe6 = yield* readBoundedMetadata(file, 0, errors).pipe(Effect.flip);
      expect(pipe6).toEqual(errors.oversize);
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
