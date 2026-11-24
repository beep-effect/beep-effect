import { IRI } from "@beep/identity/Iri";
import { BroaderCycle, ConceptAlignment, ConceptSchemePin } from "@beep/ontology/ConceptScheme";
import {
  ConceptSchemeNotLoaded,
  ConceptSchemeVersionMismatch,
  DuplicateConceptScheme,
  decodeLoadManifestEntry,
  TaxonomyLoader,
  TaxonomyManifestParseError,
  TaxonomyManifestReadError,
  VendorAlignmentTargetNotFound,
  VendorLoadKind,
  VendorSliceConceptMismatch,
  VendorSliceDigestMismatch,
  VendorSliceParseError,
  VendorSlicePathEscape,
  VendorSliceReadError,
  VendorSliceUnvetted,
} from "@beep/ontology/TaxonomyLoader";
import { it } from "@beep/test-runner";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  approval,
  encodeJson,
  fixtureRoot,
  schemeRow,
  sha256Of,
  writeManifest,
  zeros,
} from "./support/PackManifest.ts";

const manifestPath = `${fixtureRoot}/vendor-manifest.jsonl`;
const base = "https://beep-effect.com/ns/ontology/semantic-foundation/fixture";
const intakeIri = IRI.make(`${base}/intake`);
const emailMessageIri = IRI.make(`${base}/intake/email-message`);
const vendorIri = IRI.make("https://vendor.example.test/scheme");
const folioConcept = "https://folio.openlegalstandard.org/RDQy4rbUg82ScgiiXEQ7ZBU";
const folioSource = `${folioConcept}/jsonld`;

const alignmentRow = (overrides: Record<string, unknown>): Record<string, unknown> => ({
  id: "fixture-folio-email",
  format: "jsonld",
  loadKind: "concept-alignment",
  loadStatus: "VETTED",
  verified: true,
  path: "fixture-slice.jsonld",
  sha256: "ad0e344b66177bc77a588e8ab3686eef3fab83ff27690ad3f5982ec554a8e1d3",
  namespaceIri: "https://folio.openlegalstandard.org/",
  conceptIri: folioConcept,
  fetchUrl: folioSource,
  localConceptIri: emailMessageIri,
  mappingPredicate: "skos:closeMatch",
  ...overrides,
});

const intakeRow = Effect.fnUntraced(function* () {
  const sha256 = yield* sha256Of(`${fixtureRoot}/concept-scheme/repo-intake.json`);
  return schemeRow({
    id: "fixture-intake",
    path: "concept-scheme/repo-intake.json",
    origin: "repo-owned",
    sha256: sha256,
  });
});

const loadRows = Effect.fnUntraced(function* (rows: ReadonlyArray<Record<string, unknown>>) {
  const loader = yield* TaxonomyLoader;
  const manifest = yield* writeManifest(rows);
  return yield* loader.load(manifest, fixtureRoot);
});

const loadText = Effect.fnUntraced(function* (content: string) {
  const loader = yield* TaxonomyLoader;
  return yield* loader
    .load(manifestPath, fixtureRoot)
    .pipe(
      Effect.provideService(
        FileSystem.FileSystem,
        FileSystem.makeNoop({ readFileString: () => Effect.succeed(content), realPath: Effect.succeed })
      )
    );
});

const vendorFile = Effect.fnUntraced(function* (root: string, path: string, bytes: Uint8Array) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFile(`${root}/${path}`, bytes);
  return yield* sha256Of(`${root}/${path}`);
});

const loadIn = Effect.fnUntraced(function* (root: string, rows: ReadonlyArray<Record<string, unknown>>) {
  const fs = yield* FileSystem.FileSystem;
  const loader = yield* TaxonomyLoader;
  const lines = yield* Effect.forEach(rows, (row) => encodeJson(row), {
    concurrency: 1,
  });
  yield* fs.writeFileString(`${root}/manifest.jsonl`, A.join(lines, "\n"));
  return yield* loader.load(`${root}/manifest.jsonl`, root);
});

