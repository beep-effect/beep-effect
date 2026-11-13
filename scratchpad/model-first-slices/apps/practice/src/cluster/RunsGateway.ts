import { RunsGatewayLive } from "@proto/runs-host/RunsGateway.adapter";
import * as Layer from "effect/Layer";
import GatewayLive from "./Gateway.ts";
import RunsLive from "./Runs.ts";

/**
 * The runs context's gateway over its hosted model: how a product context
 * opens a run and reports to it. Its output is the gateway alone.
 *
 * @category entry
 * @since 0.0.0
 */
export default RunsGatewayLive.pipe(Layer.provide(Layer.merge(RunsLive, GatewayLive)));
