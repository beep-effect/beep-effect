#!/usr/bin/env bun
/**
 * Dedicated Bun entrypoint for the schema idiom `PostToolUse` hook; avoids
 * loading the command tree so the hook stays cheap on every edit.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunStdio from "@effect/platform-bun/BunStdio";
import * as Effect from "effect/Effect";
import { schemaIdiomHookMain } from "./SchemaIdioms.hook.ts";

BunRuntime.runMain(schemaIdiomHookMain.pipe(Effect.provide([BunFileSystem.layer, BunStdio.layer])), {
  disableErrorReporting: true,
});
