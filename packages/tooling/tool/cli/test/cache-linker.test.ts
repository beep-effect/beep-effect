import { CacheLinkedFile, CacheLinkerResolution, CacheRuntimeLinkerSnapshot } from "@beep/repo-cli/commands/Cache";
import {
  inspectCacheLinkedFile,
  inspectCacheLinkerResolution,
  parseCacheLinkerOutput,
} from "@beep/repo-cli/test/Cache";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";

describe("runtime startup library identity", () => {
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
      expect(yield* parseCacheLinkerOutput("\tstatically linked\n")).toEqual([]);
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
      ])
        expect(yield* parseCacheLinkerOutput(output).pipe(Effect.isFailure)).toBe(true);
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
      expect(yield* inspectCacheLinkedFile(root).pipe(Effect.isFailure)).toBe(true);
      yield* fs.remove(second);
      expect(yield* inspectCacheLinkedFile(alias).pipe(Effect.isFailure)).toBe(true);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
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
      expect(yield* inspectCacheLinkerResolution(root, file).pipe(Effect.isFailure)).toBe(true);
      expect(yield* inspectCacheLinkerResolution(root, path.join(root, "missing")).pipe(Effect.isFailure)).toBe(true);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it("requires all runtime roles and nonempty dynamic file evidence", () => {
    expect(S.is(CacheRuntimeLinkerSnapshot)({ format: "glibc-ldd/v1", executables: {} })).toBe(false);
    expect(S.is(CacheLinkerResolution)({ _tag: "Dynamic", files: [] })).toBe(false);
  });
});
