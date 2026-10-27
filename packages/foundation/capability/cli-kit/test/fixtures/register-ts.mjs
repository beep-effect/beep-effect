// `node --import register-ts.mjs fixture.mts` runs a fixture against the package sources without a build. Node's type
// stripping runs `.ts` files as they are, but the sources import `./X.js` for `./X.ts`; this resolve hook maps a
// relative `.js` specifier to its `.ts` sibling when only the `.ts` exists.
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodeURL from "node:url";

NodeModule.registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && specifier.endsWith(".js") && context.parentURL?.startsWith("file:")) {
      const candidate = new URL(specifier.replace(/\.js$/, ".ts"), context.parentURL);
      if (NodeFS.existsSync(NodeURL.fileURLToPath(candidate))) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  },
});