const encoder = new TextEncoder();

it.layer(Layer.mergeAll(TaxonomyLoader.layer, BunFileSystem.layer, Digest.layerWebCrypto), {
  timeout: "30 seconds",
})("taxonomy loader", (it) => {
  it.effect(
    "loads the committed pack with its applied alignment, vendor exception and payload bytes",
    Effect.fnUntraced(function* () {
      const loader = yield* TaxonomyLoader;
      const fs = yield* FileSystem.FileSystem;
      const pack = yield* loader.load(manifestPath, fixtureRoot);
      const intake = yield* pack.schemeFor(ConceptSchemePin.make({ scheme: intakeIri, version: "1" }));
      const alignment = ConceptAlignment.make({
        predicate: "skos:closeMatch",
        target: IRI.make(folioConcept),
        source: IRI.makeOption(folioSource),
      });
      const email = A.findFirst(A.fromIterable(intake.concepts), (concept) => concept.iri === emailMessageIri);
      const payload = yield* fs.readFile(`${fixtureRoot}/concept-scheme/intake-payload.json`);

      expect(HashMap.size(pack.schemes)).toBe(2);
      expect(O.exists(email, (concept) => Equal.equals(concept.alignments, HashSet.make(alignment)))).toBe(true);
      expect(A.map(pack.alignments, (applied) => [applied.id, applied.scheme, applied.concept])).toEqual([
        ["fixture-folio-email", intakeIri, emailMessageIri],
      ]);
      expect(A.map(pack.exceptions, (violation) => violation._tag)).toEqual(["BroaderCycle"]);
      expect(O.exists(A.head(pack.exceptions), (violation) => violation.scheme === vendorIri)).toBe(true);
      assertSome(O.map(HashMap.get(pack.payloads, "fixture-intake-payload"), A.fromIterable), A.fromIterable(payload));
      expect(S.is(BroaderCycle)(pack.exceptions[0])).toBe(true);
    })
  );

  it.effect(
    "refuses a pin in another version and a pin for an unloaded scheme",
    Effect.fnUntraced(function* () {
      const loader = yield* TaxonomyLoader;
      const pack = yield* loader.load(manifestPath, fixtureRoot);
      const mismatch = yield* pack
        .schemeFor(ConceptSchemePin.make({ scheme: intakeIri, version: "2" }))
        .pipe(Effect.flip);
      const missing = yield* pack
        .schemeFor(ConceptSchemePin.make({ scheme: IRI.make(`${base}/absent`), version: "1" }))
        .pipe(Effect.flip);
      expect(S.is(ConceptSchemeVersionMismatch)(mismatch)).toBe(true);
      expect(mismatch).toMatchObject({ pinned: "2", loaded: "1" });
      expect(S.is(ConceptSchemeNotLoaded)(missing)).toBe(true);
    })
  );

  it.effect(
    "routes classification and reference rows away from the loader and rejects unknown kinds",
    Effect.fnUntraced(function* () {
      const skipped = yield* decodeLoadManifestEntry(
        "manifest.jsonl",
        '{"id":"ipc","format":"xml","loadKind":"classification-scheme"}',
        0
      );
      const unknown = yield* loadText('{"id":"unknown","format":"xml","loadKind":"unknown"}').pipe(Effect.flip);
      assertNone(skipped);
      expect(VendorLoadKind.literals).toEqual([
        "concept-scheme",
        "concept-alignment",
        "payload",
        "classification-scheme",
      ]);
      expect(S.is(TaxonomyManifestParseError)(unknown)).toBe(true);
    })
  );

  it.effect(
    "fails closed for a missing or unparsable manifest",
    Effect.fnUntraced(function* () {
      const loader = yield* TaxonomyLoader;
      const missing = yield* loader
        .load(manifestPath, fixtureRoot)
        .pipe(Effect.provideService(FileSystem.FileSystem, FileSystem.makeNoop({})), Effect.flip);
      const unparsable = yield* loadText("not-json").pipe(Effect.flip);
      expect(S.is(TaxonomyManifestReadError)(missing)).toBe(true);
      expect(S.is(TaxonomyManifestParseError)(unparsable)).toBe(true);
    })
  );

  it.effect(
    "rejects rows that escape the vendor root, lack approval or leave their authority",
    Effect.fnUntraced(function* () {
      const manifests = [
        schemeRow({ id: "escape", path: "../secrets.json", origin: "repo-owned", sha256: zeros }),
        {
          ...schemeRow({
            id: "no-licence",
            path: "concept-scheme/repo-intake.json",
            origin: "repo-owned",
            sha256: zeros,
          }),
          license: "",
        },
        alignmentRow({ loadStatus: undefined }),
        alignmentRow({ verified: false }),
        alignmentRow({ conceptIri: "https://example.com/email" }),
        alignmentRow({ fetchUrl: "https://example.com/email.jsonld" }),
        alignmentRow({ localConceptIri: "https://example.com/email" }),
        alignmentRow({ mappingPredicate: "closeMatch" }),
        alignmentRow({ sha256: "not-a-digest" }),
      ];
      const errors = yield* Effect.forEach(
        manifests,
        Effect.fnUntraced(function* (row) {
          const line = yield* encodeJson(row);
          return yield* loadText(line).pipe(Effect.flip);
        }),
        { concurrency: 1 }
      );
      expect(A.every(errors, S.is(TaxonomyManifestParseError))).toBe(true);
    })
  );

  it.effect(
    "refuses an unvetted row and a row whose bytes differ from its digest",
    Effect.fnUntraced(function* () {
      const row = yield* intakeRow();
      const unvetted = yield* loadRows([{ ...row, loadStatus: "UNVETTED" }]).pipe(Effect.flip);
      const tampered = yield* loadRows([{ ...row, sha256: zeros }]).pipe(Effect.flip);
      expect(S.is(VendorSliceUnvetted)(unvetted)).toBe(true);
      expect(S.is(VendorSliceDigestMismatch)(tampered)).toBe(true);
      expect(tampered).toMatchObject({ id: "fixture-intake", expected: zeros, actual: row.sha256 });
    })
  );

  it.effect(
    "refuses two rows loading one scheme IRI",
    Effect.fnUntraced(function* () {
      const row = yield* intakeRow();
      const error = yield* loadRows([row, { ...row, id: "fixture-intake-again" }]).pipe(Effect.flip);
      expect(S.is(DuplicateConceptScheme)(error)).toBe(true);
    })
  );

  it.effect(
    "resolves an alignment only against the schemes of its own manifest",
    Effect.fnUntraced(function* () {
      const error = yield* loadRows([alignmentRow({})]).pipe(Effect.flip);
      expect(S.is(VendorAlignmentTargetNotFound)(error)).toBe(true);
    })
  );

  it.effect(
    "fails closed for an unreadable file, a missing vendor root and a missing slice",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const loader = yield* TaxonomyLoader;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-taxonomy-vendor-" });
      const missingRoot = `${root}/missing-vendor`;
      const manifest = yield* writeManifest([
        schemeRow({ id: "missing-slice", path: "missing.json", origin: "repo-owned", sha256: zeros }),
      ]);
      const noRoot = yield* loader.load(manifest, missingRoot).pipe(Effect.flip);
      const noSlice = yield* loader.load(manifest, root).pipe(Effect.flip);
      yield* fs.makeDirectory(`${root}/directory.json`);
      const directory = yield* loadIn(root, [
        schemeRow({ id: "directory", path: "directory.json", origin: "repo-owned", sha256: zeros }),
      ]).pipe(Effect.flip);
      expect(noRoot).toMatchObject({ _tag: "VendorSliceReadError", id: "missing-slice", path: missingRoot });
      expect(noSlice).toMatchObject({ _tag: "VendorSliceReadError", id: "missing-slice" });
      expect(Str.endsWith("/missing.json")(S.is(VendorSliceReadError)(noSlice) ? noSlice.path : "")).toBe(true);
      expect(S.is(VendorSliceReadError)(directory)).toBe(true);
    })
  );

  it.effect(
    "fails closed for an ill-formed scheme, non-UTF-8 bytes, an unparsable slice and a mismatched slice",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const intake = yield* intakeRow();
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-taxonomy-vendor-" });
      const schemeText = yield* fs.readFileString(`${fixtureRoot}/concept-scheme/repo-intake.json`);
      yield* fs.makeDirectory(`${root}/concept-scheme`);
      yield* fs.writeFileString(`${root}/concept-scheme/repo-intake.json`, schemeText);
      const notScheme = yield* vendorFile(root, "not-scheme.json", encoder.encode('{"iri":1}'));
      const notUtf8 = yield* vendorFile(root, "not-utf8.json", new Uint8Array([0xff, 0xfe]));
      const notSlice = yield* vendorFile(root, "not-slice.jsonld", encoder.encode('{"@id":'));
      const otherSlice = yield* vendorFile(
        root,
        "other-slice.jsonld",
        encoder.encode(
          '{"@id":"https://folio.openlegalstandard.org/not-email","@type":"owl:Class","rdfs:label":"Other","skos:definition":"A different concept."}'
        )
      );
      const parseErrors = yield* Effect.forEach(
        [
          [schemeRow({ id: "not-scheme", path: "not-scheme.json", origin: "repo-owned", sha256: notScheme })],
          [schemeRow({ id: "not-utf8", path: "not-utf8.json", origin: "repo-owned", sha256: notUtf8 })],
          [intake, alignmentRow({ path: "not-slice.jsonld", sha256: notSlice })],
        ],
        (rows) => loadIn(root, rows).pipe(Effect.flip),
        { concurrency: 1 }
      );
      const mismatch = yield* loadIn(root, [
        intake,
        alignmentRow({ path: "other-slice.jsonld", sha256: otherSlice }),
      ]).pipe(Effect.flip);
      expect(A.every(parseErrors, S.is(VendorSliceParseError))).toBe(true);
      expect(S.is(VendorSliceConceptMismatch)(mismatch)).toBe(true);
    })
  );

  it.effect(
    "rejects a vetted slice symlink that resolves outside the vendor root",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-taxonomy-vendor-" });
      const outside = yield* fs.makeTempDirectoryScoped({ prefix: "beep-taxonomy-outside-" });
      yield* fs.writeFileString(`${outside}/outside.json`, "{}");
      yield* fs.symlink(`${outside}/outside.json`, `${root}/linked.json`);
      const error = yield* loadIn(root, [
        schemeRow({ id: "linked", path: "linked.json", origin: "vendor", sha256: zeros }),
      ]).pipe(Effect.flip);
      expect(S.is(VendorSlicePathEscape)(error)).toBe(true);
    })
  );

  it.effect(
    "accepts a canonical Windows vendor root with a trailing separator",
    Effect.fnUntraced(function* () {
      const loader = yield* TaxonomyLoader;
      const digest = yield* Digest.Digest;
      const canonicalRoot = "C:\\vendor\\";
      const payload = encoder.encode("{}");
      const sha256 = yield* digest.digestHex(Digest.sha256, payload);
      const line = yield* encodeJson({
        id: "windows-payload",
        format: "json",
        loadKind: "payload",
        mediaType: "application/json",
        path: "payload.json",
        sha256,
        verified: true,
        loadStatus: "VETTED",
        ...approval,
      });
      const pack = yield* loader.load(manifestPath, fixtureRoot).pipe(
        Effect.provideService(
          FileSystem.FileSystem,
          FileSystem.makeNoop({
            readFileString: () => Effect.succeed(line),
            readFile: () => Effect.succeed(payload),
            realPath: (path) => Effect.succeed(path === fixtureRoot ? canonicalRoot : `${canonicalRoot}payload.json`),
          })
        )
      );
      expect(HashMap.has(pack.payloads, "windows-payload")).toBe(true);
    })
  );
});
