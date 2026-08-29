/**
 * Package-level proof manifests for docgen generation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createHash } from "node:crypto";
import { $RepoDocgenId } from "@beep/identity/packages";
import { FsUtils } from "@beep/repo-utils";
import { LiteralKit, NonNegativeInt, Sha256Hex } from "@beep/schema";
import { Unknown } from "@beep/schema/Unknown";
import { A, O, Str, thunkFalse } from "@beep/utils";
import { DateTime, Effect, FileSystem, Order, Path } from "effect";
import * as S from "effect/Schema";
import * as Configuration from "./Configuration.ts";
import * as Domain from "./Domain.ts";
import * as JsonFile from "./internal/JsonFile.ts";
import * as Version from "./Version.ts";

const $I = $RepoDocgenId.create("ProofManifest");

/**
 * Literal marker written into proof manifests to identify the document format.
 *
 * **Example** (Use docgen proof manifests)
 *
 * ```ts
 * import { DocgenProofManifestStandard } from "@beep/repo-docgen/ProofManifest"
 *
 * console.log(DocgenProofManifestStandard.is["docgen-proof-manifest"]("docgen-proof-manifest")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocgenProofManifestStandard = LiteralKit(["docgen-proof-manifest"]).pipe(
  $I.annoteSchema("DocgenProofManifestStandard", {
    description: "Literal marker written into proof manifests to identify the document format.",
  })
);

/**
 * Type-level representation of the proof manifest format marker.
 *
 * **Example** (Use docgen proof manifests)
 *
 * ```ts
 * import { DocgenProofManifestStandard } from "@beep/repo-docgen/ProofManifest"
 * const standard: DocgenProofManifestStandard = "docgen-proof-manifest"
 * console.log(DocgenProofManifestStandard.is["docgen-proof-manifest"](standard))
 * // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type DocgenProofManifestStandard = typeof DocgenProofManifestStandard.Type;

/**
 * Literal schema version written into proof manifests.
 *
 * **Example** (Use docgen proof manifests)
 *
 * ```ts
 * import { DocgenProofManifestSchemaVersion } from "@beep/repo-docgen/ProofManifest"
 *
 * console.log(DocgenProofManifestSchemaVersion.is["1"]("1")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocgenProofManifestSchemaVersion = LiteralKit(["1"]).pipe(
  $I.annoteSchema("DocgenProofManifestSchemaVersion", {
    description: "Literal schema version written into proof manifests.",
  })
);

/**
 * Type-level representation of the proof manifest schema version.
 *
 * **Example** (Use docgen proof manifests)
 *
 * ```ts
 * import { DocgenProofManifestSchemaVersion } from "@beep/repo-docgen/ProofManifest"
 * const version: DocgenProofManifestSchemaVersion = "1"
 * console.log(DocgenProofManifestSchemaVersion.is["1"](version))
 * // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type DocgenProofManifestSchemaVersion = typeof DocgenProofManifestSchemaVersion.Type;

/**
 * Verification status for a package-local docgen proof manifest.
 *
 * **Example** (Use docgen proof manifests)
 *
 * ```ts
 * import { DocgenProofManifestStatus } from "@beep/repo-docgen/ProofManifest"
 *
 * console.log(DocgenProofManifestStatus.is.current("current")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocgenProofManifestStatus = LiteralKit(["current", "missing", "stale"]).pipe(
  $I.annoteSchema("DocgenProofManifestStatus", {
    description: "Verification status for a package-local docgen proof manifest.",
  })
);

/**
 * Verification status for a package-local docgen proof manifest.
 *
 * **Example** (Use docgen proof manifests)
 *
 * ```ts
 * import { DocgenProofManifestStatus } from "@beep/repo-docgen/ProofManifest"
 * const status: DocgenProofManifestStatus = "current"
 * console.log(DocgenProofManifestStatus.is.current(status))
 * // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type DocgenProofManifestStatus = typeof DocgenProofManifestStatus.Type;

/**
 * File-level SHA-256 digest included in a docgen proof manifest.
 *
 * **Example** (Use docgen proof manifests)
 *
 * ```ts
 * import { NonNegativeInt, Sha256Hex } from "@beep/schema"
 * import { DocgenProofManifestFile } from "@beep/repo-docgen/ProofManifest"
 *
 * const file = DocgenProofManifestFile.make({
 *   path: "src/index.ts",
 *   sha256: Sha256Hex.make("0".repeat(64)),
 *   bytes: NonNegativeInt.make(128)
 * })
 *
 * console.log(file.path) // "src/index.ts"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocgenProofManifestFile extends S.Class<DocgenProofManifestFile>($I`DocgenProofManifestFile`)(
  {
    path: S.String,
    sha256: Sha256Hex,
    bytes: NonNegativeInt,
  },
  $I.annote("DocgenProofManifestFile", {
    description: "File-level SHA-256 digest included in a docgen proof manifest.",
  })
) {}

/**
 * Package input and generated-docs fingerprint for docgen reuse.
 *
 * **Example** (Use docgen proof manifests)
 *
 * ```ts
 * import { NonNegativeInt, Sha256Hex } from "@beep/schema"
 * import { DocgenProofManifestFingerprint } from "@beep/repo-docgen/ProofManifest"
 *
 * const fingerprint = DocgenProofManifestFingerprint.make({
 *   sha256: Sha256Hex.make("a".repeat(64)),
 *   inputSha256: Sha256Hex.make("b".repeat(64)),
 *   outputSha256: Sha256Hex.make("c".repeat(64)),
 *   inputFileCount: NonNegativeInt.make(12),
 *   outputFileCount: NonNegativeInt.make(4),
 *   toolVersion: "0.0.2"
 * })
 *
 * console.log(fingerprint.outputFileCount) // 4
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocgenProofManifestFingerprint extends S.Class<DocgenProofManifestFingerprint>(
  $I`DocgenProofManifestFingerprint`
)(
  {
    sha256: Sha256Hex,
    inputSha256: Sha256Hex,
    outputSha256: Sha256Hex,
    inputFileCount: NonNegativeInt,
    outputFileCount: NonNegativeInt,
    toolVersion: S.String,
  },
  $I.annote("DocgenProofManifestFingerprint", {
    description: "Package input and generated-docs fingerprint for docgen reuse.",
  })
) {}

/**
 * Package-local docgen proof manifest written after successful generation.
 *
 * **Details**
 *
 * The manifest is a reuse proof, not a published API contract. Verification
 * treats changes to package inputs, generated outputs, or the docgen tool
 * version as stale.
 *
 * **Example** (Use docgen proof manifests)
 *
 * ```ts
 * import {
 *   DocgenProofManifest,
 *   DocgenProofManifestFile,
 *   DocgenProofManifestFingerprint
 * } from "@beep/repo-docgen/ProofManifest"
 * import { NonNegativeInt, Sha256Hex } from "@beep/schema"
 * const source = DocgenProofManifestFile.make({
 *   path: "src/index.ts",
 *   sha256: Sha256Hex.make("0".repeat(64)),
 *   bytes: NonNegativeInt.make(128)
 * })
 * const fingerprint = DocgenProofManifestFingerprint.make({
 *   sha256: Sha256Hex.make("1".repeat(64)),
 *   inputSha256: Sha256Hex.make("2".repeat(64)),
 *   outputSha256: Sha256Hex.make("3".repeat(64)),
 *   inputFileCount: NonNegativeInt.make(1),
 *   outputFileCount: NonNegativeInt.make(0),
 *   toolVersion: "0.0.2"
 * })
 * const manifest = DocgenProofManifest.make({
 *   standard: "docgen-proof-manifest",
 *   schemaVersion: "1",
 *   packageName: "@beep/repo-docgen",
 *   generatedAt: "2026-07-01T00:00:00.000Z",
 *   manifestPath: ".beep/docgen/proof.json",
 *   docsOutputPath: "docs",
 *   fingerprint,
 *   inputs: [source],
 *   outputs: []
 * })
 * console.log(manifest.inputs.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocgenProofManifest extends S.Class<DocgenProofManifest>($I`DocgenProofManifest`)(
  {
    standard: DocgenProofManifestStandard,
    schemaVersion: DocgenProofManifestSchemaVersion,
    packageName: S.String,
    generatedAt: S.String,
    manifestPath: S.String,
    docsOutputPath: S.String,
    fingerprint: DocgenProofManifestFingerprint,
    inputs: S.Array(DocgenProofManifestFile),
    outputs: S.Array(DocgenProofManifestFile),
  },
  $I.annote("DocgenProofManifest", {
    description: "Package-local docgen proof manifest written after successful generation.",
  })
) {
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(DocgenProofManifest));
}

/**
 * Result of checking a package-local docgen proof manifest.
 *
 * **Example** (Use docgen proof manifests)
 *
 * ```ts
 * import { DocgenProofManifestVerification } from "@beep/repo-docgen/ProofManifest"
 *
 * const verification = DocgenProofManifestVerification.make({
 *   packageName: "@beep/repo-docgen",
 *   packagePath: "/repo/packages/tooling/tool/docgen",
 *   manifestPath: "/repo/packages/tooling/tool/docgen/.beep/docgen/proof.json",
 *   status: "stale",
 *   reason: "package docgen inputs changed"
 * })
 *
 * console.log(verification.status) // "stale"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocgenProofManifestVerification extends S.Class<DocgenProofManifestVerification>(
  $I`DocgenProofManifestVerification`
)(
  {
    packageName: S.String,
    packagePath: S.String,
    manifestPath: S.String,
    status: DocgenProofManifestStatus,
    reason: S.optionalKey(S.String),
  },
  $I.annote("DocgenProofManifestVerification", {
    description: "Result of checking a package-local docgen proof manifest.",
  })
) {}

const encodeUnknownJson = Unknown.encodeUnknownSyncFromJsonString;
const DOCGEN_PROOF_MANIFEST_PATH = ".beep/docgen/proof.json" as const;
const DOCGEN_PROOF_INPUT_GLOBS = [
  "src/**/*.{ts,tsx,mts,cts,md,mdx}",
  "docgen.json",
  "package.json",
  "README.md",
  "tsconfig*.json",
] as const;
const DOCGEN_PROOF_OUTPUT_GLOBS = ["docs/**/*"] as const;
const DOCGEN_PROOF_GLOB_IGNORES = ["**/.beep/**", "**/.turbo/**", "**/node_modules/**"] as const;

