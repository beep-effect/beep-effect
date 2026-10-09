#!/usr/bin/env bun

import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import { Command } from "effect/cli";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { CanaryCommand } from "@/canary/Command";
import { RuntimeLayer } from "@/runtime/Layer";

const Main = RuntimeLayer.pipe(
  Layer.build,
  Effect.flatMap((context) => Command.run(CanaryCommand, { version: "0.0.0" }).pipe(Effect.provide(context))),
  Effect.scoped
);

BunRuntime.runMain(Main);
