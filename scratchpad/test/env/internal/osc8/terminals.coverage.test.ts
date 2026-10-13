import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { lookupTerminal, NO_CAPS } from "../../../../effected/env/internal/osc8/terminals.ts";

describe("terminal identification edge behaviour", () => {
  it.effect("retains absent and empty program versions without inventing a version", () =>
    Effect.sync(() => {
      for (const program of ["iTerm.app", "Apple_Terminal", "WezTerm", "vscode", "Hyper", "mintty", "ghostty", "Tabby", "rio", "WarpTerminal", "WaveTerminal"]) {
        const missing = lookupTerminal({ TERM_PROGRAM: program });
        assert.deepStrictEqual(missing?.identify, { version: null, rawIdentifier: program });
        const empty = lookupTerminal({ TERM_PROGRAM: program, TERM_PROGRAM_VERSION: "" });
        assert.deepStrictEqual(empty?.identify, { version: "", rawIdentifier: program });
      }
    })
  );

  it.effect("uses kitty's window id fallback, with TERM taking precedence", () =>
    Effect.sync(() => {
      const fallback = lookupTerminal({ KITTY_WINDOW_ID: "42" });
      assert.strictEqual(fallback?.entry.name, "kitty");
      assert.deepStrictEqual(fallback?.identify, { version: null, rawIdentifier: "42" });
      assert.deepStrictEqual(lookupTerminal({ TERM: "xterm-kitty", KITTY_WINDOW_ID: "42" })?.identify, {
        version: null, rawIdentifier: "xterm-kitty"
      });
      assert.strictEqual(lookupTerminal({ KITTY_WINDOW_ID: "" }), null);
    })
  );

  it.effect("ignores empty markers, identifies foot-extra and preserves malformed packed identifiers", () =>
    Effect.sync(() => {
      assert.strictEqual(lookupTerminal({ VTE_VERSION: "", KONSOLE_VERSION: "", WT_SESSION: "", ConEmuPID: "", KITTY_WINDOW_ID: "" }), null);
      assert.strictEqual(lookupTerminal({ TERM: "foot-extra" })?.entry.name, "Foot");
      assert.deepStrictEqual(lookupTerminal({ VTE_VERSION: "bad" })?.identify, { version: null, rawIdentifier: "bad" });
      assert.deepStrictEqual(lookupTerminal({ KONSOLE_VERSION: "bad" })?.identify, { version: null, rawIdentifier: "bad" });
      assert.strictEqual(lookupTerminal({ TERM_PROGRAM: "Apple_Terminal" })?.entry.capabilities, NO_CAPS);
      assert.strictEqual(lookupTerminal({ TERMINOLOGY: "1" })?.entry.capabilities, NO_CAPS);
    })
  );
});
