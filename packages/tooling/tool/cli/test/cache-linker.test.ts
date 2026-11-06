import { CacheLinkedFile, CacheLinkerResolution, CacheRuntimeLinkerSnapshot } from "@beep/repo-cli/commands/Cache";
import {
  collectCacheRuntimeLinker,
  inspectCacheLinkedFile,
  inspectCacheLinkerResolution,
  parseCacheLinkerOutput,
} from "@beep/repo-cli/test/Cache";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";

const isCacheRuntimeLinkerSnapshot = S.is(CacheRuntimeLinkerSnapshot);

const isCacheLinkerResolution = S.is(CacheLinkerResolution);

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))("runtime startup library identity", (it) => {
  it.effect("normalizes address and ordering noise while preserving library aliases", () =>
    Effect.gen(function* () {
      const first = yield* parseCacheLinkerOutput(
        "\tlinux-vdso.so.1 (0x123)\n\tlibz.so => /usr/lib/libz.so (0x456)\n\t/lib64/ld.so (0x789)\n"
      );
      const second = yield* parseCacheLinkerOutput(
        "\t/lib64/ld.so (0xab)\n\tlinux-vdso.so.1 (0xcd)\n\tlibz.so => /usr/lib/libz.so (0xef)\n"
      );
      expect(first).toEqual(["/lib64/ld.so", "/usr/lib/libz.so"]);
      expect(second).toEqual(first);
      const parsedCacheLinkerOutput = yield* parseCacheLinkerOutput("\tstatically linked\n");
      expect(parsedCacheLinkerOutput).toEqual([]);
    })
  );

  it.effect("rejects missing, unresolved, malformed, duplicated and oversized listings", () =>
    Effect.gen(function* () {
      for (const output of [
        "",
        "not a dynamic executable",
        "libmissing.so => not found",
        "linux-vdso.so.1 (0x123)",
        "statically linked\nlibx.so => /usr/lib/libx.so (0x123)",
        "libx.so => relative/libx.so (0x123)",
        "libx.so => /usr/lib/libx.so (0x123)\nunrecognized diagnostic",
        "/usr/lib/libx.so (0x123)\n/usr/lib/libx.so (0x456)",
        A.join(
          A.makeBy(257, (i) => `/usr/lib/lib${i}.so (0x123)`),
          "\n"
        ),
      ]) {
        const pipe5 = yield* parseCacheLinkerOutput(output).pipe(Effect.isFailure);
        expect(pipe5).toBe(true);
      }
    })
  );

  it.effect("detects byte changes and symlink retargeting even when target bytes match", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-linker-test-" });
      const first = path.join(root, "lib-v1.so");
      const second = path.join(root, "lib-v2.so");
      const alias = path.join(root, "lib.so");
      yield* fs.writeFileString(first, "unchanged version, original bytes");
      yield* fs.writeFileString(second, "unchanged version, original bytes");
      yield* fs.symlink("lib-v1.so", alias);
      const before = yield* inspectCacheLinkedFile(alias);
      yield* fs.remove(alias);
      yield* fs.symlink("lib-v2.so", alias);
      const retargeted = yield* inspectCacheLinkedFile(alias);
      expect(before.sha256).toBe(retargeted.sha256);
      expect(before.path).toBe(retargeted.path);
      expect(before.target).not.toBe(retargeted.target);
      expect(S.toEquivalence(CacheLinkedFile)(before, retargeted)).toBe(false);
      yield* fs.writeFileString(second, "unchanged version, changed bytes");
      const changed = yield* inspectCacheLinkedFile(alias);
      expect(changed.target).toBe(retargeted.target);
      expect(changed.sha256).not.toBe(retargeted.sha256);
      const pipe1 = yield* inspectCacheLinkedFile(root).pipe(Effect.isFailure);
      expect(pipe1).toBe(true);
      yield* fs.remove(second);
      const pipe2 = yield* inspectCacheLinkedFile(alias).pipe(Effect.isFailure);
      expect(pipe2).toBe(true);
    })
  );

  it.effect("discovers native shell libraries and refuses failed discovery as static evidence", () =>
    Effect.gen(function* () {
      const resolution = yield* inspectCacheLinkerResolution("/", "/usr/bin/bash");
      expect(CacheLinkerResolution.guards.Dynamic(resolution)).toBe(true);
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-linker-invalid-" });
      const file = path.join(root, "not-an-executable");
      yield* fs.writeFileString(file, "not an ELF executable\n");
      const pipe3 = yield* inspectCacheLinkerResolution(root, file).pipe(Effect.isFailure);
      expect(pipe3).toBe(true);
      const pipe4 = yield* inspectCacheLinkerResolution(root, path.join(root, "missing")).pipe(Effect.isFailure);
      expect(pipe4).toBe(true);
    })
  );

  it.effect("retains every runtime role with the observed detector and loader identities", () =>
    Effect.gen(function* () {
      const snapshot = yield* collectCacheRuntimeLinker("/", {
        bun: "/usr/bin/bash",
        node: "/usr/bin/bash",
        turbo: "/usr/bin/bash",
        biome: "/usr/bin/bash",
        bash: "/usr/bin/bash",
        sh: "/usr/bin/bash",
      });
      expect(isCacheRuntimeLinkerSnapshot(snapshot)).toBe(true);
      expect(snapshot.detector.path).toBe("/usr/bin/ldd");
      expect(snapshot.loader.path).toBe("/lib64/ld-linux-x86-64.so.2");
      expect(snapshot.executables.bun).toMatchObject({ _tag: "Dynamic" });
      expect(snapshot.executables.sh).toEqual(snapshot.executables.bun);
    })
  );

  it("requires all runtime roles and nonempty dynamic file evidence", () => {
    expect(isCacheRuntimeLinkerSnapshot({ format: "glibc-ldd/v1", executables: {} })).toBe(false);
    expect(isCacheLinkerResolution({ _tag: "Dynamic", files: [] })).toBe(false);
  });
});
