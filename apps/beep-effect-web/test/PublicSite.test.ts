import { SiteRoute } from "@beep/public-site";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { apexHost, wwwHost } from "@/PublicHosts";
import { getRouter } from "@/router";

describe("public-site alignment", () => {
  it("serves the @beep/public-site apex origin", () => {
    expect(apexHost).toBe("beep-effect.com");
    expect(wwwHost).toBe("www.beep-effect.com");
  });

  it("serves no route under a reserved slug", () => {
    const reserved = pipe(R.keys(getRouter().routesByPath), A.flatMap(firstSegment), A.filter(S.is(SiteRoute)));

    expect(reserved).toEqual([]);
  });
});

function firstSegment(path: string): ReadonlyArray<string> {
  return pipe(Str.split(path, "/"), A.drop(1), A.take(1));
}
