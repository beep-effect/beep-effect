// The host platform the real-process suites run on. `ActionCache`, `Artifact`,
// `ToolInstaller`, `PackageManagerInstaller` and `DetachedProcess` are tested
// against the real `tar`, `unzip`, installer tarballs and detached children,
// which read and write the real filesystem; an in-memory volume cannot host a
// child process. The suites reach the platform through this one module: the
// Effect services for the code under test, and the host builtins the fixtures
// stage files, spawn children and bind sockets with, loaded the way the
// package's own `src` loads builtins (`process.getBuiltinModule`), so no suite
// imports a builtin.

import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Layer from "effect/Layer";
import type * as Digest from "effect/crypto/Digest";

/**
 * The Node platform services (filesystem, path, spawner, terminal) the real-process suites provide, plus the
 * `Digest` family the cache key and artifact hashing read (`NodeServices` no longer bundles crypto).
 */
export const nativePlatform: Layer.Layer<NodeServices.NodeServices | Digest.Digest> = Layer.mergeAll(
  NodeServices.layer,
  NodeCrypto.layerDigest
);

/** The host's `node:fs`; the fixtures use its synchronous members. */
export const hostFs: typeof import("node:fs") = process.getBuiltinModule("node:fs");

/** The host's `node:os`, for the temp root the fixtures stage scratch directories under. */
export const hostOs: typeof import("node:os") = process.getBuiltinModule("node:os");

/** The host's `node:path`. */
export const hostPath: typeof import("node:path") = process.getBuiltinModule("node:path");

/** The host's `node:child_process`, for the fixtures that run a real child to completion. */
export const hostChildProcess: typeof import("node:child_process") = process.getBuiltinModule("node:child_process");

/** The host's `node:http`, for the probe suites' local servers. */
export const hostHttp: typeof import("node:http") = process.getBuiltinModule("node:http");

/** The host's `node:crypto`, for the fixtures that digest staged bytes. */
export const hostCrypto: typeof import("node:crypto") = process.getBuiltinModule("node:crypto");

/** A local HTTP server the probe suites bind. */
export type HttpServer = import("node:http").Server;

/** The response handle a probe suite's server answers with. */
export type HttpServerResponse = import("node:http").ServerResponse;
