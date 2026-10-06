#!/usr/bin/env bun

/**
 * Process entrypoint of the docket intake service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { BunRuntime } from "@effect/platform-bun";
import { main } from "./Main.ts";

BunRuntime.runMain(main);
