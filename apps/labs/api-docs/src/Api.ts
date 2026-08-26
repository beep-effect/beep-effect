import { $ApiDocsId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

const $I = $ApiDocsId.create("Api");

export class Health extends S.Class<Health>($I`Health`)(
  {
    status: S.tag("ok"),
  },
  $I.annote("Health", {
    description: "Service health snapshot returned by GET /health.",
  })
) {}

// Not exported: `Api` is the only consumer, and a lab-local export with no
// importer trips fallow's unused-export gate the first time the lab lands.
const ApiGroup = HttpApiGroup.make("api-docs").add(HttpApiEndpoint.get("health", "/health", { success: Health }));

export const Api = HttpApi.make("api-docs-api").add(ApiGroup);
