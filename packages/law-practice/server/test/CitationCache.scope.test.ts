import { ResolvedSourceText, ResolveSourceTextRequest, SourceTextResolver } from "@beep/file-processing/SourceText";
import { LawPrincipalId } from "@beep/law-practice-domain/values/LawClaim";
import { MatterGrant, MatterScope } from "@beep/law-practice-domain/values/MatterScope";
import {
  AuthorizedSourceTextResolver,
  MatterAuthorityConfig,
  MatterAuthorityLayer,
} from "@beep/law-practice-server/MatterAuthority";
import { LawPrincipal } from "@beep/law-practice-use-cases/MatterWall";
import { PosixPath } from "@beep/schema";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { it } from "@beep/test-runner";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { serviceOf } from "./MatterWall.fixtures.ts";

const matterA = LawPractice.MatterId.make(1);
const matterB = LawPractice.MatterId.make(2);
const principalAB = LawPrincipalId.make(8);

const scopeOf = (matter: LawPractice.MatterId, scopeRef: string) =>
  MatterScope.make({
    matter,
    scopeRefs: HashSet.make(scopeRef),
    familyKeys: HashSet.empty(),
    mailFolders: HashSet.empty(),
  });

const config = MatterAuthorityConfig.make({
  scopes: [scopeOf(matterA, "matter:cache-a"), scopeOf(matterB, "matter:cache-b")],
  grants: [MatterGrant.make({ principal: principalAB, matters: HashSet.make(matterA, matterB) })],
});

const identityIn = (scopeRef: string) =>
  SourceTextIdentity.make({
    scopeRef,
    sourceRef: "office-action.txt",
    locator: PosixPath.make("office-action.txt"),
    sourceDigest: SourceTextDigest.make(`sha256:${Str.repeat(64)("a")}`),
    textDigest: SourceTextDigest.make(`sha256:${Str.repeat(64)("b")}`),
    extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
    normalizationVersion: "1",
  });

const longLivedCache =
  /^(?:export )?(?:const|let) \w+(?::[^=]+)? = (?:new (?:Map|Set)\b|MutableHashMap\.|MutableHashSet\.|MutableRef\.|Ref\.makeUnsafe|Cache\.)/;
const cacheConstructor = /\b(?:Cache\.make|ScopedCache\.|Effect\.cachedWithTTL|Effect\.cachedFunction)\b/;
const memoizedOwner = /\bEffect\.cached\b/;

const citationModules = Effect.fn("CitationCacheScope.modules")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.realPath(path.join(import.meta.dirname, "..", "src", "internal", "Citation"));
  const names = yield* fs.readDirectory(directory);
  return yield* Effect.forEach(
    A.filter(names, Str.endsWith(".ts")),
    (name) => Effect.map(fs.readFileString(path.join(directory, name)), (source) => ({ name, source })),
    { concurrency: 1 }
  );
});

describe("Citation cache scope", () => {
  it.effect("returns each request's own scope for identical bytes resolved under two matters", () =>
    Effect.gen(function* () {
      const inner = SourceTextResolver.of({
        resolve: Effect.fn("CitationCacheScope.inner")(function* (request) {
          return ResolvedSourceText.make({ identity: request.identity, text: "identical bytes" });
        }),
      });
      const resolver = yield* serviceOf(SourceTextResolver)(
        AuthorizedSourceTextResolver.pipe(
          Layer.provide(Layer.succeed(SourceTextResolver, inner)),
          Layer.provide(MatterAuthorityLayer(config)),
          Layer.provide(Layer.succeed(LawPrincipal, { principal: principalAB }))
        )
      );
      const underA = yield* resolver.resolve(ResolveSourceTextRequest.make({ identity: identityIn("matter:cache-a") }));
      const underB = yield* resolver.resolve(ResolveSourceTextRequest.make({ identity: identityIn("matter:cache-b") }));
      expect([underA.identity.scopeRef, underB.identity.scopeRef]).toEqual(["matter:cache-a", "matter:cache-b"]);
      expect(underA.text).toBe(underB.text);
    })
  );

  it.layer(Layer.merge(NodeFileSystem.layer, NodePath.layer))("internal/Citation modules", (it) => {
    it.effect("declare no cache that outlives a call", () =>
      Effect.gen(function* () {
        const modules = yield* citationModules();
        const offenders = A.flatMap(modules, ({ name, source }) =>
          A.flatMap(Str.split(source, "\n"), (line, index) =>
            longLivedCache.test(line) ||
            cacheConstructor.test(line) ||
            (memoizedOwner.test(line) && name !== "NativeLane.ts")
              ? [`${name}:${index + 1}`]
              : []
          )
        );
        expect(modules.length).toBeGreaterThan(0);
        expect(offenders).toEqual([]);
      })
    );
  });
});
