# Agent Guide

`@beep/acp` is the Effect-native Agent Client Protocol driver. Keep ACP wire
contracts, transport helpers, typed protocol errors, and driver-local layers
product-neutral; product-specific agent behavior belongs in the owning slice.

`src/internal/*` and `src/_generated/*` are package-private — never add package
exports for them; route generated schema/meta access through the root `Schema`
namespace.

Codegen: the ACP schema release is pinned to `v0.11.3`. `bun run generate`
downloads upstream `schema.unstable.json`/`meta.unstable.json`, normalizes
nullable JSON Schema unions, and rewrites `src/_generated/*.gen.ts`
(`-- --skip-download` reuses existing JSON assets). Build/check must remain
offline.
