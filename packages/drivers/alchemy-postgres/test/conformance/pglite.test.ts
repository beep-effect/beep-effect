/**
 * Conformance of the Postgres platform over an in-process PGlite database.
 * Every build of the platform in this file shares the one database, so a
 * second build of the model sees what the first committed.
 */
import { PgliteTestLayer } from "@beep/pglite/Pglite.test-layer";
import { postgresSuites } from "./postgres-suites.ts";

postgresSuites({ name: "AlchemyPostgresPlatform over PGlite", base: PgliteTestLayer });