const sha256Text = (value: string): string => createHash("sha256").update(value).digest("hex");

const sha256Hex = (value: string): Sha256Hex => Sha256Hex.make(sha256Text(value));

const jsonText = (value: unknown): string => encodeUnknownJson(value);

const sha256Json = (value: unknown): Sha256Hex => sha256Hex(jsonText(value));

const byFilePathAscending: Order.Order<DocgenProofManifestFile> = Order.mapInput(
  Order.String,
  (file: DocgenProofManifestFile) => file.path
);

const sortedFileDigests = (files: ReadonlyArray<DocgenProofManifestFile>): ReadonlyArray<DocgenProofManifestFile> =>
  A.sort(files, byFilePathAscending);

const manifestPathForPackage = (packagePath: string, path: Path.Path): string =>
  path.join(packagePath, DOCGEN_PROOF_MANIFEST_PATH);

const readFileDigest = Effect.fn("DocgenProofManifest.readFileDigest")(function* (
  packagePath: string,
  filePath: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const content = yield* fs.readFileString(filePath).pipe(
    Effect.mapError((cause) =>
      Domain.DocgenError.make({
        message: `[ProofManifest.readFileDigest] Failed to read '${filePath}'\n${String(cause)}`,
      })
    )
  );

  return DocgenProofManifestFile.make({
    path: Str.replace(/\\/g, "/")(path.relative(packagePath, filePath)),
    sha256: sha256Hex(content),
    bytes: NonNegativeInt.make(content.length),
  });
});

