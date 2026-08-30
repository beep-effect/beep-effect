import { DOC_TEXT_ENGINE_VERSION, DocTextFileProcessingEngine } from "@beep/doc-text";
import { makeFileProcessingServiceLayer } from "@beep/file-processing/Service";
import {
  ResolveSourceTextRequest,
  SourceTextResolver,
  UTF8_SOURCE_TEXT_EXTRACTOR_NAME,
  UTF8_SOURCE_TEXT_EXTRACTOR_VERSION,
} from "@beep/file-processing/SourceText";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import {
  VerifiedSourceText,
  VerifySourceTextIdentityInput,
  verifySourceTextIdentity,
} from "@beep/provenance/VerifiedTextAnchor";
import { Sha256HexFromBytes } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { WorkspaceVaultStoreInMemoryLayer } from "@beep/workspace-server/aggregates/Workspace";
import { WorkspaceSourceTextResolverLayer } from "@beep/workspace-server/SourceText";
import { Workspace } from "@beep/workspace-use-cases/server";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { assert, describe, expect, it } from "@effect/vitest";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { Effect, FileSystem, Layer, Path, Ref, Result } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tracer from "effect/Tracer";
import { FastCheck as fc } from "effect/testing";
import type { ExtractFileOperation } from "@beep/file-processing/Operation";

const PlatformLayer = Layer.mergeAll(BunCrypto.layer, BunFileSystem.layer, BunPath.layer);
const WorkspaceVaultLayer = WorkspaceVaultStoreInMemoryLayer.pipe(
  Layer.provideMerge(BunFileSystem.layer),
  Layer.provideMerge(BunPath.layer)
);
const FileProcessingLayer = makeFileProcessingServiceLayer([DocTextFileProcessingEngine]).pipe(
  Layer.provideMerge(BunCrypto.layer)
);
const ResolverTestLayer = WorkspaceSourceTextResolverLayer.pipe(
  Layer.provideMerge(Layer.mergeAll(PlatformLayer, WorkspaceVaultLayer, FileProcessingLayer))
);
const decodeSha256HexFromBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const decodeSourceTextDigest = S.decodeUnknownEffect(SourceTextDigest);
const makeDocx = (text: string): Promise<Buffer> =>
  Packer.toBuffer(
    new Document({
      sections: [
        {
          children: [new Paragraph({ children: [new TextRun(text)] })],
        },
      ],
    })
  );

const digestBytes = Effect.fn("WorkspaceSourceTextResolverTest.digestBytes")(function* (bytes: Uint8Array) {
  const hex = yield* decodeSha256HexFromBytes(bytes);
  return yield* decodeSourceTextDigest(`sha256:${hex}`);
});

const configureVault = Effect.fn("WorkspaceSourceTextResolverTest.configureVault")(function* (vaultRootPath: string) {
  const store = yield* Workspace.WorkspaceVaultStore;
  const workspaceId = yield* S.decodeEffect(WorkspaceIdentity.WorkspaceId)(1);
  const input = yield* S.decodeEffect(Workspace.SetWorkspaceVaultInput)({
    vaultRootPath,
    workspaceId,
  });
  yield* store.setVaultRoot(input);
});

const identityFor = (options: {
  readonly locator: string;
  readonly normalizationVersion?: string;
  readonly sourceDigest: SourceTextDigest;
  readonly textDigest: SourceTextDigest;
  readonly extractorName?: string;
  readonly extractorVersion?: string;
}): SourceTextIdentity =>
  SourceTextIdentity.make({
    extractor: SourceTextExtractor.make({
      name: options.extractorName ?? UTF8_SOURCE_TEXT_EXTRACTOR_NAME,
      version: options.extractorVersion ?? UTF8_SOURCE_TEXT_EXTRACTOR_VERSION,
    }),
    locator: PosixPath.make(options.locator),
    normalizationVersion: options.normalizationVersion ?? "1",
    scopeRef: "workspace:1",
    sourceDigest: options.sourceDigest,
    sourceRef: `source:${options.locator}`,
    textDigest: options.textDigest,
  });

