/**
 * Workspace-vault adapter for the product-neutral source-text resolver port.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DocTextFileProcessingEngineDescriptor } from "@beep/doc-text";
import { ExtractFileOperation } from "@beep/file-processing/Operation";
import { resolvePathWithinCanonicalRoot } from "@beep/file-processing/PathSafety";
import { FileProcessingService } from "@beep/file-processing/Service";
import {
  ResolvedSourceText,
  SourceTextResolver,
  SourceTextResolverError,
  UTF8_SOURCE_TEXT_EXTRACTOR_NAME,
  UTF8_SOURCE_TEXT_EXTRACTOR_VERSION,
} from "@beep/file-processing/SourceText";
import { classifyFormatFromExtension } from "@beep/file-processing/Strategy";
import { $WorkspaceServerId } from "@beep/identity";
import { SourceTextDigest, SourceTextExtractor } from "@beep/provenance/SourceTextIdentity";
import { Sha256HexFromBytes } from "@beep/schema";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { O } from "@beep/utils";
import * as WorkspaceUseCases from "@beep/workspace-use-cases/server";
import { Cache, Effect, FileSystem, Layer, Match, Path } from "effect";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { FileProcessingServiceShape } from "@beep/file-processing/Service";
import type { ResolveSourceTextRequest } from "@beep/file-processing/SourceText";
import type { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import type * as Crypto from "effect/Crypto";

const $I = $WorkspaceServerId.create("SourceText/WorkspaceSourceTextResolver");
const LOCATOR_NORMALIZATION_VERSION = "1";
const CANONICAL_TEXT_CACHE_CAPACITY = 32;
const MAX_SOURCE_BYTES = 32 * 1024 * 1024;
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
const utf8Encoder = new TextEncoder();
const sourceTextDigestEquals = S.toEquivalence(SourceTextDigest);
const sourceTextExtractorEquals = S.toEquivalence(SourceTextExtractor);
const decodeSha256HexFromBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const decodeSourceTextDigest = S.decodeUnknownEffect(SourceTextDigest);
const decodeExtractFileOperation = S.decodeUnknownEffect(ExtractFileOperation);
const WorkspaceScopeRefParts = S.TemplateLiteralParser(["workspace:", S.FiniteFromString]).pipe(
  $I.annoteSchema("WorkspaceScopeRefParts", {
    description: "Workspace provider interpretation of an opaque source-text scope reference.",
  })
);
const decodeWorkspaceScopeRefParts = S.decodeUnknownEffect(WorkspaceScopeRefParts);
const decodeWorkspaceId = S.decodeUnknownEffect(WorkspaceIdentity.WorkspaceId);

const resolverError =
  (reason: SourceTextResolverError["reason"], message: string) =>
  (cause?: unknown): SourceTextResolverError =>
    SourceTextResolverError.new(reason, message, cause);

const digestBytes = Effect.fnUntraced(function* (
  bytes: Uint8Array
): Effect.fn.Return<SourceTextDigest, SourceTextResolverError, Crypto.Crypto> {
  const hex = yield* decodeSha256HexFromBytes(bytes).pipe(
    Effect.mapError(resolverError("extraction-failed", "The source-text digest could not be computed."))
  );
  return yield* decodeSourceTextDigest(`sha256:${hex}`).pipe(
    Effect.mapError(resolverError("extraction-failed", "The computed source-text digest was invalid."))
  );
});

const verifyDigest = Effect.fnUntraced(function* (
  actual: SourceTextDigest,
  expected: SourceTextDigest,
  reason: "source-digest-mismatch" | "text-digest-mismatch",
  message: string
) {
  if (!sourceTextDigestEquals(actual, expected)) {
    return yield* SourceTextResolverError.new(reason, message);
  }
});

const verifyExtractor = Effect.fnUntraced(function* (expected: SourceTextExtractor, name: string, version: string) {
  const actual = yield* SourceTextExtractor.decodeEffect({ name, version }).pipe(
    Effect.mapError(resolverError("extractor-unavailable", "The selected source-text extractor identity was invalid."))
  );
  if (!sourceTextExtractorEquals(actual, expected)) {
    return yield* SourceTextResolverError.new(
      "extractor-unavailable",
      `Pinned extractor ${expected.name}@${expected.version} is unavailable.`
    );
  }
});

const decodeUtf8 = Effect.fnUntraced(function* (bytes: Uint8Array, expected: SourceTextExtractor) {
  yield* verifyExtractor(expected, UTF8_SOURCE_TEXT_EXTRACTOR_NAME, UTF8_SOURCE_TEXT_EXTRACTOR_VERSION);
  return yield* Effect.try({
    try: () => utf8Decoder.decode(bytes),
    catch: resolverError("extraction-failed", "The source is not valid UTF-8 text."),
  });
});

const extractDocumentText = Effect.fnUntraced(function* (
  request: ResolveSourceTextRequest,
  resolvedPath: string,
  extension: string,
  format: "pdf-text-layer" | "docx",
  bytes: Uint8Array,
  fileProcessing: FileProcessingServiceShape,
  path: Path.Path
) {
  const digestHex = Str.slice("sha256:".length)(request.identity.sourceDigest);
  const operation = yield* decodeExtractFileOperation({
    format,
    operationId: `operation:${digestHex}`,
    operationKind: "extract",
    preference: { engine: DocTextFileProcessingEngineDescriptor.engine },
    source: {
      bytes,
      digest: request.identity.sourceDigest,
      extension,
      id: `artifact:${digestHex}`,
      locator: { kind: "file", value: request.identity.locator },
      name: path.basename(resolvedPath),
      relativePath: request.identity.locator,
      sizeBytes: bytes.byteLength,
    },
  }).pipe(
    Effect.mapError(
      resolverError("extraction-failed", "The source could not be shaped into a file-processing operation.")
    )
  );

  const extraction = yield* fileProcessing
    .extract(operation)
    .pipe(Effect.mapError(resolverError("extraction-failed", "Document text extraction failed.")));
  const engineVersion = yield* O.fromUndefinedOr(extraction.engineVersion).pipe(
    Effect.fromOption(() =>
      SourceTextResolverError.new("extractor-unavailable", "The document extractor has no version.")
    )
  );
  yield* verifyExtractor(request.identity.extractor, extraction.engine, engineVersion);

  return yield* O.fromUndefinedOr(extraction.text).pipe(
    Effect.fromOption(() => SourceTextResolverError.new("text-unavailable", "The document extractor returned no text."))
  );
});

const resolveWorkspaceId = Effect.fnUntraced(function* (scopeRef: string) {
  const parts = yield* decodeWorkspaceScopeRefParts(scopeRef).pipe(
    Effect.mapError(
      resolverError(
        "scope-unavailable",
        'The workspace source provider requires an opaque scope reference in the form "workspace:<id>".'
      )
    )
  );
  return yield* decodeWorkspaceId(parts[1]).pipe(
    Effect.mapError(resolverError("scope-unavailable", "The source-text scope does not identify a workspace."))
  );
});

/**
 * Build the workspace-vault implementation of the source-text resolver port.
 *
 * **Example** (Usage)
 * ```ts
 * import { makeWorkspaceSourceTextResolver } from "@beep/workspace-server/SourceText"
 *
 * console.log(typeof makeWorkspaceSourceTextResolver) // "function"
 * ```
 *
 * @effects Reads the configured workspace vault, resolves a contained source, verifies both digests and the pinned extractor, and returns complete canonical text.
 * @category adapters
 * @since 0.0.0
 */