const collectFileDigests = Effect.fn("DocgenProofManifest.collectFileDigests")(function* (
  packagePath: string,
  patterns: ReadonlyArray<string>
) {
  const fsUtils = yield* FsUtils;
  const files = yield* fsUtils
    .globFiles(patterns, {
      absolute: true,
      cwd: packagePath,
      ignore: DOCGEN_PROOF_GLOB_IGNORES,
    })
    .pipe(
      Effect.mapError((cause) =>
        Domain.DocgenError.make({
          message: `[ProofManifest.collectFileDigests] Failed to glob docgen proof files\n${String(cause)}`,
        })
      )
    );
  const digests = yield* Effect.forEach(files, (filePath) => readFileDigest(packagePath, filePath), {
    concurrency: "unbounded",
  });

  return sortedFileDigests(digests);
});

const fingerprintForFiles = Effect.fn("DocgenProofManifest.fingerprintForFiles")(function* (options: {
  readonly inputs: ReadonlyArray<DocgenProofManifestFile>;
  readonly outputs: ReadonlyArray<DocgenProofManifestFile>;
}) {
  const inputSha256 = sha256Json(options.inputs);
  const outputSha256 = sha256Json(options.outputs);
  const toolVersion = yield* Version.readModuleVersion();

  return DocgenProofManifestFingerprint.make({
    sha256: sha256Json({ inputSha256, outputSha256, toolVersion }),
    inputSha256,
    outputSha256,
    inputFileCount: NonNegativeInt.make(options.inputs.length),
    outputFileCount: NonNegativeInt.make(options.outputs.length),
    toolVersion,
  });
});

