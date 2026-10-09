import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as O from "effect/Option";
import { Dependency, isUnresolvedDependency } from "../../effected/package-json/Dependency.ts";

describe("Dependency protocol getters", () => {
	it("classifies a range specifier", () => {
		const dep = Dependency.make({ name: "lodash", specifier: "^4.0.0", kind: "prod" });
		assert.isTrue(dep.isRange);
		assert.isFalse(dep.isWorkspace);
		assert.isFalse(dep.isUnresolved);
		assert.deepStrictEqual(dep.protocol, O.some("range"));
		assertSome(dep.range, O.getOrThrow(dep.range));
	});

	it("classifies workspace/catalog as unresolved", () => {
		const ws = Dependency.make({ name: "lib", specifier: "workspace:*", kind: "prod" });
		assert.isTrue(ws.isWorkspace);
		assert.isTrue(ws.isUnresolved);
		assert.isTrue(isUnresolvedDependency(ws));
		const cat = Dependency.make({ name: "effect", specifier: "catalog:", kind: "dev" });
		assert.isTrue(cat.isCatalog);
		assert.isTrue(cat.isUnresolved);
	});

	it("classifies git, local and tag specifiers", () => {
		assert.isTrue(Dependency.make({ name: "a", specifier: "github:u/r", kind: "prod" }).isGit);
		assert.isTrue(Dependency.make({ name: "a", specifier: "file:../x", kind: "prod" }).isLocal);
		assert.isTrue(Dependency.make({ name: "a", specifier: "link:../x", kind: "prod" }).isLink);
		assert.isTrue(Dependency.make({ name: "a", specifier: "portal:../x", kind: "prod" }).isPortal);
		assert.isTrue(Dependency.make({ name: "a", specifier: "latest", kind: "prod" }).isTag);
	});

	it("empty specifier has no protocol", () => {
		const dep = Dependency.make({ name: "a", specifier: "", kind: "prod" });
		assertNone(dep.protocol);
	});

	it("peer dependencies carry isOptional", () => {
		const peer = Dependency.make({ name: "effect", specifier: "^3.0.0", kind: "peer", isOptional: true });
		assert.strictEqual(peer.kind, "peer");
		assert.isTrue(peer.isOptional);
	});
});
