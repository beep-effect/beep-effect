/**
 * Drizzle Kit configuration for the effect-ontology persistence schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration for the effect-ontology PostgreSQL schema and migrations.
 *
 * **Example** (Inspect the migration directory)
 *
 * ```ts
 * import config from "@effect-ontology/drizzle.config"
 *
 * console.log(config.out) // "./Runtime/Persistence/migrations"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export default defineConfig({
  dialect: "postgresql",
  introspect: {
    casing: "camel",
  },
  out: "./Runtime/Persistence/migrations",
  schema: "./Repository/schema.ts",
});
