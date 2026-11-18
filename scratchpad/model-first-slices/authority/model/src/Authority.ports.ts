import type * as Domain from "@alchemy.run/domain";
import type * as Layer from "effect/Layer";
import { AuthorityHandlers } from "./Authority.handlers.ts";
import { AuthorityModel } from "./Authority.model.ts";

/**
 * What every platform gives a hosted model, read off `Domain.InMemory`.
 *
 * @category ports
 * @since 0.0.0
 */
export type Host = Layer.Success<typeof Domain.InMemory>;

/**
 * The authority model with its generated handler registry, on no platform
 * yet. It declares no ports: everything it needs is its own.
 *
 * @category layers
 * @since 0.0.0
 */
export const AuthorityHosted = AuthorityModel.layer(AuthorityHandlers);

/**
 * The purity law: the hosted model requires the host and nothing else.
 *
 * @category ports
 * @since 0.0.0
 */
export const portPurity = AuthorityHosted satisfies Layer.Layer<never, unknown, Host>;
