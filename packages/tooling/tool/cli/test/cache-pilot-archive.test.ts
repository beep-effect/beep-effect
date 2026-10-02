import { Buffer } from "node:buffer";
import { zstdCompressSync } from "node:zlib";
import { inspectCacheSignedPilotArchive } from "@beep/repo-cli/test/Cache";
import { NodeCrypto } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect } from "effect";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import { Header } from "tar";

const path = "packages/foundation/modeling/identity/.turbo/turbo-lint.log";
const makeTar = (text = "safe task output\n", fields: ConstructorParameters<typeof Header>[0] = {}) => {
  const body = Buffer.from(text);
  const bytes = Buffer.alloc(512 + Math.ceil(body.length / 512) * 512 + 1024);
  const header = new Header({ path, type: "File", size: body.length, mode: 0o644, ...fields });
  header.encode(bytes);
  body.copy(bytes, 512);
  return bytes;
};
const inspect = (tar: Uint8Array) => inspectCacheSignedPilotArchive(zstdCompressSync(tar), []);

it.layer(NodeCrypto.layer, { timeout: "30 seconds" })("bounded signed pilot archive", (it) => {
  it.effect("inspects the sole task log without extraction", () =>
    Effect.gen(function* () {
      const result = yield* inspect(makeTar());
      expect(result.path).toBe(path);
      expect(result.logBytes).toBe(17);
      expect(result.decodedBytes).toBe(2048);
      expect(result.logSha256).toHaveLength(64);
    })
  );
  it.effect("rejects archive type, path, size and checksum substitutions", () =>
    Effect.gen(function* () {
      const invalidChecksum = makeTar();
      invalidChecksum[0] = 0;
      for (const bytes of [
        makeTar("safe", { path: "../outside" }),
        makeTar("safe", { path: "/absolute" }),
        makeTar("safe", { type: "SymbolicLink", linkpath: "/outside" }),
        makeTar("safe", { type: "Link", linkpath: path }),
        makeTar("safe", { type: "ExtendedHeader" }),
        makeTar("safe", { size: 65537 }),
        invalidChecksum,
        Buffer.alloc(2048),
      ])
        (yield* inspect(bytes).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
    })
  );
  it.effect("rejects hidden padding, trailing entries and incomplete framing", () =>
    Effect.gen(function* () {
      const nonzeroPadding = makeTar();
      nonzeroPadding[600] = 1;
      for (const bytes of [
        nonzeroPadding,
        Buffer.concat([makeTar(), makeTar()]),
        Buffer.concat([makeTar(), Buffer.alloc(512)]),
        makeTar().subarray(0, 1024),
        Buffer.alloc(256 * 1024),
      ])
        (yield* inspect(bytes).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
      (yield* inspectCacheSignedPilotArchive(Buffer.from("invalid"), []).pipe(Effect.result)).pipe(
        Result.isFailure,
        assertTrue
      );
    })
  );
  it.effect("rejects empty or oversized compressed inputs before decompression", () =>
    Effect.gen(function* () {
      for (const archive of [Buffer.alloc(0), Buffer.alloc(1024 * 1024 + 1)]) {
        const failure = yield* inspectCacheSignedPilotArchive(archive, []).pipe(Effect.flip);
        expect(failure.message).toBe("Signed pilot archive exceeds its compressed bound.");
      }
    })
  );
  it.effect("reports malformed base-256 header numbers as typed failures", () =>
    Effect.gen(function* () {
      const bytes = makeTar();
      bytes[124] = 0x81;
      const failure = yield* inspect(bytes).pipe(Effect.flip);
      expect(failure.message).toBe("Signed pilot archive header is invalid.");
    })
  );
  it.effect("rejects credentials in both task text and header metadata", () =>
    Effect.gen(function* () {
      const secret = Redacted.make("synthetic-archive-credential");
      for (const bytes of [secret.pipe(Redacted.value, makeTar), makeTar("safe", { uname: Redacted.value(secret) })])
        (yield* inspectCacheSignedPilotArchive(zstdCompressSync(bytes), [secret]).pipe(Effect.result)).pipe(
          Result.isFailure,
          assertTrue
        );
    })
  );
});
