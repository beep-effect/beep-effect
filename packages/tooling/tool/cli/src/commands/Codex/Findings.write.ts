/**
 * Staged, scanned, atomically promoted packet writes.
 *
 * A packet is built in full inside an unpredictable staging directory beside
 * its destination, then promoted with a single directory rename. That shape
 * buys three properties at once: a crash can never leave a half-written packet,
 * a rename onto an existing non-empty directory fails so refusing to clobber
 * needs no separate check, and every byte is scanned before anything lands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { writeFileWithinCanonicalRootAtomically } from "@beep/file-processing/PathSafety";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import { Effect, FileSystem, Path } from "effect";
import * as S from "effect/Schema";
import { CodexFindingsRedactionError, CodexPacketWriteError } from "./Findings.errors.ts";
import { describeSensitiveHits, scanSensitiveText } from "./Findings.scan.ts";

const $I = $RepoCliId.create("commands/Codex/Findings.write");

const encoder = new TextEncoder();

/**
 * How a document's scan hits are treated.
 *
 * **Details**
 *
 * `reject` is the default and governs everything the CLI composes itself.
 * `report` exists for one narrow case: report bodies copied verbatim into
 * ignored `raw/` evidence. Those are external prose that legitimately quotes
 * developer-local paths and secret-shaped literals — measured against a real
 * 27-finding export, 4 bodies carry content `reject` refuses — and they are the
 * evidence P2 validates against, so refusing them would make capture unusable.
 * Their hits are surfaced to the operator instead of failing the ingest.
 *
 * **Example** (Naming the strict policy)
 *
 * ```ts
 * import { PacketScanPolicy } from "@beep/repo-cli/commands/Codex/Findings.write"
 *
 * console.log(PacketScanPolicy.is.reject("reject")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PacketScanPolicy = LiteralKit(["reject", "report"]).pipe(
  $I.annoteSchema("PacketScanPolicy", {
    description: "Whether reject-scan hits on a document refuse the write or are reported.",
  })
);

/**
 * Scan policy applied to one packet document.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PacketScanPolicy = typeof PacketScanPolicy.Type;

/**
 * One document destined for a generated packet.
 *
 * **Details**
 *
 * `path` is always relative to the packet directory, never to the repository
 * and never absolute, so a document cannot address a location outside the
 * packet even before path containment is enforced.
 *
 * **Example** (Describing a packet document)
 *
 * ```ts
 * import { PacketDocument } from "@beep/repo-cli/commands/Codex/Findings.write"
 *
 * const document = PacketDocument.make({
 *   path: "findings/CSF-001.md",
 *   contents: "# CSF-001\n",
 *   tracked: true,
 * })
 *
 * console.log(document.path) // "findings/CSF-001.md"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PacketDocument extends S.Class<PacketDocument>($I`PacketDocument`)(
  {
    // Directory segments must start alphanumeric, so a hidden directory such as
    // `.git/` is refused, while a dotfile filename such as `raw/.gitignore` —
    // which every Codex packet requires — is admitted. The trailing lookahead
    // rejects `.` and `..` as a filename in their own right.
    path: S.String.check(
      S.isPattern(/^(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*(?!\.\.?$)[A-Za-z0-9._-]+$/, {
        identifier: $I`PacketDocumentPathCheck`,
        title: "Packet Document Path",
        description: "Packet-relative paths carry no traversal, no hidden directory, and no absolute prefix.",
        message: "Expected a packet-relative document path",
      })
    ).pipe(
      $I.annoteKey("PacketDocument.path", {
        description: "Location of the document relative to the packet directory.",
      })
    ),
    contents: S.String.pipe(
      $I.annoteKey("PacketDocument.contents", {
        description: "Full text of the document.",
      })
    ),
    tracked: S.Boolean.pipe(
      $I.annoteKey("PacketDocument.tracked", {
        description: "Whether git tracks this document.",
      })
    ),
    scan: PacketScanPolicy.pipe(
      SchemaUtils.withKeyDefaults("reject"),
      $I.annoteKey("PacketDocument.scan", {
        description: "Whether scan hits refuse the write or are reported to the operator.",
      })
    ),
  },
  $I.annote("PacketDocument", {
    description: "One document destined for a generated Codex findings packet.",
  })
) {}

/**
 * Refuse a document set carrying secret-shaped or private content.
 *
 * **When to use**
 *
 * Use when staging a packet, over every document including untracked raw
 * evidence. Scanning only tracked output would leave the ignored `raw/`
 * directory — which the repository's commit-range secret scanner structurally
 * never sees — without any control at all.
 *
 * **Example** (Refusing a private path)
 *
 * ```ts
 * import { PacketDocument, assertPacketDocumentsClean } from "@beep/repo-cli/commands/Codex/Findings.write"
 * import { Effect } from "effect"
 *
 * const program = assertPacketDocumentsClean([
 *   PacketDocument.make({ path: "raw/payload.json", contents: "/home/dev/x", tracked: false }),
 * ]).pipe(
 *   Effect.map(() => "accepted"),
 *   Effect.orElseSucceed(() => "refused")
 * )
 *
 * console.log(Effect.runSync(program)) // "refused"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const assertPacketDocumentsClean = Effect.fnUntraced(function* (documents: ReadonlyArray<PacketDocument>) {
  const strict = A.filter(documents, (document) => document.scan === "reject");
  const hits = A.flatMap(strict, (document) => scanSensitiveText(document.path, document.contents));

  if (A.isReadonlyArrayNonEmpty(hits)) {
    const surfaces = describeSensitiveHits(hits);
    return yield* CodexFindingsRedactionError.make({
      message: `Refusing to write the packet: ${A.length(surfaces)} document(s) carry secret-shaped or private content. Remove it from the capture and re-ingest; the offending values are deliberately not reproduced here.`,
      surfaces,
    });
  }

  // Verbatim evidence is not refused, but the operator is told what it holds so
  // ignored `raw/` never becomes a place where nobody is looking.
  const verbatim: ReadonlyArray<PacketDocument> = A.filter(documents, (document) => document.scan === "report");
  return describeSensitiveHits(A.flatMap(verbatim, (document) => scanSensitiveText(document.path, document.contents)));
});

/**
 * Stage, scan, and atomically promote a complete packet.
 *
 * **Details**
 *
 * The staging directory is created inside `goals/` so the final promotion is a
 * same-filesystem rename. Promotion fails when the destination already exists,
 * which is the refuse-to-clobber guarantee — four packets of hand-written
 * triage prose are exactly what must never be silently overwritten.
 *
 * **Gotchas**
 *
 * A dry run performs no filesystem writes at all, not even staging, but still
 * runs the full scan. A payload that would be refused is refused identically in
 * both modes.
 *
 * **Example** (Planning a packet without writing it)
 *
 * ```ts
 * import { PacketDocument, writePacket } from "@beep/repo-cli/commands/Codex/Findings.write"
 *
 * const documents = [
 *   PacketDocument.make({ path: "README.md", contents: "# packet\n", tracked: true }),
 * ]
 *
 * console.log(documents.length) // 1
 * console.log(typeof writePacket) // "function"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const writePacket = Effect.fnUntraced(function* (options: {
  readonly repoRoot: string;
  readonly slug: string;
  readonly documents: ReadonlyArray<PacketDocument>;
  readonly dryRun: boolean;
  /** Replace an existing packet instead of refusing. Destroys hand-written prose. */
  readonly force?: boolean | undefined;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  // Every containment decision is made against the canonical repository root,
  // so a symlink later swapped in for `goals/` cannot inherit write authority.
  const canonicalRoot = yield* fs
    .realPath(options.repoRoot)
    .pipe(
      Effect.mapError((cause) =>
        CodexPacketWriteError.from(cause, "path-escape", "The repository root could not be canonicalized.")
      )
    );

  const goalsDir = path.join(canonicalRoot, "goals");
  const packetDir = path.join(goalsDir, options.slug);
  const packetRelative = path.join("goals", options.slug);

  const exists = yield* fs
    .exists(packetDir)
    .pipe(
      Effect.mapError((cause) =>
        CodexPacketWriteError.from(cause, "staging-failed", `${packetRelative} could not be inspected.`)
      )
    );

  if (exists && options.force !== true) {
    return yield* CodexPacketWriteError.make({
      reason: "packet-exists",
      message: `${packetRelative} already exists. Re-ingesting would overwrite triage prose written by hand; pass --force to replace it deliberately.`,
    });
  }

  const reportedEvidence = yield* assertPacketDocumentsClean(options.documents);

  if (options.dryRun) {
    return {
      packetPath: packetRelative,
      written: A.map(options.documents, (document) => `${packetRelative}/${document.path}`),
      committed: false,
      reportedEvidence,
    };
  }

  const stagingDir = yield* fs
    .makeTempDirectory({ directory: goalsDir, prefix: `.tmp-${options.slug}-` })
    .pipe(
      Effect.mapError((cause) =>
        CodexPacketWriteError.from(cause, "staging-failed", "A staging directory could not be created under goals/.")
      )
    );

  const stagingRelative = path.relative(canonicalRoot, stagingDir);

  return yield* Effect.onError(
    Effect.gen(function* () {
      for (const document of options.documents) {
        yield* writeFileWithinCanonicalRootAtomically({
          canonicalRoot,
          candidate: path.join(stagingRelative, document.path),
          bytes: encoder.encode(document.contents),
        }).pipe(
          Effect.mapError((cause) =>
            CodexPacketWriteError.from(cause, "staging-failed", `${document.path} could not be staged.`)
          )
        );
      }

      // Under --force the existing packet is moved aside rather than deleted,
      // so a failed promotion can put it back. Deleting first would open a
      // window where a rename failure loses the replacement AND the packet of
      // hand-written triage prose it was replacing.
      const replacing = options.force === true && exists;
      const backupDir = `${stagingDir}-replaced`;

      if (replacing) {
        yield* fs
          .rename(packetDir, backupDir)
          .pipe(
            Effect.mapError((cause) =>
              CodexPacketWriteError.from(cause, "commit-failed", `${packetRelative} could not be moved aside.`)
            )
          );
      }

      // A rename onto an existing non-empty directory fails, so the
      // refuse-to-clobber guarantee survives a packet created between the
      // existence check above and this promotion.
      const restoreThenFail = Effect.fnUntraced(function* (cause: unknown) {
        // Put the replaced packet back before surfacing the failure, so a lost
        // promotion never also loses the packet it was replacing.
        if (replacing) {
          yield* fs.rename(backupDir, packetDir).pipe(Effect.ignore);
        }
        return yield* CodexPacketWriteError.from(
          cause,
          "commit-failed",
          `The staged packet could not be promoted to ${packetRelative}.`
        );
      });

      yield* fs.rename(stagingDir, packetDir).pipe(Effect.catch(restoreThenFail));

      if (replacing) {
        yield* fs.remove(backupDir, { recursive: true, force: true }).pipe(Effect.ignore);
      }

      return {
        packetPath: packetRelative,
        written: A.map(options.documents, (document) => `${packetRelative}/${document.path}`),
        committed: true,
        reportedEvidence,
      };
    }),
    () => fs.remove(stagingDir, { recursive: true, force: true }).pipe(Effect.ignore)
  );
});
