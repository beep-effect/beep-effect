#!/usr/bin/env bun

import { GenerateConfig, runGenerateCli } from "@beep/codegen-kit";

const packageRoot = `${import.meta.dirname}/..`;
const generatedHeader = `/**
 * Generated from the checked-in GovInfo OpenAPI document.
 *
 * This package-private module is a drift oracle for the hand-written GovInfo
 * contracts. Do not import it from package source or edit it by hand.
 *
 * @packageDocumentation
 * @since 0.0.0
 */`;

const config = GenerateConfig.make({
  packageName: "@beep/govinfo",
  name: "GovinfoApi",
  identity: { composer: "$GovinfoId", moduleId: "_generated/Govinfo.gen" },
  source: {
    _tag: "url",
    url: "https://api.govinfo.gov/api-docs",
    // Pin the document's info.version so an upstream API version change is explicit drift.
    pin: "2.0",
    cachePath: `${packageRoot}/openapi.json`,
  },
  dialect: "openapi-3.0",
  patches: [],
  transforms: [],
  format: "httpapi",
  output: {
    path: `${packageRoot}/src/_generated/Govinfo.gen.ts`,
    header: generatedHeader,
  },
});

runGenerateCli(config);
