/**
 * Portable, fail-closed loading and hierarchy lookup for pinned classifications.
 * @packageDocumentation
 * @since 0.0.0
 */

import { IRIReference } from "@beep/identity/Iri";
import { $OntologyId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema/Sha256";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  ClassificationError,
  ClassificationPin,
  ClassificationSchemeKind,
  ClassificationSnapshot,
  classificationConceptIri,
  classificationSchemeIri,
} from "./Classification.models.ts";
import { parseCpc, parseIpc, parseNice } from "./internal/ClassificationXml.ts";
import { sha256Hex, treeDigest } from "./internal/ContentDigest.ts";
import {
  decodeUtf8,
  decodeVendorManifestRow,
  readVendorBytes,
  resolveVendorPath,
  VendorDigestUnit,
  VendorLoadStatus,
  VendorSlicePath,
  vendorDigestUnit,
  verifyRowDigest,
} from "./TaxonomyLoader.ts";
import type * as Digest from "effect/crypto/Digest";
import type { ClassificationConcept } from "./Classification.models.ts";
import type { VendorContentDigestMissing, VendorSliceDigestMismatch } from "./TaxonomyLoader.ts";

const $I = $OntologyId.create("ClassificationRegistry");

class ClassificationAsset extends S.Opaque<ClassificationAsset, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.NonEmptyString,
    format: S.tag("xml"),
    loadKind: S.tag("classification-scheme"),
    schemeKind: ClassificationSchemeKind,
    edition: S.NonEmptyString,
    verified: S.Boolean,
    loadStatus: VendorLoadStatus,
    path: VendorSlicePath,
    entryPath: S.OptionFromOptionalKey(VendorSlicePath),
    archivePath: S.OptionFromOptionalKey(S.NonEmptyString),
    digestUnit: S.OptionFromOptionalKey(VendorDigestUnit),
    sha256: Sha256Hex,
    contentSha256: S.OptionFromOptionalKey(Sha256Hex),
  }).pipe($I.annoteSchema("ClassificationAsset"))
) {}

type ClassificationLoadError = ClassificationError | VendorContentDigestMissing | VendorSliceDigestMismatch;

/**
 * Edition-pinned classification loading and SKOS hierarchy lookup.
 * **Details**
 * Every lookup takes the caller's pin and a snapshot. An IPC request cannot
 * consume a CPC snapshot even when the notations happen to be identical.
 * Loading needs the portable FileSystem and Digest services, checks every
 * row's bytes against its manifest digest, and admits no latest alias.
 * **Example** (Access the classification service)
 * ```ts
 * import { ClassificationRegistry } from "@beep/ontology/ClassificationRegistry"
 * console.log(ClassificationRegistry.key)
 * ```
 * @category services
 * @since 0.0.0
 */
export class ClassificationRegistry extends Context.Service<
  ClassificationRegistry,
  {
    readonly load: (
      manifestPath: string,
      vendorRoot: string,
      pin: typeof ClassificationPin.Encoded
    ) => Effect.Effect<ClassificationSnapshot, ClassificationLoadError, FileSystem.FileSystem | Digest.Digest>;
    readonly resolve: (
      snapshot: ClassificationSnapshot,
      pin: typeof ClassificationPin.Encoded,
      notation: string
    ) => Effect.Effect<ClassificationConcept, ClassificationError>;
    readonly broader: (
      snapshot: ClassificationSnapshot,
      pin: typeof ClassificationPin.Encoded,
      notation: string
    ) => Effect.Effect<readonly ClassificationConcept[], ClassificationError>;
    readonly narrower: (
      snapshot: ClassificationSnapshot,
      pin: typeof ClassificationPin.Encoded,
      notation: string
    ) => Effect.Effect<readonly ClassificationConcept[], ClassificationError>;
  }
