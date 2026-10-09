// @effect-diagnostics nodeBuiltinImport:skip-file
// The oracle for the case-insensitive contract: the same suite the memory
// engine runs, against the real filesystem through @effect/platform-node. It
// runs only where os.tmpdir() sits on a case-folding volume (default APFS,
// NTFS); a case-sensitive host skips it, which is the honest outcome there.

import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { caseInsensitiveSuite } from "../CaseInsensitiveContract.ts";

const hostFoldsCase = (() => {
	const probe = mkdtempSync(join(tmpdir(), "memfs-case-"));
	try {
		writeFileSync(join(probe, "probe"), "");
		return existsSync(join(probe, "PROBE"));
	} finally {
		rmSync(probe, { recursive: true, force: true });
	}
})();

caseInsensitiveSuite("node", NodeFileSystem.layer, { skip: !hostFoldsCase });