export const makeWorkspaceSourceTextResolver = Effect.fnUntraced(function* () {
  const crypto = yield* Effect.context<Crypto.Crypto>();
  const fileProcessing = yield* FileProcessingService;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const vaultStore = yield* WorkspaceUseCases.Workspace.WorkspaceVaultStore;
  const canonicalTextCache = yield* Cache.make<SourceTextIdentity, ResolvedSourceText, SourceTextResolverError>({
    capacity: CANONICAL_TEXT_CACHE_CAPACITY,
    lookup: () =>
      Effect.fail(
        SourceTextResolverError.new("extraction-failed", "Canonical source text must be verified before it is cached.")
      ),
  });

  return SourceTextResolver.of({
    resolve: Effect.fn("source_text.resolve")((request) =>
      Effect.gen(function* () {
        yield* Effect.annotateCurrentSpan({
          "source_text.operation": "resolve",
          "source_text.storage": "workspace_vault",
        });
        if (!Eq.equals(request.identity.normalizationVersion, LOCATOR_NORMALIZATION_VERSION)) {
          return yield* SourceTextResolverError.new(
            "extractor-unavailable",
            "The pinned locator-normalization contract is unavailable."
          );
        }
        const workspaceId = yield* resolveWorkspaceId(request.identity.scopeRef);
        const vaultConfig = yield* vaultStore
          .getVaultConfig(workspaceId)
          .pipe(
            Effect.mapError(resolverError("scope-unavailable", "The workspace vault configuration is unavailable."))
          );
        const vaultRoot = yield* vaultConfig.vaultRootPath.pipe(
          Effect.fromOption(() =>
            SourceTextResolverError.new("scope-unavailable", "The workspace has no configured vault root.")
          )
        );
        const canonicalRoot = yield* fs
          .realPath(vaultRoot)
          .pipe(
            Effect.mapError(resolverError("scope-unavailable", "The configured workspace vault root is unavailable."))
          );

        if (path.isAbsolute(request.identity.locator)) {
          return yield* SourceTextResolverError.new(
            "locator-invalid",
            "Source-text locators must be relative to their configured scope root."
          );
        }

        const resolvedPath = yield* resolvePathWithinCanonicalRoot({
          canonicalRoot,
          candidate: request.identity.locator,
        }).pipe(
          Effect.provideService(FileSystem.FileSystem, fs),
          Effect.provideService(Path.Path, path),
          Effect.mapError(resolverError("locator-invalid", "The source-text locator is outside its configured root."))
        );
        const info = yield* fs
          .stat(resolvedPath)
          .pipe(Effect.mapError(resolverError("source-unavailable", "The source file is unavailable.")));
        if (!Eq.equals(info.type, "File")) {
          return yield* SourceTextResolverError.new(
            "source-unavailable",
            "The source locator does not identify a file."
          );
        }
        if (Number(info.size) > MAX_SOURCE_BYTES) {
          return yield* SourceTextResolverError.new(
            "source-unavailable",
            `The source exceeds the ${MAX_SOURCE_BYTES}-byte resolution limit.`
          );
        }

        const bytes = yield* fs
          .readFile(resolvedPath)
          .pipe(Effect.mapError(resolverError("source-unavailable", "The source file could not be read.")));
        if (bytes.byteLength > MAX_SOURCE_BYTES) {
          return yield* SourceTextResolverError.new(
            "source-unavailable",
            `The source exceeds the ${MAX_SOURCE_BYTES}-byte resolution limit.`
          );
        }
        const sourceDigest = yield* digestBytes(bytes).pipe(Effect.provide(crypto));
        yield* verifyDigest(
          sourceDigest,
          request.identity.sourceDigest,
          "source-digest-mismatch",
          "The source bytes no longer match the pinned source digest."
        );

        const cached = yield* Cache.getOption(canonicalTextCache, request.identity);
        const source = yield* O.match(cached, {
          onNone: Effect.fn("source_text.resolve.cache_miss")(function* () {
            const extension = Str.toLowerCase(Str.slice(1)(path.extname(resolvedPath)));
            const format = classifyFormatFromExtension(extension);
            const text = yield* Match.value(format).pipe(
              Match.whenOr("plain-text", "markdown", () => decodeUtf8(bytes, request.identity.extractor)),
              Match.when("pdf-text-layer", () =>
                extractDocumentText(request, resolvedPath, extension, "pdf-text-layer", bytes, fileProcessing, path)
              ),
              Match.when("docx", () =>
                extractDocumentText(request, resolvedPath, extension, "docx", bytes, fileProcessing, path)
              ),
              Match.orElse(() =>
                Effect.fail(
                  SourceTextResolverError.new(
                    "extractor-unavailable",
                    `No canonical source-text extractor is available for extension "${extension}".`
                  )
                )
              )
            );
            const textDigest = yield* digestBytes(utf8Encoder.encode(text)).pipe(Effect.provide(crypto));
            yield* verifyDigest(
              textDigest,
              request.identity.textDigest,
              "text-digest-mismatch",
              "The canonical text no longer matches the pinned text digest."
            );
            const resolved = ResolvedSourceText.make({ identity: request.identity, text });
            yield* Cache.set(canonicalTextCache, request.identity, resolved);
            return resolved;
          }),
          onSome: Effect.succeed,
        });

        yield* Effect.annotateCurrentSpan("source_text.outcome", "resolved");
        return source;
      }).pipe(
        Effect.tapError((error) =>
          Effect.annotateCurrentSpan({
            "source_text.failure_reason": error.reason,
            "source_text.outcome": "failed",
          })
        )
      )
    ),
  });
});

/**
 * Workspace-vault source-text resolver layer.
 *
 * **Example** (Usage)
 * ```ts
 * import { WorkspaceSourceTextResolverLayer } from "@beep/workspace-server/SourceText"
 * import { SourceTextResolver } from "@beep/file-processing/SourceText"
 * import { Effect } from "effect"
 *
 * const resolverProgram = SourceTextResolver.pipe(
 *   Effect.provide(WorkspaceSourceTextResolverLayer)
 * )
 * console.log(Effect.isEffect(resolverProgram)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WorkspaceSourceTextResolverLayer = Layer.effect(SourceTextResolver, makeWorkspaceSourceTextResolver());
