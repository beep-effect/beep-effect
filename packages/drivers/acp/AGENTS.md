# Agent Guide

`@beep/acp` is the Effect-native Agent Client Protocol driver. Keep ACP wire
contracts, transport helpers, typed protocol errors, and driver-local layers
product-neutral; product-specific agent behavior belongs in the owning slice.

`src/internal/*` and `src/_generated/*` are package-private — never add package
exports for them; route generated schema/meta access through the root `Schema`
namespace.

Codegen uses `@beep/codegen-kit` and pins the ACP release to `v0.11.3`.
`bun run generate` reads the committed `spec/*.unstable.json` caches without
network access. `bun run generate -- --refresh` downloads, normalizes, and
formats those caches before regenerating `src/_generated/*.gen.ts`.
`bun run generate:check` stays offline and fails on generated-output drift.
Build/check must remain offline.
