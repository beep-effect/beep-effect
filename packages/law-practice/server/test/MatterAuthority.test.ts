import { ResolvedSourceText, ResolveSourceTextRequest, SourceTextResolver } from "@beep/file-processing/SourceText";
import { LawPrincipalId } from "@beep/law-practice-domain/values/LawClaim";
import { MatterGrant, MatterScope, PracticeKgFamilyKey } from "@beep/law-practice-domain/values/MatterScope";
import {
  AuthorizedSourceTextResolver,
  EmptyMatterAuthorityConfig,
  MatterAccessKindAttribute,
  MatterAccessOutcomeAttribute,
  MatterAuthorityConfig,
  MatterAuthorityLayer,
  MatterAuthorityLive,
  MatterDenialReasonAttribute,
  MatterWallLive,
} from "@beep/law-practice-server/MatterAuthority";
import { GrantedScopes, LawPrincipal, MatterAuthority } from "@beep/law-practice-use-cases/MatterWall";
import { PosixPath } from "@beep/schema";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tracer from "effect/Tracer";
import { fixturePrincipal, provideMatterAuthority, serviceOf } from "./MatterWall.fixtures.ts";

const matterA = LawPractice.MatterId.make(1);

const matterB = LawPractice.MatterId.make(2);

const familyKey = (spelled: string) =>
  PracticeKgFamilyKey.make({
    client: A.getUnsafe(Str.split(spelled, "."), 0),
    family: A.getUnsafe(Str.split(spelled, "."), 1),
  });

const scopeOf = (matter: LawPractice.MatterId, refs: ReadonlyArray<string>, families: ReadonlyArray<string> = []) =>
  MatterScope.make({
    matter,
    scopeRefs: HashSet.fromIterable(refs),
    familyKeys: HashSet.fromIterable(A.map(families, familyKey)),
    mailFolders: HashSet.empty(),
  });

const staffed = MatterGrant.make({ principal: fixturePrincipal, matters: HashSet.make(matterA) });

const twoMatters = MatterAuthorityConfig.make({
  scopes: [scopeOf(matterA, ["matter:a"], ["acme.F1"]), scopeOf(matterB, ["matter:b"], ["acme.F2"])],
  grants: [staffed],
});

const decodeConfig = S.decodeUnknownEffect(MatterAuthorityConfig);

const encodeConfigJson = S.encodeEffect(S.fromJsonString(MatterAuthorityConfig));

const mail = (archive: string, folderPrefix: string) => ({ archive, folderPrefix });

