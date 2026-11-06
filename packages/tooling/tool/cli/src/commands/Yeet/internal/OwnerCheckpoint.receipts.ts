/**
 * Bounded content-addressed receipt reads for an unregistered owner authority.
 * No caller identity, endpoint, deployment or signing credential is activated.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { openDirectoryHandle } from "../../../internal/repo-run/DirectoryHandle.ts";
import { FinalCheckReceipt } from "./FinalCheck.schemas.ts";
import {
  OwnerCheckpointBinding,
  OwnerCheckpointError,
  OwnerCheckpointEvidence,
  OwnerCheckpointObserver,
  OwnerCheckpointSnapshot,
} from "./OwnerCheckpoint.schemas.ts";
import { qualifyOwnerCheckpointEvidence } from "./OwnerCheckpoint.ts";
import type { OwnerCheckpointPolicy } from "./OwnerCheckpoint.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/OwnerCheckpoint.receipts");
const MAX_RECEIPT_BYTES = 1048576;
// FileSystem.open cannot express O_NONBLOCK. This fixed receipt boundary uses
// the retained DirectoryHandle pattern to reject FIFO/device replacements before
// reading, while O_NOFOLLOW rejects a final symlink atomically.
type NodeFs = typeof import("node:fs");
const nodeFs = (): NodeFs => process.getBuiltinModule("node:fs");
const refuse = () => OwnerCheckpointError.make({ reason: "evidence" });
const attempt = <Value>(run: () => Value) => Effect.try({ try: run, catch: refuse });

/**
 * One content-addressed JSON reference inside the installed private receipt root.
 * **Example** (Inspect the receipt reference)
 * ```ts
 * import { OwnerCheckpointReceiptRef } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof OwnerCheckpointReceiptRef) // "function"
 * ```
 * @category models
 * @since 0.0.0
 */
export class OwnerCheckpointReceiptRef extends S.Opaque<OwnerCheckpointReceiptRef, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String.check(S.isPattern(/^[a-f0-9]{64}\.json$/u)),
    sha256: Sha256Hex,
  }).pipe(
    $I.annoteSchema("OwnerCheckpointReceiptRef", {
      description: "Flat SHA-256 JSON name; no arbitrary path traversal.",
    })
  )
) {}

const Manifest = S.Struct({
  version: S.tag("owner-checkpoint-receipts/v1"),
  binding: OwnerCheckpointBinding,
  checkout: Sha256Hex,
  observer: OwnerCheckpointReceiptRef,
  classic: OwnerCheckpointReceiptRef,
  finalCheck: OwnerCheckpointReceiptRef,
}).pipe(
  $I.annoteSchema("Manifest", {
    description: "Versioned exact-binding immutable evidence references, never authentication.",
  })
);

type NodeStats = import("node:fs").Stats;
const validReceiptFile = (file: NodeStats, ownerUid: number) =>
  file.isFile() &&
  file.uid === ownerUid &&
  (file.mode & 0o777) === 0o600 &&
  file.nlink === 1 &&
  file.size > 0 &&
  file.size <= MAX_RECEIPT_BYTES;
const unchangedReceiptFile = (before: NodeStats, after: NodeStats, size: number) =>
  size === before.size &&
  after.dev === before.dev &&
  after.ino === before.ino &&
  after.size === before.size &&
  after.mtimeMs === before.mtimeMs &&
  after.ctimeMs === before.ctimeMs;

const readBytes = Effect.fnUntraced(function* (directoryFd: number, ref: OwnerCheckpointReceiptRef, ownerUid: number) {
  if (!S.is(OwnerCheckpointReceiptRef)(ref) || ref.name !== `${ref.sha256}.json`) return yield* refuse();
  const fs = nodeFs();
  const fd = yield* Effect.acquireRelease(
    attempt(() =>
      fs.openSync(
        `/proc/self/fd/${directoryFd}/${ref.name}`,
        fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK
      )
    ),
    (opened) => attempt(() => fs.closeSync(opened)).pipe(Effect.ignore)
  );
  const before = yield* attempt(() => fs.fstatSync(fd));
  if (!validReceiptFile(before, ownerUid)) return yield* refuse();
  const bytes = new Uint8Array(before.size + 1);
  let offset = 0;
  while (offset < bytes.length) {
    const count = yield* attempt(() => fs.readSync(fd, bytes, offset, bytes.length - offset, null));
    if (count === 0) break;
    offset += count;
  }
  const after = yield* attempt(() => fs.fstatSync(fd));
  if (!unchangedReceiptFile(before, after, offset)) return yield* refuse();
  const result = bytes.subarray(0, offset);
  const crypto = yield* Digest.Digest;
  const digest = yield* crypto.digest(Digest.sha256, result);
  if (Hex.encode(digest) !== ref.sha256) return yield* refuse();
  return yield* attempt(() => new TextDecoder("utf-8", { fatal: true }).decode(result));
});