const resolve = Effect.fn("WorkspaceSourceTextResolverTest.resolve")(function* (identity: SourceTextIdentity) {
  const resolver = yield* SourceTextResolver;
  return yield* resolver.resolve(ResolveSourceTextRequest.make({ identity }));
});

const makeRecordingTracer = (): {
  readonly captured: Array<Tracer.NativeSpan>;
  readonly tracer: Tracer.Tracer;
} => {
  const captured: Array<Tracer.NativeSpan> = [];
  const tracer = Tracer.make({
    span: (options) => {
      const span = new Tracer.NativeSpan(options);
      captured.push(span);
      return span;
    },
  });
  return { captured, tracer };
};

const expectSourceTextResolveSpan = (
  captured: ReadonlyArray<Tracer.NativeSpan>,
  options: {
    readonly expectedFailureReason: O.Option<string>;
    readonly expectedOutcome: "failed" | "resolved";
    readonly forbiddenValues: ReadonlyArray<string>;
  }
): void => {
  const adapterSpans = A.filter(captured, (span) => Eq.equals(span.name, "source_text.resolve"));
  expect(adapterSpans).toHaveLength(1);

  const [span] = adapterSpans;
  assert.isDefined(span);
  expect(span.attributes.get("source_text.operation")).toBe("resolve");
  expect(span.attributes.get("source_text.storage")).toBe("workspace_vault");
  expect(span.attributes.get("source_text.outcome")).toBe(options.expectedOutcome);

  O.match(options.expectedFailureReason, {
    onNone: () => {
      expect(span.attributes.has("source_text.failure_reason")).toBe(false);
      expect(span.attributes.size).toBe(3);
    },
    onSome: (failureReason) => {
      expect(span.attributes.get("source_text.failure_reason")).toBe(failureReason);
      expect(span.attributes.size).toBe(4);
    },
  });

  const stringAttributeValues = A.filter(A.fromIterable(span.attributes.values()), P.isString);
  A.forEach(options.forbiddenValues, (forbiddenValue) => {
    expect(A.some(stringAttributeValues, Str.includes(forbiddenValue))).toBe(false);
  });
};

