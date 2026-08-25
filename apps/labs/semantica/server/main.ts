#!/usr/bin/env bun

import { BunRuntime } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import { Command } from "effect/unstable/cli";
import { CanaryCommand } from "@/canary/Command";
import { RuntimeLayer } from "@/runtime/Layer";

const Main = Effect.scoped(
  Layer.build(RuntimeLayer).pipe(
    Effect.flatMap((context) => Command.run(CanaryCommand, { version: "0.0.0" }).pipe(Effect.provide(context)))
  )
);

BunRuntime.runMain(Main);
