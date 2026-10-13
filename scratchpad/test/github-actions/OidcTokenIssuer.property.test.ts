import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
const roundTrips = <A, I>(name: string, schema: S.Codec<A, I>): void => {
  it.effect.prop(`${name}: decode(encode(x)) equals x and never fails`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import { OidcTokenError, OidcClaims } from "../../effected/github-actions/OidcTokenIssuer.ts";
describe("OidcTokenIssuer schema property floor", () => {
  roundTrips("OidcTokenError", OidcTokenError);
  roundTrips("OidcClaims", OidcClaims);
});

import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { HttpClient, HttpClientResponse } from "effect/http";
import { ActionEnvironment } from "../../effected/github-actions/ActionEnvironment.ts";
import { OidcTokenIssuer } from "../../effected/github-actions/OidcTokenIssuer.ts";
const Json = S.fromJsonString(S.Unknown);
const http = HttpClient.make((request, url) => Effect.gen(function* () {
  const body = yield* S.encodeEffect(Json)({ value: url.searchParams.get("audience") }).pipe(Effect.orDie);
  return HttpClientResponse.fromWeb(request, new Response(body, { headers: { "content-type": "application/json" } }));
}));
const live = OidcTokenIssuer.layer.pipe(Layer.provide(Layer.mergeAll(
  ActionEnvironment.layerTest({ ACTIONS_ID_TOKEN_REQUEST_TOKEN: "test", ACTIONS_ID_TOKEN_REQUEST_URL: "https://oidc.test/?v=1" }),
  Layer.succeed(HttpClient.HttpClient, http),
)));
it.layer(live, { timeout: "5 seconds" })((it) => {
  it.effect.prop("unsigned JWTs retain every workflow claim through issue/parse/reissue/parse", [Arbitrary.schema(OidcClaims)], ([claims]) => Effect.gen(function* () {
    const issuer = yield* OidcTokenIssuer;
    const serialized = OidcTokenIssuer.unsignedTokenFor(claims);
    const parsed = yield* issuer.claims(Redacted.value(serialized));
    assert.isTrue(S.toEquivalence(OidcClaims)(parsed, claims));
    const formatted = OidcTokenIssuer.unsignedTokenFor(parsed);
    assert.strictEqual(Redacted.value(formatted), Redacted.value(serialized));
    const reparsed = yield* issuer.claims(Redacted.value(formatted));
    assert.isTrue(S.toEquivalence(OidcClaims)(reparsed, parsed));
    assert.strictEqual(Redacted.value(OidcTokenIssuer.unsignedTokenFor(reparsed)), Redacted.value(formatted));
  }), runs);
});
