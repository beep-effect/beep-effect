import type * as Domain from "@alchemy.run/domain";
import type * as Context from "effect/Context";
import type * as Layer from "effect/Layer";
import type { Authority } from "./Authority.external.ts";
import { RunsHandlers } from "./Runs.handlers.ts";
import { RunsModel } from "./Runs.model.ts";

/**
 * Everything the runs model needs from outside itself: the authority context.
 *
 * @category ports
 * @since 0.0.0
 */
export type RunsPorts = Context.Service.Identifier<typeof Authority>;

/**
 * What every platform gives a hosted model, read off `Domain.InMemory`.
 *
 * @category ports
 * @since 0.0.0
 */
export type Host = Layer.Success<typeof Domain.InMemory>;

/**
 * The runs model with its generated handler registry, on no platform yet.
 *
 * @category layers
 * @since 0.0.0
 */
export const RunsHosted = RunsModel.layer(RunsHandlers);

/**
 * The purity law: the hosted model requires its ports and the host, nothing else.
 *
 * @category ports
 * @since 0.0.0
 */
export const portPurity = RunsHosted satisfies Layer.Layer<never, unknown, RunsPorts | Host>;
