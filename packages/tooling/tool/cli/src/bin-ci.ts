#!/usr/bin/env bun
/**
 * Slim CI entry point: a `beep` root holding only the pre-toolchain `ci` commands.
 *
 * `beep ci compile-binary` compiles this module with `bun build --compile`
 * into the binary hosted jobs run before `bun install`. The program and its
 * run options live in `commands/Ci/CiBinary.ts`; this module only supplies
 * the Bun platform services and the process arguments.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as A from "effect/Array";
import { ciBinaryMain, ciBinaryRunMainOptions } from "./commands/Ci/CiBinary.ts";

BunRuntime.runMain(ciBinaryMain(A.drop(process.argv, 2), BunServices.layer), ciBinaryRunMainOptions);
