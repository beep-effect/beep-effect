import {
  ArchiveWriter,
  ArchiveWriterLive,
  approveT7Preservation,
  CorpusCommandServiceLive,
  CorpusLedgerRecordJson,
  CorpusProvenanceRecord,
  makeArchiveWriterLive,
  PreservationManifestRow,
  PreservationManifestRowJson,
  PreservationManifestStore,
  PreservationManifestStoreLive,
  PreservationObjectIdentity,
  PreservationVerifier,
  PreservationVerifierLive,
  preflightT7Preservation,
  runT7Preservation,
  StreamingHasher,
  StreamingHasherLive,
  T7ArchiveProvenanceRecord,
  T7PreservationOptions,
} from "@beep/repo-cli/commands/Corpus";
import { NonNegativeInt, Sha256HexFromBytes } from "@beep/schema";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Effect, FileSystem, Layer, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const hashBytes = S.decodeUnknownEffect(Sha256HexFromBytes);

const syntheticBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = index % 251;
  }
  return bytes;
};

const identityFor = Effect.fn("CorpusPreservationTest.identityFor")(function* (
  sourcePath: string,
  relativePath: string
) {
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs.stat(sourcePath);
  const mtimeEpoch = pipe(
    info.mtime,
    O.map((mtime) => Math.floor(DateTime.toEpochMillis(DateTime.makeUnsafe(mtime)) / 1000)),
    O.getOrElse(() => 0)
  );
  return PreservationObjectIdentity.make({
    mtimeEpoch,
    mtimeIso: "2026-08-27T00:00:00Z",
    relativePath,
    sizeBytes: NonNegativeInt.make(Number(info.size)),
    sourceClass: "salvage-tree",
  });
});

const rowFor = Effect.fn("CorpusPreservationTest.rowFor")(function* (
  object: PreservationObjectIdentity,
  destRelativePath: string,
  outcome: Parameters<typeof PreservationManifestRow.make>[0]["outcome"],
  attempt = 1
) {
  return PreservationManifestRow.make({
    archivedAt: "2026-08-27T00:00:00Z",
    attempt: NonNegativeInt.make(attempt),
    destRelativePath,
    object,
    outcome,
  });
});

const serviceLayer = (
  manifestPath: string,
  writerLayer: Layer.Layer<ArchiveWriter, never, FileSystem.FileSystem | Path.Path> = ArchiveWriterLive
) =>
  Layer.mergeAll(
    writerLayer,
    PreservationManifestStoreLive(manifestPath),
    PreservationVerifierLive(manifestPath),
    StreamingHasherLive
  ).pipe(Layer.provideMerge(NodeServices.layer));

