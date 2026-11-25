import { LawPrincipalId } from "@beep/law-practice-domain/values/LawClaim";
import { MatterAuthorityLayer } from "@beep/law-practice-server/MatterAuthority";
import { GrantedScopes, LawPrincipal, MatterAccess, MatterAuthority } from "@beep/law-practice-use-cases/MatterWall";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import type { MatterAuthorityConfig } from "@beep/law-practice-server/MatterAuthority";

export const fixturePrincipal = LawPrincipalId.make(7);

const grantedEverywhere = MatterAccess.cases.Granted.make({ matter: LawPractice.MatterId.make(1) });

export const matterAuthorityGrantingEveryScope = MatterAuthority.of({
  authorize: Effect.fn("MatterWallFixture.authorize")(function* () {
    return grantedEverywhere;
  }),
  authorizeFamily: Effect.fn("MatterWallFixture.authorizeFamily")(function* () {
    return grantedEverywhere;
  }),
  grantedScopes: Effect.fn("MatterWallFixture.grantedScopes")(function* () {
    return GrantedScopes.make({
      scopeRefs: HashSet.empty(),
      familyKeys: HashSet.empty(),
      mailFolders: HashSet.empty(),
    });
  }),
});

export const provideMatterWallGrantingEveryScope = flow(
  Effect.provideService(MatterAuthority, matterAuthorityGrantingEveryScope),
  Effect.provideService(LawPrincipal, { principal: fixturePrincipal })
);

export const serviceOf =
  <I, S>(key: Context.Key<I, S>) =>
  <E, R>(layer: Layer.Layer<I, E, R>) =>
    Effect.map(Layer.build(layer), (context) => Context.get(context, key));

export const provideMatterAuthority = (config: MatterAuthorityConfig) =>
  Effect.provideServiceEffect(MatterAuthority, serviceOf(MatterAuthority)(MatterAuthorityLayer(config)));

export const matterWallGrantingEveryScopeLayer = Layer.mergeAll(
  Layer.succeed(MatterAuthority, matterAuthorityGrantingEveryScope),
  Layer.succeed(LawPrincipal, { principal: fixturePrincipal })
);

export const matterWallGrantingLayer = (granted: GrantedScopes) =>
  Layer.mergeAll(
    Layer.succeed(
      MatterAuthority,
      MatterAuthority.of({
        ...matterAuthorityGrantingEveryScope,
        grantedScopes: Effect.fn("MatterWallFixture.grantedScopesOf")(function* () {
          return granted;
        }),
      })
    ),
    Layer.succeed(LawPrincipal, { principal: fixturePrincipal })
  );
