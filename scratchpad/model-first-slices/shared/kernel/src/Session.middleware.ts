import * as RpcMiddleware from "effect/rpc/RpcMiddleware";
import * as S from "effect/Schema";
import { CurrentInvocation } from "./CurrentInvocation.context.ts";
import { $KernelId } from "./Identity.ts";
import { RunId } from "./Ids.ts";

const $I = $KernelId.create("Session.middleware");

/**
 * The request carries no credential the boundary accepts.
 *
 * @category errors
 * @since 0.0.0
 */
export class Unauthorized extends S.TaggedError<Unauthorized, { readonly brand: unique symbol }>()("Unauthorized", {}, { httpApiStatus: 401 }) {}

/**
 * The caller is an agent run with no live accountable human, so the boundary
 * builds no invocation for it.
 *
 * @category errors
 * @since 0.0.0
 */
export class Unaccountable extends S.TaggedError<Unaccountable, { readonly brand: unique symbol }>()(
  "Unaccountable",
  { run: RunId },
  { httpApiStatus: 403 },
) {}

/**
 * The trusted boundary, as a declaration: authenticate the caller and
 * provide the {@link CurrentInvocation} it may act under. This file is
 * language only; the authority context's host provides the live half, and
 * nothing in the kernel builds an invocation from a credential.
 *
 * @category middleware
 * @since 0.0.0
 */
export class Session extends RpcMiddleware.Service<Session, { provides: CurrentInvocation }>()($I`Session`, {
  error: S.Union([Unauthorized, Unaccountable]),
}) {}
