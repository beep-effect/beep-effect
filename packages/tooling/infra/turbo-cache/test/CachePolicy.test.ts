import {
  Access,
  ArtifactOperation,
  CachePolicy,
  PrincipalName,
  permits,
  TeamSlug,
  tokenHolders,
} from "@beep/infra-turbo-cache/CachePolicy";
import { foundationId, tokenId, workerId } from "@beep/infra-turbo-cache/TurboCache";
import { cachePolicy } from "@beep/infra-turbo-cache/Worker";
import { describe, expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const decodePolicy = S.decodeUnknownEffect(CachePolicy);

describe("permits", () => {
  it.effect("write tokens may do everything, read tokens everything but upload", () =>
    Effect.sync(() => {
      A.forEach(ArtifactOperation.literals, (operation) => {
        expect(permits("write", operation)).toBe(true);
        expect(permits("read", operation)).toBe(!ArtifactOperation.is.upload(operation));
      });
      expect(permits("upload")("read")).toBe(false);
      expect(A.map(Access.literals, permits("download"))).toEqual([true, true]);
    })
  );
});

describe("CachePolicy", () => {
  it.effect("refuses duplicate principals inside a team and duplicate teams", () =>
    Effect.gen(function* () {
      const duplicatePrincipal = yield* decodePolicy({
        teams: [
          {
            slug: "beep",
            principals: [
              { name: "ci", access: "write", rotation: 1 },
              { name: "ci", access: "read", rotation: 1 },
            ],
          },
        ],
      }).pipe(Effect.result);
      duplicatePrincipal.pipe(Result.isFailure, assertTrue);

      const team = { slug: "beep", principals: [{ name: "ci", access: "read", rotation: 1 }] };
      const duplicateTeam = yield* decodePolicy({ teams: [team, team] }).pipe(Effect.result);
      duplicateTeam.pipe(Result.isFailure, assertTrue);
    })
  );

  it.effect("refuses empty teams, bad slugs, bad principal names and rotation zero", () =>
    Effect.gen(function* () {
      const cases = [
        { teams: [] },
        { teams: [{ slug: "beep", principals: [] }] },
        { teams: [{ slug: "bad.slug", principals: [{ name: "ci", access: "read", rotation: 1 }] }] },
        { teams: [{ slug: "beep", principals: [{ name: "CI Main", access: "read", rotation: 1 }] }] },
        { teams: [{ slug: "beep", principals: [{ name: "ci", access: "admin", rotation: 1 }] }] },
        { teams: [{ slug: "beep", principals: [{ name: "ci", access: "read", rotation: 0 }] }] },
      ];
      const results = yield* Effect.forEach(cases, (input) => decodePolicy(input).pipe(Effect.result));
      assertTrue(A.every(results, Result.isFailure));
    })
  );

  it.effect("slug and hash segments refuse path and query characters", () =>
    Effect.sync(() => {
      A.forEach(["a/b", "a.b", "a b", "a+b", "", "a?b"], (value) => {
        expect(S.is(TeamSlug)(value)).toBe(false);
      });
      expect(S.is(PrincipalName)("beep-worker")).toBe(true);
      expect(S.is(PrincipalName)("-leading")).toBe(false);
    })
  );
});

describe("the repository policy", () => {
  it.effect("CI main and the named workstations write, pull requests only read", () =>
    Effect.sync(() => {
      const holders = tokenHolders(cachePolicy);
      const byAccess = (access: Access) =>
        A.map(
          A.filter(holders, ({ principal }) => principal.access === access),
          ({ principal }) => principal.name
        );
      expect(A.map(holders, ({ team }) => team)).toEqual(["beep", "beep", "beep", "beep"]);
      expect(byAccess("write")).toEqual(["ci-main", "dankstation", "beep-worker"]);
      expect(byAccess("read")).toEqual(["ci-pr"]);
    })
  );

  it.effect("resource ids carry team, principal and rotation", () =>
    Effect.sync(() => {
      const options = { resourceNamePrefix: "TurboCache" };
      const ids = A.map(tokenHolders(cachePolicy), (holder) => tokenId(options, holder));
      expect(ids).toEqual([
        "TurboCacheToken-beep-ci-main-r1",
        "TurboCacheToken-beep-ci-pr-r1",
        "TurboCacheToken-beep-dankstation-r1",
        "TurboCacheToken-beep-beep-worker-r1",
      ]);
      expect(foundationId(options)).toBe("TurboCacheFoundation");
      expect(workerId(options)).toBe("TurboCache");
      expect(tokenId({ team: "beep", principal: { name: "ci-pr", rotation: 2 } })(options)).toBe(
        "TurboCacheToken-beep-ci-pr-r2"
      );
    })
  );
});
