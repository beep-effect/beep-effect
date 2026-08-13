#!/usr/bin/env bun
/**
 * CLI: Effect Ontology Entry Point
 *
 * Main entry point for the effect-onto CLI.
 *
 * @since 2.0.0
 * @module cli
 */

import { runCli } from "./Cli/index.ts";

runCli(Bun.argv);
