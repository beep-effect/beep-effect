/**
 * Drizzle Kit configuration for the effect-ontology persistence schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  introspect: {
    casing: "camel",
  },
  out: "./Runtime/Persistence/migrations",
  schema: "./Repository/schema.ts",
});
