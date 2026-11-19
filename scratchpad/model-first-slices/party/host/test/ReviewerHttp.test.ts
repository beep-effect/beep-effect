import { expect, it } from "@effect/vitest";
import { PartyIntake, PartyRead } from "@proto/party-contract/Party.capabilities";
import { reviewerFetch, reviewerFetchAt } from "@proto/party-host/ReviewerApi.http";
import { IntakeApi } from "@proto/party-model/IntakeApi.api";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import { HttpServerRequest, fromWeb } from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as S from "effect/Schema";
import * as Schedule from "effect/Schedule";
import { Cast, grantsBy, partyName, searchText } from "./Cast.ts";
import { Access, asHuman, inWorld } from "./World.ts";

// The reviewer Api as plain HTTP JSON (`ReviewerApi.http.ts`): what a caller with no client gets.
// A query is `QUERY /<Name>` with a JSON body; a typed refusal answers at its declared status.

const Json = S.fromJsonString(S.Unknown);
const encodeJson = S.encodeEffect(Json);
const decodeJson = S.decodeEffect(Json);

/** One `QUERY` to a published HTTP API as `headers` presents itself: the answer's status and JSON body. */
const queryOn = Effect.fnUntraced(function* (
  serve: Effect.Success<typeof reviewerFetch>,
  path: string,
  headers: { readonly authorization: string },
  body: unknown,
) {
  const sent = yield* encodeJson(body);
  const request = fromWeb(
    new Request(`http://party${path}`, { method: "QUERY", headers: { ...headers, "content-type": "application/json" }, body: sent }),
  );
  const response = yield* Effect.provideService(serve, HttpServerRequest, request);
  const web = HttpServerResponse.toWeb(response);
  const text = yield* Effect.promise(() => web.text());
  const answered = yield* decodeJson(text);
  return { status: web.status, body: answered };
});
/** {@link queryOn} the Api at the root. */
const query = (path: string, headers: { readonly authorization: string }, body: unknown) =>
  Effect.flatMap(reviewerFetch, (serve) => queryOn(serve, path, headers, body));

it.live.prop(
  "FindParties over plain HTTP: a page answers 200, and a cursor the search did not issue answers 400 InvalidCursor",
  [Cast],
  ([cast]) =>
    Effect.gen(function* () {
      const authority = yield* Access;
      const grant = grantsBy(cast);
      yield* Effect.forEach([grant(cast.intake, PartyIntake, cast.org), grant(cast.reviewer, PartyRead, cast.org)], authority.issue, {
        concurrency: 1,
        discard: true,
      });
      const intake = yield* IntakeApi.clientInProcess;
      yield* intake.RegisterParty(cast.party, { org: cast.org, name: partyName(cast) }, asHuman(cast.intake));
      const input = { org: cast.org, text: searchText(cast) };
      const reviewer = asHuman(cast.reviewer).headers;

      // The projection applies in the background; the search finds the party once it has.
      const page = yield* query("/FindParties", reviewer, { input }).pipe(
        Effect.repeat({
          schedule: Schedule.spaced("25 millis"),
          until: ({ body }) => S.is(S.Struct({ entries: S.NonEmptyArray(S.Unknown) }))(body),
          times: 80,
        }),
      );
      expect(page.status).toBe(200);
      expect(page.body).toMatchObject({ entries: [{ partyId: cast.party, name: partyName(cast) }], cursor: null });

      const refused = yield* Effect.forEach(["not-a-cursor", cast.party, ""], (after) => query("/FindParties", reviewer, { input, after }), {
        concurrency: 1,
      });
      expect(A.map(refused, ({ status }) => status)).toEqual([400, 400, 400]);
      expect(A.map(refused, ({ body }) => body)).toEqual(A.replicate({ _tag: "InvalidCursor" }, 3));

      // Under a prefix, as the cluster's front serves it: the same answers, and nothing at the root.
      const prefixed = yield* reviewerFetchAt("/reviewer-http");
      const underPrefix = yield* queryOn(prefixed, "/reviewer-http/FindParties", reviewer, { input, after: "not-a-cursor" });
      expect(underPrefix).toEqual({ status: 400, body: { _tag: "InvalidCursor" } });

      // No credential is refused before the cursor is read.
      const anonymous = yield* query("/FindParties", { authorization: "" }, { input, after: "not-a-cursor" });
      expect(anonymous.status).toBe(401);
    }).pipe(Effect.scoped, inWorld),
  { timeout: 120_000, arbitrary: { runs: 10 } },
);
