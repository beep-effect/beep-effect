import type { PaginatingEndpoints } from "@octokit/plugin-paginate-rest";
import type { Endpoints, RequestHeaders } from "@octokit/types";
import { Schema } from "effect";

/**
 * Every REST route GitHub documents, as a `"<METHOD> <path>"` literal — for
 * example `"GET /repos/{owner}/{repo}"`.
 *
 * @remarks
 * This is the key the whole typed surface turns on. `@octokit/types` generates
 * the `Endpoints` map from GitHub's own OpenAPI description, so a route literal
 * carries both its parameter shape and its response shape with it, and neither
 * a caller nor an implementation ever has to name a payload type by hand.
 *
 * The generated map is **types only** — `@octokit/types` ships no JavaScript at
 * all — so leaning on it costs zero runtime bytes.
 *
 * @public
 */
export type Route = keyof Endpoints;

/**
 * Transport knobs octokit accepts on any route, narrowed to the three this
 * package allows.
 *
 * @remarks
 * octokit's own `RequestParameters` carries an `[parameter: string]: unknown`
 * index signature, so intersecting it would silently accept every misspelled
 * parameter. These three are the ones callers need:
 * `headers` for a release asset's `content-type` and the attestations API
 * version pin, `mediaType.format` for raw content reads, and `baseUrl` for the
 * `uploads.github.com` host that release-asset uploads go to. Everything else a
 * caller might reach for is a real endpoint parameter and is already typed.
 *
 * @public
 */
export interface RequestExtras {
	/** Extra request headers. Keys must be lowercase. */
	readonly headers?: RequestHeaders;
	/** Media-type negotiation, e.g. `{ format: "raw" }`. */
	readonly mediaType?: { readonly format?: string };
	/** Overrides the API host for this one request. */
	readonly baseUrl?: string;
}

/**
 * The parameters `Route` accepts — path, query and body parameters from
 * GitHub's OpenAPI description, plus the extras below.
 *
 * @public
 */
export type Params<R extends Route> = Endpoints[R]["parameters"] & RequestExtras;

/**
 * The full response `Route` returns, including `status`, `headers` and `data`.
 *
 * @public
 */
export type Response<R extends Route> = Endpoints[R]["response"];

/**
 * The `data` payload `Route` returns.
 *
 * @public
 */
export type Data<R extends Route> = Endpoints[R]["response"]["data"];

/**
 * The subset of routes that paginate.
 *
 * @remarks
 * Handing a non-paginating route to a paginating call is a **compile** error.
 *
 * Intersected with `Rest.Route` because `plugin-paginate-rest` generates its
 * map from its own `@octokit/types` pin, which can trail the one this package
 * resolves; a route the newer map has deleted must not survive here as a key
 * `Endpoints` no longer indexes.
 *
 * @public
 */
export type PaginatingRoute = keyof PaginatingEndpoints & Route;

/**
 * One element of a paginating route's collection.
 *
 * @remarks
 * Derived here rather than imported: `@octokit/plugin-paginate-rest` computes
 * the same thing internally as `GetResultsType`, but does not export it. The
 * second branch covers the search-shaped endpoints whose payload is
 * `{ total_count, items }` rather than a bare array — octokit normalizes those
 * to the inner array at runtime, and this mirrors that at the type level.
 *
 * @public
 */
export type Item<R extends PaginatingRoute> =
	PaginatingEndpoints[R]["response"]["data"] extends ReadonlyArray<infer T>
		? T
		: PaginatingEndpoints[R]["response"]["data"] extends { readonly items: ReadonlyArray<infer T> }
			? T
			: never;

/**
 * How far a paginated read should go.
 *
 * @remarks
 * Both fields are honored by every paginating method in this package. Unset,
 * a read requests 100-item pages and walks until GitHub stops.
 *
 * `perPage` is **validated, not clamped**: GitHub caps a page at 100 and
 * silently ignores anything larger, so a caller asking for 250 has a bug whose
 * arithmetic is already wrong. Failing at the boundary is cheaper than
 * discovering it in production.
 *
 * @public
 */
export class PageOptions extends Schema.Class<PageOptions>("PageOptions")({
	/** Items requested per page. GitHub's ceiling is 100. */
	perPage: Schema.optionalKey(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 }))),
	/** Stop after this many pages. Absent means "until GitHub stops". */
	maxPages: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThan(0))),
}) {
	/** Reads every page, 100 at a time — GitHub's maximum page size. */
	static readonly all: PageOptions = PageOptions.make({ perPage: 100 });

	/**
	 * Reads at most one page of `perPage` items.
	 *
	 * @remarks
	 * The shape a "is there any?" or "give me the newest few" read wants, where
	 * walking every page is waste.
	 */
	static first(perPage: number): PageOptions {
		return PageOptions.make({ perPage, maxPages: 1 });
	}
}
