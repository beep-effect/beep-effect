/**
 * Conformance of the reference platform, `Domain.InMemory`: the scenarios
 * describe upstream semantics, so they must hold here first.
 */
import * as Domain from "@alchemy.run/domain";
import * as Layer from "effect/Layer";
import { conformance } from "./scenarios.ts";

conformance({
  name: "Domain.InMemory",
  base: Layer.empty,
  platform: Domain.InMemory,
  durable: false,
  redelivers: false,
});
