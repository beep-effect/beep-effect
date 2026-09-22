/**
 * The conformance port, run against the kit's own fixture host. Hosts flipped
 * to `2026-07-28` run the same suite through `@beep/mcp-kit/test/Conformance`.
 *
 * @since 0.0.0
 */
import { conformance2026 } from "@beep/mcp-kit/test/Conformance";
import { fixtureHost } from "./fixtures/FixtureHost.ts";

conformance2026(fixtureHost);
