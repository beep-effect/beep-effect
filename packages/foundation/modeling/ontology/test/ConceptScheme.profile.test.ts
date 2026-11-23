import { IRI } from "@beep/identity/Iri";
import { BroaderCycle, BroaderOutsideScheme, ConceptScheme, checkBroader } from "@beep/ontology/ConceptScheme";
import { RepoSchemeBroaderViolation, TaxonomyLoader } from "@beep/ontology/TaxonomyLoader";
import { it } from "@beep/test-runner";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
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
import { fixtureRoot, fixtureSchemeRow, writeManifest } from "./support/PackManifest.ts";

const base = "https://beep-effect.com/ns/ontology/semantic-foundation/fixture";
const vendorBase = "https://vendor.example.test/scheme";
const iri = (value: string) => IRI.make(value);
const decodeScheme = S.decodeUnknownEffect(S.fromJsonString(ConceptScheme));

const readScheme = Effect.fnUntraced(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(`${fixtureRoot}/${path}`);
  return yield* decodeScheme(text);
});

const loadOne = Effect.fnUntraced(function* (path: string, origin: "repo-owned" | "vendor") {
  const loader = yield* TaxonomyLoader;
  const row = yield* fixtureSchemeRow("profile", path, origin);
  const manifest = yield* writeManifest([row]);
  return yield* loader.load(manifest, fixtureRoot);
});

it.layer(Layer.mergeAll(TaxonomyLoader.layer, BunFileSystem.layer, Digest.layerWebCrypto), {
  timeout: "30 seconds",
})("L3-1 skos:broader is acyclic in repo-owned schemes and an imported cycle is recorded", (it) => {
  it.effect(
    "admits the acyclic repo-owned scheme with no exception",
    Effect.fnUntraced(function* () {
      const scheme = yield* readScheme("concept-scheme/repo-intake.json");
      expect(checkBroader(scheme)).toEqual([]);
      const pack = yield* loadOne("concept-scheme/repo-intake.json", "repo-owned");
      expect(pack.exceptions).toEqual([]);
      expect(O.exists(HashMap.get(pack.schemes, scheme.iri), Equal.equals(scheme))).toBe(true);
    })
  );

  it.effect(
    "refuses each planted repo-owned violation with RepoSchemeBroaderViolation",
    Effect.fnUntraced(function* () {
      const cases = [
        [
          "concept-scheme/repo-two-cycle.json",
          BroaderCycle.make({
            scheme: iri(`${base}/two-cycle`),
            members: HashSet.make(iri(`${base}/two-cycle/a`), iri(`${base}/two-cycle/b`)),
          }),
        ],
        [
          "concept-scheme/repo-self-loop.json",
          BroaderCycle.make({ scheme: iri(`${base}/self-loop`), members: HashSet.make(iri(`${base}/self-loop/a`)) }),
        ],
        [
          "concept-scheme/repo-outside.json",
          BroaderOutsideScheme.make({
            scheme: iri(`${base}/outside`),
            concept: iri(`${base}/outside/a`),
            target: iri(`${base}/elsewhere/z`),
          }),
        ],
      ] as const;
      yield* Effect.forEach(
        cases,
        Effect.fnUntraced(function* ([path, violation]) {
          const scheme = yield* readScheme(path);
          expect(Equal.equals(checkBroader(scheme), [violation])).toBe(true);
          const error = yield* loadOne(path, "repo-owned").pipe(Effect.flip);
          expect(S.is(RepoSchemeBroaderViolation)(error)).toBe(true);
          expect(S.is(RepoSchemeBroaderViolation)(error) && Equal.equals(error.violations, [violation])).toBe(true);
        }),
        { concurrency: 1 }
      );
    })
  );

  it.effect(
    "records a vendor scheme's three-cycle and admits the scheme unchanged",
    Effect.fnUntraced(function* () {
      const scheme = yield* readScheme("concept-scheme/vendor-three-cycle.json");
      const cycle = BroaderCycle.make({
        scheme: iri(vendorBase),
        members: HashSet.make(iri(`${vendorBase}/a`), iri(`${vendorBase}/b`), iri(`${vendorBase}/c`)),
      });
      expect(Equal.equals(checkBroader(scheme), [cycle])).toBe(true);
      const pack = yield* loadOne("concept-scheme/vendor-three-cycle.json", "vendor");
      expect(Equal.equals(pack.exceptions, checkBroader(scheme))).toBe(true);
      expect(O.exists(HashMap.get(pack.schemes, scheme.iri), Equal.equals(scheme))).toBe(true);
      expect(A.length(pack.exceptions)).toBe(1);
    })
  );
});