>()($I`ClassificationRegistry`) {
  /**
   * Live implementation with no mutable global state.
   * **Example** (Provide the live registry)
   * ```ts
   * import { ClassificationRegistry } from "@beep/ontology/ClassificationRegistry"
   * console.log(ClassificationRegistry.layer)
   * ```
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = Layer.effect(
    this,
    Effect.sync(() => ({ load, resolve, broader, narrower }))
  );
}

const failure = (reason: ClassificationError["reason"], detail: string) => ClassificationError.make({ reason, detail });
const decodePin = flow(
  S.decodeEffect(ClassificationPin),
  Effect.mapError(() => failure("edition-unpinned", "An explicit scheme and edition are required"))
);
const conceptIndex = (snapshot: ClassificationSnapshot) =>
  HashMap.fromIterable(
    A.map(snapshot.concepts, (concept): readonly [string, ClassificationConcept] => [concept.iri, concept])
  );

const validateSnapshot = Effect.fn("ClassificationRegistry.validateSnapshot")(function* (
  snapshot: ClassificationSnapshot,
  pin: ClassificationPin
) {
  yield* Effect.filterOrFail(
    Effect.succeed(snapshot),
    (value) => value.kind === pin.kind,
    () => failure("scheme-mismatch", pin.kind)
  );
  yield* Effect.filterOrFail(
    Effect.succeed(snapshot),
    (value) => value.edition === pin.edition,
    () => failure("edition-unpinned", pin.edition)
  );
  yield* Effect.filterOrFail(
    Effect.succeed(snapshot),
    (value) => value.schemeIri === classificationSchemeIri(pin) && A.isReadonlyArrayNonEmpty(value.concepts),
    () => failure("hierarchy-invalid", "Scheme identity or concept set is invalid")
  );
  const index = conceptIndex(snapshot);
  yield* Effect.filterOrFail(
    Effect.succeed(index),
    (value) => HashMap.size(value) === A.length(snapshot.concepts),
    () => failure("hierarchy-invalid", "Duplicate concept identities")
  );
  yield* Effect.forEach(
    snapshot.concepts,
    Effect.fnUntraced(function* (concept) {
      yield* Effect.filterOrFail(
        Effect.succeed(concept),
        (value) =>
          value.kind === pin.kind &&
          value.edition === pin.edition &&
          value.schemeIri === snapshot.schemeIri &&
          value.iri === classificationConceptIri(pin, value.notation),
        () => failure("hierarchy-invalid", concept.notation)
      );
      yield* Effect.forEach(
        concept.broader,
        Effect.fnUntraced(function* (iri) {
          const parent = yield* Effect.fromOption(HashMap.get(index, iri), () =>
            failure("hierarchy-invalid", `Missing parent of ${concept.notation}`)
          );
          yield* Effect.filterOrFail(
            Effect.succeed(parent),
            (value) => value.depth < concept.depth,
            () => failure("hierarchy-invalid", `Reversed broader link at ${concept.notation}`)
          );
        }),
        { concurrency: 1 }
      );
    }),
    { concurrency: 1 }
  );
  return index;
});

const resolve = Effect.fn("ClassificationRegistry.resolve")(function* (
  snapshot: ClassificationSnapshot,
  requestedPin: typeof ClassificationPin.Encoded,
  notation: string
) {
  const pin = yield* decodePin(requestedPin);
  const index = yield* validateSnapshot(snapshot, pin);
  return yield* Effect.fromOption(HashMap.get(index, classificationConceptIri(pin, notation)), () =>
    failure("symbol-not-found", notation)
  );
});

const broader = Effect.fn("ClassificationRegistry.broader")(function* (
  snapshot: ClassificationSnapshot,
  requestedPin: typeof ClassificationPin.Encoded,
  notation: string
) {
  const pin = yield* decodePin(requestedPin);
  const index = yield* validateSnapshot(snapshot, pin);
  let current = yield* Effect.fromOption(HashMap.get(index, classificationConceptIri(pin, notation)), () =>
    failure("symbol-not-found", notation)
  );
  let parents: readonly ClassificationConcept[] = [];
  while (A.isReadonlyArrayNonEmpty(current.broader)) {
    current = yield* Effect.fromOption(HashMap.get(index, A.headNonEmpty(current.broader)), () =>
      failure("hierarchy-invalid", current.notation)
    );
    parents = A.append(parents, current);
  }
  return parents;
});

const narrower = Effect.fn("ClassificationRegistry.narrower")(function* (
  snapshot: ClassificationSnapshot,
  pin: typeof ClassificationPin.Encoded,
  notation: string
) {
  const concept = yield* resolve(snapshot, pin, notation);
  return A.filter(snapshot.concepts, (candidate) => A.contains(candidate.broader, concept.iri));
});

const decodeAssets = Effect.fnUntraced(function* (manifestPath: string, content: string) {
  const lines = A.filter(A.map(Str.split(content, "\n"), Str.trim), Str.isNonEmpty);
  const forEach1 = yield* Effect.forEach(
    lines,
    Effect.fnUntraced(function* (line, index) {
      const route = yield* decodeVendorManifestRow(manifestPath, line, index).pipe(
        Effect.mapError(() => failure("manifest-invalid", `Manifest row ${index + 1}`))
      );
      if (!O.contains(route.loadKind, "classification-scheme")) return O.none<ClassificationAsset>();
      const pipe6 = yield* S.decodeEffect(ClassificationAssetJson)(line).pipe(
        Effect.mapError(() => failure("manifest-invalid", `Classification row ${index + 1}`))
      );
      return O.some(pipe6);
    }),
    { concurrency: 1 }
  );
  return A.getSomes(forEach1);
});

const readFailure =
  (detail: string) =>
  (error: { readonly _tag: "VendorSlicePathEscape" | "VendorSliceReadError" }): ClassificationError =>
    failure(error._tag === "VendorSlicePathEscape" ? "path-escape" : "source-parse", detail);

const readBytes = (asset: ClassificationAsset, relativePath: string, vendorRoot: string) =>
  readVendorBytes(asset.id, relativePath, vendorRoot).pipe(Effect.mapError(readFailure(asset.id)));

const readText = (asset: ClassificationAsset, path: string, bytes: Uint8Array) =>
  decodeUtf8(asset.id, path, bytes).pipe(Effect.mapError(() => failure("source-parse", asset.id)));

const readAsset = Effect.fnUntraced(function* (asset: ClassificationAsset, vendorRoot: string) {
  const relativePath = O.match(asset.entryPath, {
    onNone: () => asset.path,
    onSome: (entry) => A.join([asset.path, entry], "/"),
  });
  const bytes = yield* readBytes(asset, relativePath, vendorRoot);
  const actual = yield* sha256Hex(bytes);
  yield* verifyRowDigest(asset, vendorDigestUnit(asset), actual);
  return yield* readText(asset, relativePath, bytes);
});

const readTree = Effect.fnUntraced(function* (asset: ClassificationAsset, vendorRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* resolveVendorPath(asset.id, asset.path, vendorRoot).pipe(
    Effect.mapError(readFailure(asset.id))
  );
  const listing = yield* fs.readDirectory(directory).pipe(Effect.mapError(() => failure("source-parse", asset.id)));
  const files = A.filter(listing, (file) => Str.startsWith("cpc-scheme-")(file) && Str.endsWith(".xml")(file));
  yield* Effect.filterOrFail(Effect.succeed(files), A.isReadonlyArrayNonEmpty, () =>
    failure("source-parse", "CPC scheme files missing")
  );
  const entries = yield* Effect.forEach(
    files,
    Effect.fnUntraced(function* (file) {
      const path = yield* S.decodeEffect(VendorSlicePath)(A.join([asset.path, file], "/")).pipe(
        Effect.mapError(() => failure("path-escape", file))
      );
      const bytes = yield* readBytes(asset, path, vendorRoot);
      const hex = yield* sha256Hex(bytes);
      return { file, path, bytes, hex };
    }),
    { concurrency: 1 }
  );
  const actual = yield* treeDigest(A.map(entries, ({ file, hex }) => [file, hex] as const));
  yield* verifyRowDigest(asset, "tree", actual);
  return yield* Effect.forEach(entries, ({ path, bytes }) => readText(asset, path, bytes), { concurrency: 1 });
});

const load = Effect.fn("ClassificationRegistry.load")(function* (
  manifestPath: string,
  vendorRoot: string,
  requestedPin: typeof ClassificationPin.Encoded
) {
  const pin = yield* decodePin(requestedPin);
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs
    .readFileString(manifestPath)
    .pipe(Effect.mapError(() => failure("manifest-invalid", manifestPath)));
  const decodedAssets = yield* decodeAssets(manifestPath, content);
  const assets = yield* Effect.filterOrFail(
    Effect.succeed(A.filter(decodedAssets, (asset) => asset.schemeKind === pin.kind && asset.edition === pin.edition)),
    A.isArrayNonEmpty<ClassificationAsset>,
    () => failure("edition-unpinned", `${pin.kind} ${pin.edition}`)
  );
  yield* Effect.forEach(
    assets,
    (asset) =>
      Effect.filterOrFail(
        Effect.succeed(asset),
        (row) => row.verified && VendorLoadStatus.is.VETTED(row.loadStatus),
        () => failure("unvetted", asset.id)
      ),
    { concurrency: 1 }
  );
  yield* Effect.forEach(
    assets,
    (asset) =>
      Effect.filterOrFail(
        Effect.succeed(asset),
        (row) => VendorDigestUnit.is.tree(vendorDigestUnit(row)) === (row.schemeKind === "cpc"),
        () => failure("manifest-invalid", `${asset.id} digest unit`)
      ),
    { concurrency: 1 }
  );
  const concepts = yield* ClassificationSchemeKind.match(pin.kind, {
    ipc: Effect.fnUntraced(function* () {
      const asset = A.headNonEmpty(assets);
      const readAsset2 = yield* readAsset(asset, vendorRoot);
      return yield* parseIpc(readAsset2, pin);
    }),
    cpc: Effect.fnUntraced(function* () {
      const texts = yield* readTree(A.headNonEmpty(assets), vendorRoot);
      const parsed = yield* Effect.forEach(texts, (text) => parseCpc(text, pin), { concurrency: 1 });
      return A.flatten(parsed);
    }),
    nice: Effect.fnUntraced(function* () {
      const structure = yield* Effect.fromOption(
        A.findFirst(assets, (asset) => Str.includes("structure")(asset.id)),
        () => failure("manifest-invalid", "Nice structure archive missing")
      );
      const texts = yield* Effect.fromOption(
        A.findFirst(assets, (asset) => Str.includes("texts")(asset.id)),
        () => failure("manifest-invalid", "Nice texts archive missing")
      );
      const readAsset5 = yield* readAsset(structure, vendorRoot);
      const readAsset7 = yield* readAsset(texts, vendorRoot);
      return yield* parseNice(readAsset5, readAsset7, pin);
    }),
  });
  const broaderEquivalence = S.toEquivalence(S.Array(IRIReference));
  const index = yield* Effect.reduce(
    concepts,
    () => HashMap.empty<string, ClassificationConcept>(),
    Effect.fnUntraced(function* (index, concept) {
      yield* Effect.forEach(
        O.toArray(HashMap.get(index, concept.iri)),
        (previous) =>
          Effect.filterOrFail(
            Effect.succeed(previous),
            (value) => value.depth === concept.depth && broaderEquivalence(value.broader, concept.broader),
            () => failure("hierarchy-invalid", `Conflicting parents for ${concept.notation}`)
          ),
        { concurrency: 1 }
      );
      return HashMap.set(index, concept.iri, concept);
    })
  );
  const snapshot = ClassificationSnapshot.make({
    kind: pin.kind,
    edition: pin.edition,
    schemeIri: classificationSchemeIri(pin),
    concepts: index.pipe(HashMap.values, A.fromIterable),
  });
  yield* validateSnapshot(snapshot, pin);
  return snapshot;
});
const ClassificationAssetJson = S.fromJsonString(ClassificationAsset);
