import * as Version from "@beep/repo-docgen/Version";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

layer(BunServices.layer)("Version", (it) => {
  it.effect("reads the docgen package version from its manifest", () =>
    Effect.map(Version.readModuleVersion(), (version) => {
      expect(version).toBe("0.0.2");
    })
  );
});
