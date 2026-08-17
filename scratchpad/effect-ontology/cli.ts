#!/usr/bin/env bun
/**
 * CLI: Effect Ontology Entry Point
 *
 * Main entry point for the effect-onto CLI.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { runCli } from "./Cli/index.ts";

runCli(Bun.argv);