const computeDocgenProofPayload = Effect.fn("DocgenProofManifest.computeDocgenProofPayload")(function* (
  packagePath: string
) {
  const inputs = yield* collectFileDigests(packagePath, DOCGEN_PROOF_INPUT_GLOBS);
  const outputs = yield* collectFileDigests(packagePath, DOCGEN_PROOF_OUTPUT_GLOBS);
  const fingerprint = yield* fingerprintForFiles({ inputs, outputs });

  return {
    inputs,
    outputs,
    fingerprint,
  } as const;
});

const makeVerification = (options: {
  readonly packageName: string;
  readonly packagePath: string;
  readonly manifestPath: string;
  readonly status: DocgenProofManifestStatus;
  readonly reason?: string | undefined;
}): DocgenProofManifestVerification =>
  DocgenProofManifestVerification.make({
    packageName: options.packageName,
    packagePath: options.packagePath,
    manifestPath: options.manifestPath,
    status: options.status,
    ...O.getSomesStruct({ reason: O.fromUndefinedOr(options.reason) }),
  });

/**
 * Write the current package's docgen proof manifest after successful generation.
 *
 * **Details**
 *
 * The effect fingerprints configured package inputs and generated docs before
 * writing `.beep/docgen/proof.json`. Call it only after docs have been
 * generated; otherwise the output fingerprint records a stale or empty docs
 * directory.
 *
 * **Example** (Use docgen proof manifests)
 *
 * ```ts
 * import { writeDocgenProofManifest } from "@beep/repo-docgen/ProofManifest"
 * import { Effect } from "effect"
 * const packageName = writeDocgenProofManifest().pipe(
 *   Effect.map((manifest) => manifest.packageName)
 * )
 * console.log(packageName)
 * ```
 *
 * @returns The written package-local proof manifest.
 * @effects Reads package inputs and generated docs, creates the manifest directory, and writes `.beep/docgen/proof.json`.
 * @category workflows
 * @since 0.0.0
 */