const recordingTracer = () => {
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

describe("MatterAuthority", () => {
  it.effect("grants a staffed scope and denies an unbound scope and an unstaffed matter", () =>
    Effect.gen(function* () {
      const authority = yield* MatterAuthority;
      const ask = (scope: string) =>
        authority.authorize({ principal: fixturePrincipal, scope, access: "source-retrieval" });
      const scoped = yield* Effect.forEach(["matter:a", "matter:none", "matter:b"], ask, { concurrency: 1 });
      expect(scoped).toEqual([
        { _tag: "Granted", matter: matterA },
        { _tag: "Denied", reason: "unbound-scope" },
        { _tag: "Denied", reason: "not-staffed" },
      ]);
      const family = (spelled: string) =>
        authority.authorizeFamily({ principal: fixturePrincipal, family: familyKey(spelled), access: "graph-query" });
      const families = yield* Effect.forEach(["acme.F1", "acme.F2", "zeta.F1"], family, { concurrency: 1 });
      expect(families).toEqual([
        { _tag: "Granted", matter: matterA },
        { _tag: "Denied", reason: "not-staffed" },
        { _tag: "Denied", reason: "unbound-scope" },
      ]);
    }).pipe(provideMatterAuthority(twoMatters))
  );

  it.effect("returns the keys of every staffed matter and nothing for an unstaffed principal", () =>
    Effect.gen(function* () {
      const authority = yield* MatterAuthority;
      const granted = yield* authority.grantedScopes(fixturePrincipal);
      const encoded = yield* S.encodeEffect(GrantedScopes)(granted);
      expect(encoded).toEqual({
        scopeRefs: ["matter:a"],
        familyKeys: ["acme.F1"],
        mailFolders: [],
      });
      const other = yield* authority.grantedScopes(LawPrincipalId.make(99));
      expect(HashSet.size(other.scopeRefs)).toBe(0);
    }).pipe(provideMatterAuthority(twoMatters))
  );

  it.effect("unions the matters of two grants to one principal", () =>
    Effect.gen(function* () {
      const authority = yield* MatterAuthority;
      const access = yield* authority.authorize({
        principal: fixturePrincipal,
        scope: "matter:b",
        access: "anchor-resolution",
      });
      expect(access).toEqual({ _tag: "Granted", matter: matterB });
    }).pipe(
      provideMatterAuthority(
        MatterAuthorityConfig.make({
          scopes: twoMatters.scopes,
          grants: [staffed, MatterGrant.make({ principal: fixturePrincipal, matters: HashSet.make(matterB) })],
        })
      )
    )
  );

  it.effect("refuses at load a key bound to two matters and an overlapping mail prefix", () =>
    Effect.gen(function* () {
      const scope = (matter: number, scopeRefs: ReadonlyArray<string>, extra: object = {}) => ({
        matter,
        scopeRefs,
        familyKeys: [],
        mailFolders: [],
        ...extra,
      });
      const refused = [
        { scopes: [scope(1, ["matter:x"]), scope(2, ["matter:x"])], grants: [] },
        {
          scopes: [scope(1, [], { familyKeys: ["acme.F1"] }), scope(2, [], { familyKeys: ["acme.F1"] })],
          grants: [],
        },
        {
          scopes: [
            scope(1, [], { mailFolders: [mail("box", "Matters/A")] }),
            scope(2, [], { mailFolders: [mail("box", "Matters/A/Sub")] }),
          ],
          grants: [],
        },
      ];
      for (const config of refused) {
        const exit = yield* Effect.exit(decodeConfig(config));
        exit.pipe(Exit.isFailure, assertTrue);
      }
      const accepted = yield* decodeConfig({
        scopes: [
          scope(1, ["matter:x"], { mailFolders: [mail("box", "Matters/A")] }),
          scope(1, ["matter:x"], { mailFolders: [mail("box", "Matters/A/Sub")] }),
          scope(2, ["matter:y"], { mailFolders: [mail("other", "Matters/A")] }),
        ],
        grants: [],
      });
      expect(accepted.scopes).toHaveLength(3);
    })
  );

  it.effect("denies every path under the empty default and reads a configured authority from the environment", () =>
    Effect.gen(function* () {
      const askOver = <E>(layer: Layer.Layer<MatterAuthority, E>) =>
        Effect.flatMap(serviceOf(MatterAuthority)(layer), (authority) =>
          authority.authorize({ principal: fixturePrincipal, scope: "matter:a", access: "search" })
        );
      const fromEnv = (env: Record<string, string>) =>
        askOver(MatterAuthorityLive.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))));
      const unset = yield* fromEnv({});
      expect(unset).toEqual({ _tag: "Denied", reason: "unbound-scope" });
      const encoded = yield* encodeConfigJson(twoMatters);
      const configured = yield* fromEnv({ BEEP_LAW_PRACTICE_MATTER_AUTHORITY: encoded });
      expect(configured).toEqual({ _tag: "Granted", matter: matterA });
      const empty = yield* askOver(MatterAuthorityLayer(EmptyMatterAuthorityConfig));
      expect(empty).toEqual({ _tag: "Denied", reason: "unbound-scope" });
    })
  );

  it.effect("walls a host by its configured principal and denies every path without one", () =>
    Effect.gen(function* () {
      const encoded = yield* encodeConfigJson(twoMatters);
      const hostWall = Effect.fn("MatterAuthorityTest.hostWall")(function* (env: Record<string, string>) {
        const built = MatterWallLive.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env))));
        const authority = yield* serviceOf(MatterAuthority)(built);
        const host = yield* serviceOf(LawPrincipal)(built);
        return yield* authority.authorize({ principal: host.principal, scope: "matter:a", access: "search" });
      });
      const configured = yield* hostWall({
        BEEP_LAW_PRACTICE_PRINCIPAL: `${fixturePrincipal}`,
        BEEP_LAW_PRACTICE_MATTER_AUTHORITY: encoded,
      });
      const unconfigured = yield* hostWall({ BEEP_LAW_PRACTICE_MATTER_AUTHORITY: encoded });
      expect(configured).toEqual({ _tag: "Granted", matter: matterA });
      expect(unconfigured).toEqual({ _tag: "Denied", reason: "unbound-scope" });
    })
  );

  it.effect("annotates the access kind and denial reason on the span, never the scope", () =>
    Effect.gen(function* () {
      const { captured, tracer } = recordingTracer();
      const authority = yield* MatterAuthority;
      yield* authority
        .authorize({ principal: fixturePrincipal, scope: "matter:b", access: "cache-lookup" })
        .pipe(Effect.withTracer(tracer));
      const span = yield* Effect.fromOption(
        A.findFirst(captured, (candidate) => candidate.name === "MatterAuthority.authorize")
      );
      const attributes = span.attributes;
      expect(attributes.get(MatterAccessKindAttribute)).toBe("cache-lookup");
      expect(attributes.get(MatterAccessOutcomeAttribute)).toBe("Denied");
      expect(attributes.get(MatterDenialReasonAttribute)).toBe("not-staffed");
      expect(A.some(A.fromIterable(attributes.values()), (value) => value === "matter:b")).toBe(false);
    }).pipe(provideMatterAuthority(twoMatters))
  );

  it.effect("delegates a granted source retrieval and fails a denied one as an unavailable scope", () =>
    Effect.gen(function* () {
      let calls = 0;
      const inner = SourceTextResolver.of({
        resolve: Effect.fn("MatterAuthorityTest.innerResolve")(function* (request) {
          calls++;
          return ResolvedSourceText.make({ identity: request.identity, text: "text" });
        }),
      });
      const resolver = yield* serviceOf(SourceTextResolver)(
        AuthorizedSourceTextResolver.pipe(
          Layer.provide(Layer.succeed(SourceTextResolver, inner)),
          Layer.provide(MatterAuthorityLayer(twoMatters)),
          Layer.provide(Layer.succeed(LawPrincipal, { principal: fixturePrincipal }))
        )
      );
      const granted = yield* resolver.resolve(ResolveSourceTextRequest.make({ identity: identityIn("matter:a") }));
      expect(granted.text).toBe("text");
      for (const scopeRef of ["matter:b", "matter:none"]) {
        const denied = yield* resolver
          .resolve(ResolveSourceTextRequest.make({ identity: identityIn(scopeRef) }))
          .pipe(Effect.flip);
        expect(denied.reason).toBe("scope-unavailable");
      }
      expect(calls).toBe(1);
    })
  );
});

const roundTrips = Effect.fnUntraced(function* <A, I>(schema: S.Codec<A, I>, value: A) {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeEffect(schema)(encoded);
  expect(S.toEquivalence(schema)(decoded, value)).toBe(true);
});

describe("MatterAuthority schema-derived values", () => {
  it.effect.prop(
    "round-trips every generated GrantedScopes through its encoding",
    [Arbitrary.schema(GrantedScopes)],
    ([value]) => roundTrips(GrantedScopes, value),
    { arbitrary: fcRuns(25) }
  );
  it.effect.prop(
    "round-trips every generated MatterAuthorityConfig through its encoding",
    [Arbitrary.schema(MatterAuthorityConfig)],
    ([value]) => roundTrips(MatterAuthorityConfig, value),
    { arbitrary: fcRuns(25) }
  );
});
