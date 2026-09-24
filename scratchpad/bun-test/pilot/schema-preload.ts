import { mock } from "bun:test";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as adapter from "../index.ts";
import * as assertions from "../utils.ts";

const floor = Config.Number("BEEP_FC_NUM_RUNS").pipe(Config.option, Effect.runSync);
adapter.setDefaultTimeout(
  O.exists(floor, (runs) => runs > 0) || A.contains(process.argv, "--coverage") ? 300_000 : 30_000
);
mock.module("@effect/vitest", () => adapter);
mock.module("@effect/vitest/utils", () => assertions);
mock.module("vitest", () => adapter);
