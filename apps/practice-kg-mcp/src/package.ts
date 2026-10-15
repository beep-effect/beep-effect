#!/usr/bin/env bun

/**
 * Cross-platform MCPB packaging entrypoint for the read-only practice KG host.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { PracticeKgToolkit } from "@beep/law-practice-server";
import {
  McpbManifestFields,
  McpbPackageSpec,
  McpbTool,
  McpbUserConfigField,
  mcpbPackageProgram,
  runMcpbEntrypoint,
} from "@beep/mcpb-kit";
import * as A from "effect/Array";
import * as R from "effect/Record";
import { PRACTICE_KG_EXTENSION_VERSION } from "./Version.ts";

/*
 * Tool names DERIVE from the canonical PracticeKgToolkit so the shipped
 * manifest cannot drift from the served surface; only the human-facing
 * descriptions live here, and the keyed record type makes a toolkit tool
 * without a description entry a compile error.
 */
const ManifestToolDescriptions: Readonly<Record<keyof typeof PracticeKgToolkit.tools, string>> = {
  corpus_get_document: "Read a digest-addressed document.",
  corpus_search_text: "Search extracted corpus text.",
  email_search: "Search indexed correspondence headers.",
  kg_application_lookup: "Resolve an application, patent, or docket.",
  kg_candidate_claims: "Read span-grounded candidate claims.",
  kg_clients: "List practice clients and docket-family counts.",
  kg_correspondent_lookup: "Resolve an email address to the matters it corresponds about.",
  kg_docket_family: "Walk one docket-family spine.",
  kg_find: "Find knowledge-graph nodes.",
  kg_matter_lookup: "Resolve a reference to its practice matter.",
  kg_provenance: "Resolve row provenance or report bundle status.",
};

const program = mcpbPackageProgram(
  McpbPackageSpec.make({
    appName: "practice-kg-mcp",
    commandName: "practice-kg-package",
    repoRoot: Bun.fileURLToPath(new URL("../../..", import.meta.url)),
    forbiddenArchiveFragments: [
      "claims.ts",
      "build.ts",
      "package.ts",
      "smoke.ts",
      "practice-kg-build",
      "practice-kg-claims",
      "src/",
    ],
    manifest: McpbManifestFields.make({
      name: "beep-practice-kg",
      displayName: "Beep Practice Knowledge Graph",
      version: PRACTICE_KG_EXTENSION_VERSION,
      description: "Read-only local practice knowledge-graph queries over a separately supplied data bundle.",
      env: {
        BUNDLE_DIR: "${user_config.bundle_dir}",
        PRACTICE_KG_CORPUS_ROOT: "${user_config.corpus_root}",
      },
      userConfig: {
        bundle_dir: McpbUserConfigField.make({
          type: "directory",
          title: "Practice KG data bundle",
          description: "Directory containing bundle.manifest.json, kg.pglite, and practice.duckdb.",
          required: true,
        }),
        corpus_root: McpbUserConfigField.make({
          type: "directory",
          title: "Practice corpus root",
          description: "Optional corpus root used for click-through to source files and email bodies.",
          required: false,
        }),
      },
      tools: A.map(R.keys(PracticeKgToolkit.tools), (name) =>
        McpbTool.make({ name, description: ManifestToolDescriptions[name] })
      ),
    }),
  })
);
runMcpbEntrypoint({ isMain: import.meta.main, program });
