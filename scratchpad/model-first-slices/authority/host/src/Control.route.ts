import { IssueGrant } from "@proto/authority-contract/Grant/IssueGrant.command";
import { RevokeGrant } from "@proto/authority-contract/Grant/RevokeGrant.command";
import { Grant } from "@proto/authority-model/Grant/Grant.aggregate";
import { ResourceScope } from "@proto/kernel/Capability";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { CapabilityId, GrantId, OrgId, PrincipalId } from "@proto/kernel/Ids";
import * as Effect from "effect/Effect";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import { bootstrap } from "./Boundary/Boundary.ts";

/**
 * A conformance-only route: `/control/issue?grant=&holder=&capability=&org=`
 * and `/control/revoke?grant=&org=` issue and revoke grants as an org's owner
 * at bootstrap, as the in-memory tests do with `bootstrap`. It provides a
 * root invocation outside the boundary, so the root-construction scan lists
 * this file as a named exception; a production front would not mount it.
 *
 * @category routes
 * @since 0.0.0
 */
export const controlRoute = Effect.gen(function* () {
  const grants = yield* Grant;
  return Effect.gen(function* () {
    const request = yield* HttpServerRequest;
    const url = new URL(request.url, "http://front");
    const param = (name: string) => url.searchParams.get(name) ?? "";
    const org = OrgId.make(param("org"));
    const as = Effect.provideService(CurrentInvocation, bootstrap(PrincipalId.make("p_owner"), org));
    const action = url.pathname.split("/")[2];
    const result: Effect.Effect<{ readonly version: number }, unknown> =
      action === "issue"
        ? grants
            .send(
              GrantId.make(param("grant")),
              new IssueGrant({
                holder: PrincipalId.make(param("holder")),
                terms: {
                  capability: CapabilityId.make(param("capability")),
                  operations: null,
                  resource: ResourceScope.cases.Org.make({ org }),
                  expires: null,
                },
              }),
            )
            .pipe(as)
        : grants.send(GrantId.make(param("grant")), new RevokeGrant()).pipe(as);
    return yield* result.pipe(
      Effect.map((receipt) => ({ ok: true, version: receipt.version })),
      Effect.catch((error) => Effect.succeed({ ok: false, error: String((error as { _tag?: string })._tag) })),
      Effect.flatMap((body) => HttpServerResponse.json(body)),
    );
  });
});