describe("@beep/workspace-server WorkspaceSourceTextResolver", () => {
  it("round-trips schema-derived source identities through their wire shape", () =>
    fc.assert(
      fc.property(S.toArbitrary(SourceTextIdentity)(fc), (identity) => {
        const encoded = Result.getOrThrow(S.encodeUnknownResult(SourceTextIdentity)(identity));
        const decoded = Result.getOrThrow(S.decodeResult(SourceTextIdentity)(encoded));

        expect(S.toEquivalence(SourceTextIdentity)(decoded, identity)).toBe(true);
      }),
      fcRuns(25)
    ));

  it.effect(
    "resolves complete UTF-8 text after verifying source, extractor, and text digests",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-source-text-" });
      const sourceText = "A complete source with 😀 evidence for pii-success@example.test.";
      const locator = "evidence.md";
      const bytes = new TextEncoder().encode(sourceText);
      const digest = yield* digestBytes(bytes);
      yield* fs.writeFile(path.join(root, locator), bytes);
      yield* configureVault(root);

      const { captured, tracer } = makeRecordingTracer();
      const source = yield* resolve(
        identityFor({
          locator,
          sourceDigest: digest,
          textDigest: digest,
        })
      ).pipe(Effect.withTracer(tracer));
      const verifiedSource = yield* verifySourceTextIdentity(
        VerifySourceTextIdentityInput.make({
          expectedSource: source.identity,
          source: source.identity,
          sourceText: source.text,
        })
      );

      expect(source.text).toBe(sourceText);
      expect(source.identity.sourceDigest).toBe(digest);
      expect(S.is(VerifiedSourceText)(verifiedSource)).toBe(true);
      expect(verifiedSource.sourceText).toBe(sourceText);
      expect(verifiedSource.source).toEqual(source.identity);
      expectSourceTextResolveSpan(captured, {
        expectedFailureReason: O.none(),
        expectedOutcome: "resolved",
        forbiddenValues: [locator, `source:${locator}`, sourceText, "pii-success@example.test"],
      });
    }, provideScopedLayer(ResolverTestLayer))
  );

  it.effect(
    "rejects absolute, traversal, and symlink locators outside the configured vault",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-source-text-root-" });
      const outside = yield* fs.makeTempDirectoryScoped({ prefix: "beep-source-text-outside-" });
      const bytes = new TextEncoder().encode("outside");
      const digest = yield* digestBytes(bytes);
      const outsideFile = path.join(outside, "outside.txt");
      yield* fs.writeFile(outsideFile, bytes);
      yield* fs.symlink(outsideFile, path.join(root, "linked.txt"));
      yield* configureVault(root);

      const error = yield* resolve(
        identityFor({
          locator: "linked.txt",
          sourceDigest: digest,
          textDigest: digest,
        })
      ).pipe(Effect.flip);
      const absoluteError = yield* resolve(
        identityFor({
          locator: outsideFile,
          sourceDigest: digest,
          textDigest: digest,
        })
      ).pipe(Effect.flip);
      const traversalError = yield* resolve(
        identityFor({
          locator: `../${path.basename(outside)}/outside.txt`,
          sourceDigest: digest,
          textDigest: digest,
        })
      ).pipe(Effect.flip);

      expect(error.reason).toBe("locator-invalid");
      expect(absoluteError.reason).toBe("locator-invalid");
      expect(traversalError.reason).toBe("locator-invalid");
    }, provideScopedLayer(ResolverTestLayer))
  );

  it.effect(
    "rejects source files larger than the resolver memory budget before extraction",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-source-text-limit-" });
      const locator = "oversized.txt";
      const bytes = new Uint8Array(32 * 1024 * 1024 + 1);
      const placeholderDigest = yield* digestBytes(new Uint8Array());
      yield* fs.writeFile(path.join(root, locator), bytes);
      yield* configureVault(root);

      const error = yield* resolve(
        identityFor({
          locator,
          sourceDigest: placeholderDigest,
          textDigest: placeholderDigest,
        })
      ).pipe(Effect.flip);

      expect(error.reason).toBe("source-unavailable");
      expect(error.message).toContain("33554432-byte resolution limit");
    }, provideScopedLayer(ResolverTestLayer))
  );

  it.effect(
    "rejects unsupported locator-normalization versions before interpreting the locator",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-source-text-" });
      const bytes = new TextEncoder().encode("unreachable");
      const digest = yield* digestBytes(bytes);
      yield* configureVault(root);

      const error = yield* resolve(
        identityFor({
          locator: root,
          normalizationVersion: "2",
          sourceDigest: digest,
          textDigest: digest,
        })
      ).pipe(Effect.flip);

      expect(error.reason).toBe("extractor-unavailable");
      expect(error.message).toBe("The pinned locator-normalization contract is unavailable.");
    }, provideScopedLayer(ResolverTestLayer))
  );

  it.effect(
    "extracts complete DOCX text through the file-processing driver and verifies its version",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-source-text-" });
      const bytes = yield* Effect.promise(() => makeDocx("DOCX canonical source"));
      const sourceDigest = yield* digestBytes(bytes);
      const canonicalText = "DOCX canonical source\n\n";
      const textDigest = yield* digestBytes(new TextEncoder().encode(canonicalText));
      yield* fs.writeFile(path.join(root, "source.docx"), bytes);
      yield* configureVault(root);

      const source = yield* resolve(
        identityFor({
          extractorName: DocTextFileProcessingEngine.descriptor.name,
          extractorVersion: DOC_TEXT_ENGINE_VERSION,
          locator: "source.docx",
          sourceDigest,
          textDigest,
        })
      );

      expect(source.text).toBe(canonicalText);
      expect(source.identity.extractor.version).toBe(DOC_TEXT_ENGINE_VERSION);
    }, provideScopedLayer(ResolverTestLayer))
  );

  it.effect(
    "reuses canonical document text while rechecking pinned source bytes",
    Effect.fnUntraced(function* () {
      const extractionCount = yield* Ref.make(0);
      const countingDocTextEngine = {
        ...DocTextFileProcessingEngine,
        extract: Effect.fnUntraced(function* (operation: ExtractFileOperation) {
          yield* Ref.update(extractionCount, N.increment);
          return yield* DocTextFileProcessingEngine.extract(operation);
        }),
      };
      const countingFileProcessingLayer = makeFileProcessingServiceLayer([countingDocTextEngine]).pipe(
        Layer.provideMerge(BunCrypto.layer)
      );
      const countingResolverTestLayer = WorkspaceSourceTextResolverLayer.pipe(
        Layer.provideMerge(Layer.mergeAll(PlatformLayer, WorkspaceVaultLayer, countingFileProcessingLayer))
      );

      yield* Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-source-text-cache-" });
        const locator = "source.docx";
        const sourcePath = path.join(root, locator);
        const bytes = yield* Effect.promise(() => makeDocx("Cached canonical source"));
        const sourceDigest = yield* digestBytes(bytes);
        const canonicalText = "Cached canonical source\n\n";
        const textDigest = yield* digestBytes(new TextEncoder().encode(canonicalText));
        const identityInput = {
          extractorName: DocTextFileProcessingEngine.descriptor.name,
          extractorVersion: DOC_TEXT_ENGINE_VERSION,
          locator,
          sourceDigest,
          textDigest,
        };
        const identity = identityFor(identityInput);
        yield* fs.writeFile(sourcePath, bytes);
        yield* configureVault(root);

        const first = yield* resolve(identity);
        const second = yield* resolve(identityFor(identityInput));
        expect(first.text).toBe(canonicalText);
        expect(second.text).toBe(canonicalText);
        expect(yield* Ref.get(extractionCount)).toBe(1);

        yield* fs.writeFile(sourcePath, yield* Effect.promise(() => makeDocx("Drifted source")));
        const drift = yield* resolve(identity).pipe(Effect.flip);
        expect(drift.reason).toBe("source-digest-mismatch");
        expect(yield* Ref.get(extractionCount)).toBe(1);
      }).pipe(provideScopedLayer(countingResolverTestLayer));
    })
  );

  it.effect(
    "fails closed when source bytes drift from the pinned digest",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-source-text-" });
      const locator = "source.txt";
      const currentSourceText = "current pii-failure@example.test";
      const currentBytes = new TextEncoder().encode(currentSourceText);
      const staleDigest = yield* digestBytes(new TextEncoder().encode("stale"));
      yield* fs.writeFile(path.join(root, locator), currentBytes);
      yield* configureVault(root);

      const { captured, tracer } = makeRecordingTracer();
      const error = yield* resolve(
        identityFor({
          locator,
          sourceDigest: staleDigest,
          textDigest: staleDigest,
        })
      ).pipe(Effect.flip, Effect.withTracer(tracer));

      expect(error.reason).toBe("source-digest-mismatch");
      expectSourceTextResolveSpan(captured, {
        expectedFailureReason: O.some("source-digest-mismatch"),
        expectedOutcome: "failed",
        forbiddenValues: [locator, `source:${locator}`, currentSourceText, "pii-failure@example.test"],
      });
    }, provideScopedLayer(ResolverTestLayer))
  );

  it.effect(
    "fails closed when the pinned extractor or canonical text digest drifts",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-source-text-" });
      const bytes = new TextEncoder().encode("current");
      const digest = yield* digestBytes(bytes);
      const staleTextDigest = yield* digestBytes(new TextEncoder().encode("stale"));
      yield* fs.writeFile(path.join(root, "source.txt"), bytes);
      yield* configureVault(root);

      const extractorError = yield* resolve(
        identityFor({
          extractorVersion: "2",
          locator: "source.txt",
          sourceDigest: digest,
          textDigest: digest,
        })
      ).pipe(Effect.flip);
      const textDigestError = yield* resolve(
        identityFor({
          locator: "source.txt",
          sourceDigest: digest,
          textDigest: staleTextDigest,
        })
      ).pipe(Effect.flip);

      expect(extractorError.reason).toBe("extractor-unavailable");
      expect(textDigestError.reason).toBe("text-digest-mismatch");
    }, provideScopedLayer(ResolverTestLayer))
  );
});