/**
 * Decode and qualify three finite receipts from an installed private root.
 *
 * **Details**
 * The root and expected binding must come from the future isolated authority,
 * not caller configuration. Hashes bind bytes but do not authenticate a producer.
 * All reads use an inode-bound directory and no-follow/nonblocking file handles;
 * malformed, oversized, foreign-owned or changed files refuse without raw output.
 * Only the validated finite evidence is returned. No file or native API is written.
 *
 * **Example** (Inspect the unregistered receipt reader)
 * ```ts
 * import { readOwnerCheckpointEvidenceReceipts } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof readOwnerCheckpointEvidenceReceipts) // "function"
 * ```
 * @param root - Installed absolute receipt directory owned by the authority UID.
 * @param expected - Exact binding from the separately authenticated registry route.
 * @param manifestRef - Content-addressed versioned manifest.
 * @param policy - Fixed App and freshness policy.
 * @param expectedCheckout - Installed authority checkout identity from its immutable evidence producer.
 * @returns Hash-verified finite evidence, still dependent on authenticated producer provenance.
 * @category parsing
 * @since 0.0.0
 */
export const readOwnerCheckpointEvidenceReceipts = Effect.fn("OwnerCheckpoint.readEvidenceReceipts")(
  function* (
    root: string,
    expected: OwnerCheckpointBinding,
    manifestRef: OwnerCheckpointReceiptRef,
    policy: OwnerCheckpointPolicy,
    expectedCheckout: Sha256Hex
  ) {
    return yield* Effect.scoped(
      Effect.gen(function* () {
        const uid = process.getuid?.();
        if (uid === undefined) return yield* refuse();
        const fs = nodeFs();
        const canonical = yield* attempt(() => fs.realpathSync(root));
        if (canonical !== root) return yield* refuse();
        const directory = yield* openDirectoryHandle(root).pipe(Effect.mapError(refuse));
        if (O.isNone(directory)) return yield* refuse();
        const held = yield* attempt(() => fs.fstatSync(directory.value.fd));
        if (held.uid !== uid || (held.mode & 0o777) !== 0o700) return yield* refuse();
        const decode = <Value, Encoded>(codec: S.Codec<Value, Encoded>, ref: OwnerCheckpointReceiptRef) =>
          readBytes(directory.value.fd, ref, uid).pipe(
            Effect.flatMap(
              S.decodeUnknownEffect(codec.pipe(S.toCodecJson, S.fromJsonString), { onExcessProperty: "error" })
            ),
            Effect.mapError(refuse)
          );
        const manifest = yield* decode(Manifest, manifestRef);
        if (
          !A.every(
            [
              manifest.binding.repository === expected.repository,
              manifest.binding.prNumber === expected.prNumber,
              manifest.binding.owner === expected.owner,
              manifest.binding.head === expected.head,
              manifest.binding.generation === expected.generation,
            ],
            (matches) => matches
          )
        )
          return yield* refuse();
        if (manifest.checkout !== expectedCheckout) return yield* refuse();
        const observer = yield* decode(OwnerCheckpointObserver, manifest.observer);
        const classic = yield* decode(OwnerCheckpointSnapshot, manifest.classic);
        const finalCheck = yield* decode(FinalCheckReceipt, manifest.finalCheck);
        const evidence = OwnerCheckpointEvidence.make({ observer, classic, finalCheck, digest: manifestRef.sha256 });
        const now = yield* DateTime.now;
        yield* qualifyOwnerCheckpointEvidence(expected, evidence, policy, now);
        return evidence;
      })
    );
  },
  Effect.timeoutOrElse({ duration: "5 seconds", orElse: () => Effect.fail(refuse()) })
);