describe("T7 corpus preservation", () => {
  it.effect("refuses missing, unapproved, and undersized capacity preflights", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const context = yield* Layer.build(CorpusCommandServiceLive.pipe(Layer.provideMerge(NodeServices.layer)));
        const fs = yield* FileSystem.FileSystem.pipe(Effect.provide(context));
        const path = yield* Path.Path.pipe(Effect.provide(context));
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "preservation-preflight-test-" });
        const corpusRoot = path.join(root, "corpus");
        const t7Root = path.join(root, "t7");
        const salvageRoot = path.join(t7Root, "oppold-salvage-2026-08-10");
        yield* fs.makeDirectory(corpusRoot, { recursive: true });
        yield* fs.makeDirectory(salvageRoot, { recursive: true });
        yield* fs.writeFile(path.join(salvageRoot, "synthetic.bin"), new Uint8Array([1, 2, 3]));
        yield* fs.writeFile(path.join(t7Root, "oppold-corpus.zip"), new Uint8Array([4]));
        const options = T7PreservationOptions.make({ corpusRoot, t7Root });

        const missing = yield* runT7Preservation(options).pipe(Effect.flip, Effect.provide(context));
        expect(missing._tag).toBe("PreservationPreflightMissingError");

        const proposed = yield* preflightT7Preservation(options).pipe(Effect.provide(context));
        expect(proposed.kind).toBe("proposed");
        const unapproved = yield* runT7Preservation(options).pipe(Effect.flip, Effect.provide(context));
        expect(unapproved._tag).toBe("PreservationPreflightUnapprovedError");

        yield* approveT7Preservation(corpusRoot, 0, "synthetic-operator").pipe(Effect.provide(context));
        const exceeded = yield* runT7Preservation(options).pipe(Effect.flip, Effect.provide(context));
        expect(exceeded._tag).toBe("PreservationCeilingExceededError");
      })
    )
  );

  it.effect("streams, resumes, rejects corrupt prefixes, detects mutation, and recovers before PASS append", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const baseContext = yield* Layer.build(NodeServices.layer);
        const fs = yield* FileSystem.FileSystem.pipe(Effect.provide(baseContext));
        const path = yield* Path.Path.pipe(Effect.provide(baseContext));
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "preservation-writer-test-" });
        const manifestPath = path.join(root, "manifest.jsonl");
        const context = yield* Layer.build(serviceLayer(manifestPath));
        const sourceBytes = syntheticBytes(8 * 1024 * 1024);
        const expectedSha = yield* hashBytes(sourceBytes).pipe(Effect.provide(baseContext));
        const source = path.join(root, "source.bin");
        yield* fs.writeFile(source, sourceBytes);
        const identity = yield* identityFor(source, "source.bin").pipe(Effect.provide(baseContext));
        const writer = yield* ArchiveWriter.pipe(Effect.provide(context));
        const hasher = yield* StreamingHasher.pipe(Effect.provide(context));
        const streamed = yield* hasher.hashFile(source);
        expect(streamed.sha256).toBe(expectedSha);
        expect(streamed.bytes).toBe(sourceBytes.byteLength);
        const prefixHash = yield* hasher.hashFilePrefix(source, 2 * 1024 * 1024);
        const independentPrefixHash = yield* hashBytes(sourceBytes.subarray(0, prefixHash.bytes)).pipe(
          Effect.provide(baseContext)
        );
        expect(prefixHash.sha256).toBe(independentPrefixHash);

        const freshDest = path.join(root, "archive", "fresh.bin");
        const fresh = yield* writer.archiveObject(source, freshDest, identity);
        expect(fresh.kind).toBe("copied");
        expect(fresh.kind === "copied" && fresh.sha256).toBe(expectedSha);
        expect(fresh.kind === "copied" && fresh.bytesCopied).toBe(sourceBytes.byteLength);

        const complete = yield* writer.archiveObject(source, freshDest, identity);
        expect(complete.kind).toBe("already-complete");

        const prefixDest = path.join(root, "archive", "prefix.bin");
        const prefixLength = 2 * 1024 * 1024;
        yield* fs.writeFile(prefixDest, sourceBytes.subarray(0, prefixLength));
        const resumed = yield* writer.archiveObject(source, prefixDest, identity);
        expect(resumed.kind).toBe("resume-completed");
        expect(resumed.kind === "resume-completed" && resumed.bytesReused).toBe(prefixLength);
        expect(resumed.kind === "resume-completed" && resumed.bytesCopied).toBe(sourceBytes.byteLength - prefixLength);

        const corruptDest = path.join(root, "archive", "corrupt.bin");
        const corrupt = sourceBytes.slice(0, prefixLength);
        corrupt[0] = corrupt[0] === 0 ? 1 : 0;
        yield* fs.writeFile(corruptDest, corrupt);
        const discarded = yield* writer.archiveObject(source, corruptDest, identity);
        expect(discarded.kind).toBe("resume-discarded");
        const copiedAfterDiscard = yield* writer.archiveObject(source, corruptDest, identity);
        expect(copiedAfterDiscard.kind).toBe("copied");

        const unreadable = yield* writer.archiveObject(
          path.join(root, "missing.bin"),
          path.join(root, "missing-copy.bin"),
          identity
        );
        expect(unreadable.kind).toBe("unreadable");

        const mutationSource = path.join(root, "mutation-source.bin");
        const mutationDest = path.join(root, "archive", "mutation.bin");
        yield* fs.writeFile(mutationSource, sourceBytes);
        const mutationIdentity = yield* identityFor(mutationSource, "mutation-source.bin").pipe(
          Effect.provide(baseContext)
        );
        const mutationLayer = serviceLayer(
          path.join(root, "mutation-manifest.jsonl"),
          makeArchiveWriterLive({
            afterPayloadSync: (sourceAbs) => fs.writeFile(sourceAbs, new Uint8Array([1]), { flag: "a" }),
          })
        );
        const mutationContext = yield* Layer.build(mutationLayer);
        const mutationWriter = yield* ArchiveWriter.pipe(Effect.provide(mutationContext));
        const changed = yield* mutationWriter.archiveObject(mutationSource, mutationDest, mutationIdentity);
        expect(changed.kind).toBe("changed-during-copy");
        expect(yield* fs.exists(mutationDest)).toBe(false);
        expect(
          yield* PreservationManifestStore.use((store) => store.readAll).pipe(Effect.provide(mutationContext))
        ).toHaveLength(0);

        const crashDest = path.join(root, "archive", "crash.bin");
        const landed = yield* writer.archiveObject(source, crashDest, identity);
        expect(landed.kind).toBe("copied");
        const store = yield* PreservationManifestStore.pipe(Effect.provide(context));
        expect(yield* store.readAll).toHaveLength(0);
        const recovered = yield* writer.archiveObject(source, crashDest, identity);
        expect(recovered.kind).toBe("already-complete");
        yield* store.append(yield* rowFor(identity, "crash.bin", recovered));
        expect(yield* store.readAll).toHaveLength(1);
        const recoveryReport = yield* PreservationVerifier.use((verifier) =>
          verifier.verify(path.join(root, "archive"))
        ).pipe(Effect.provide(context));
        expect(recoveryReport.summary.verified).toBe(1);
      })
    )
  );

  it.effect("reports tampered, truncated, and removed terminal destinations", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const baseContext = yield* Layer.build(NodeServices.layer);
        const fs = yield* FileSystem.FileSystem.pipe(Effect.provide(baseContext));
        const path = yield* Path.Path.pipe(Effect.provide(baseContext));
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "preservation-verifier-test-" });
        const archiveRoot = path.join(root, "archive");
        const manifestPath = path.join(root, "manifest.jsonl");
        const context = yield* Layer.build(serviceLayer(manifestPath));
        const writer = yield* ArchiveWriter.pipe(Effect.provide(context));
        const store = yield* PreservationManifestStore.pipe(Effect.provide(context));
        const bytes = syntheticBytes(1024 * 1024);
        const source = path.join(root, "source.bin");
        yield* fs.writeFile(source, bytes);
        const names = ["tampered.bin", "truncated.bin", "removed.bin"];
        for (const name of names) {
          const identity = yield* identityFor(source, name).pipe(Effect.provide(baseContext));
          const outcome = yield* writer.archiveObject(source, path.join(archiveRoot, name), identity);
          yield* store.append(yield* rowFor(identity, name, outcome));
        }
        const tampered = bytes.slice();
        tampered[0] = tampered[0] === 0 ? 1 : 0;
        yield* fs.writeFile(path.join(archiveRoot, "tampered.bin"), tampered);
        yield* fs.truncate(path.join(archiveRoot, "truncated.bin"), bytes.byteLength - 1);
        yield* fs.remove(path.join(archiveRoot, "removed.bin"));

        const report = yield* PreservationVerifier.use((verifier) => verifier.verify(archiveRoot)).pipe(
          Effect.provide(context)
        );
        expect(A.map(report.rows, (row) => row.outcome.kind)).toEqual([
          "hash-mismatch",
          "size-mismatch",
          "missing-destination",
        ]);
      })
    )
  );

  it.effect("round-trips preservation rows and decodes mixed ledger generations", () =>
    Effect.gen(function* () {
      const sha = yield* hashBytes(new Uint8Array());
      const object = PreservationObjectIdentity.make({
        mtimeEpoch: 0,
        mtimeIso: "2026-08-27T00:00:00Z",
        relativePath: "synthetic.bin",
        sizeBytes: 0,
        sourceClass: "salvage-tree",
      });
      const row = yield* rowFor(object, "synthetic.bin", { kind: "already-complete", bytesReused: 0, sha256: sha });
      const encodedRow = yield* PreservationManifestRowJson.encode(row);
      expect(yield* PreservationManifestRowJson.decode(encodedRow)).toEqual(row);

      const legacy = CorpusProvenanceRecord.make({
        destPath: "/synthetic/archive.bin",
        mtimeEpoch: 0,
        mtimeIso: "2026-08-27T00:00:00Z",
        originPath: "/synthetic/source.bin",
        relativePath: "source.bin",
        salvagedAt: "2026-08-27T00:00:00Z",
        sha256: sha,
        sizeBytes: 0,
        sourceLabel: "synthetic-source",
      });
      const archive = T7ArchiveProvenanceRecord.make({
        archivedAt: "2026-08-27T00:00:00Z",
        destRelativePath: "synthetic.bin",
        mtimeEpoch: 0,
        mtimeIso: "2026-08-27T00:00:00Z",
        record: "t7-archive/v1",
        relativePath: "synthetic.bin",
        sha256: sha,
        sizeBytes: 0,
        sourceClass: "salvage-tree",
      });
      const stream = yield* Effect.forEach([legacy, archive], CorpusLedgerRecordJson.encode);
      const decoded = yield* Effect.forEach(stream, CorpusLedgerRecordJson.decode);
      expect(decoded).toEqual([legacy, archive]);
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
