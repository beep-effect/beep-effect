import { defineConfig } from "drizzle-kit";
import { Config, Effect } from "effect";

const databaseUrl = Effect.runSync(
  Config.String("BEEP_TEST_DATABASE_URL").pipe(
    Config.withDefault("postgres://postgres:postgres@127.0.0.1:5432/postgres")
  )
);

export default defineConfig({
  dbCredentials: {
    url: databaseUrl,
  },
  dialect: "postgresql",
  introspect: {
    casing: "camel",
  },
  out: "./drizzle",
  schema: "./src/schema.ts",
});