export const writeDocgenProofManifest = Effect.fn("DocgenProofManifest.writeDocgenProofManifest")(
  function* (): Effect.fn.Return<
    DocgenProofManifest,
    Domain.DocgenError,
    Configuration.Configuration | Domain.Process | FileSystem.FileSystem | Path.Path | FsUtils
  > {
    const config = yield* Configuration.Configuration;
    const process = yield* Domain.Process;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const packagePath = yield* process.cwd;
    const manifestPath = manifestPathForPackage(packagePath, path);
    const generatedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
    const payload = yield* computeDocgenProofPayload(packagePath);
    const manifest = DocgenProofManifest.make({
      standard: "docgen-proof-manifest",
      schemaVersion: "1",
      packageName: config.projectName,
      generatedAt,
      manifestPath: DOCGEN_PROOF_MANIFEST_PATH,
      docsOutputPath: config.outDir,
      fingerprint: payload.fingerprint,
      inputs: [...payload.inputs],
      outputs: [...payload.outputs],
    });

    yield* fs.makeDirectory(path.dirname(manifestPath), { recursive: true }).pipe(
      Effect.mapError((cause) =>
        Domain.DocgenError.make({
          message: `[ProofManifest.writeDocgenProofManifest] Failed to create manifest directory\n${String(cause)}`,
        })
      )
    );
    yield* fs.writeFileString(manifestPath, `${jsonText(manifest)}\n`).pipe(
      Effect.mapError((cause) =>
        Domain.DocgenError.make({
          message: `[ProofManifest.writeDocgenProofManifest] Failed to write '${manifestPath}'\n${String(cause)}`,
        })
      )
    );

    return manifest;
  }
);

/**
 * Verify whether a package-local docgen proof manifest matches current inputs and outputs.
 *
 * **Details**
 *
 * Missing manifests return `"missing"` instead of failing. Decode errors,
 * unreadable files, and digest collection failures use the typed
 * {@link Domain.DocgenError} channel.
 *
 * **Example** (Use docgen proof manifests)
 *
 * ```ts
 * import { verifyDocgenProofManifest } from "@beep/repo-docgen/ProofManifest"
 * import { Effect } from "effect"
 * const verificationStatus = verifyDocgenProofManifest(
 *   "/repo/packages/tooling/tool/docgen",
 *   "@beep/repo-docgen"
 * ).pipe(Effect.map((verification) => verification.status))
 * console.log(verificationStatus)
 * ```
 *
 * @param packagePath - Absolute package directory.
 * @param packageName - Expected workspace package name.
 * @returns Manifest verification status for reuse decisions.
 * @effects Reads `.beep/docgen/proof.json`, fingerprints package inputs and generated docs, and compares digests.
 * @category workflows
 * @since 0.0.0
 */
export const verifyDocgenProofManifest = Effect.fn("DocgenProofManifest.verifyDocgenProofManifest")(function* (
  packagePath: string,
  packageName: string
): Effect.fn.Return<DocgenProofManifestVerification, Domain.DocgenError, FileSystem.FileSystem | Path.Path | FsUtils> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const manifestPath = manifestPathForPackage(packagePath, path);
  const base = {
    packageName,
    packagePath,
    manifestPath,
  } as const;
  const exists = yield* fs.exists(manifestPath).pipe(Effect.orElseSucceed(thunkFalse));

  if (!exists) {
    return makeVerification({ ...base, status: "missing", reason: "proof manifest is missing" });
  }

  const manifest = yield* JsonFile.readDecodedJsonFile(
    "ProofManifest.verifyDocgenProofManifest",
    manifestPath,
    DocgenProofManifest.decodeJsonEffect
  );

  if (manifest.packageName !== packageName) {
    return makeVerification({ ...base, status: "stale", reason: "manifest package name does not match" });
  }

  const current = yield* computeDocgenProofPayload(packagePath);
  if (manifest.fingerprint.inputSha256 !== current.fingerprint.inputSha256) {
    return makeVerification({ ...base, status: "stale", reason: "package docgen inputs changed" });
  }
  if (manifest.fingerprint.outputSha256 !== current.fingerprint.outputSha256) {
    return makeVerification({ ...base, status: "stale", reason: "generated docs output changed" });
  }
  if (manifest.fingerprint.toolVersion !== current.fingerprint.toolVersion) {
    return makeVerification({ ...base, status: "stale", reason: "docgen tool version changed" });
  }

  return makeVerification({ ...base, status: "current" });
});
