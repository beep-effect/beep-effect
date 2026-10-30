import {
  CacheConformanceProxyEvent,
  CacheConformanceProxyOptions,
  CacheRuntimeProcess,
  makeCacheConformanceSocketProxy,
} from "@beep/repo-cli/test/Cache";
import { Sha256HexFromBytes } from "@beep/schema";
import { currentHostPlatform } from "@beep/utils/HostProcess";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Headers from "effect/http/Headers";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
  bearers,
  goodMode,
  makeConformanceServer,
  repoRoot,
  secrets,
  targetFor,
  teamId,
} from "./cache-conformance-server.ts";
import type * as NetAddress from "effect/net/NetAddress";

const nativeBun = O.isSome(O.fromUndefinedOr(process.versions.bun));
const testName = "preserves upstream policy, bounded capture and private socket lifetime in native Bun";
const encodeEvents = S.encodeEffect(S.fromJsonString(S.Array(CacheConformanceProxyEvent)));
const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const Services = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, FetchHttpClient.layer);

it.layer(Services, { timeout: "60 seconds", excludeTestServices: true })((it) => {
  it.effect.skipIf(currentHostPlatform !== "linux")(
    testName,
    Effect.fn("CachePrivateSocketTest.nativeLifecycle")(function* () {
      const path = yield* Path.Path;
      const root = yield* repoRoot;
      if (!nativeBun) {
        const native = yield* CacheRuntimeProcess.runCaptured({
          command: "bun",
          args: [
            path.join(root, "node_modules/vitest/vitest.mjs"),
            "run",
            path.join(root, "packages/tooling/tool/cli/test/cache-private-socket.test.ts"),
            "--testNamePattern",
            testName,
            "--fileParallelism=false",
            "--maxWorkers=1",
          ],
          cwd: root,
          bound: CacheRuntimeProcess.OutputBound.make({
            maxChars: 16 * 1024,
            truncatedNotice: "private socket lifecycle output exceeded its bound",
          }),
          timeout: "45 seconds",
          source: "merge",
        });
        expect(native.exitCode, native.output).toBe(0);
        expect(native.truncated).toBe(false);
        return;
      }
      const fs = yield* FileSystem.FileSystem;
      const saved = yield* Ref.make(O.none<Redacted.Redacted<NetAddress.UnixPathAddress>>());
      const upstream = yield* makeConformanceServer({ ...goodMode, responseCacheResult: "allowed" });
      const bytes = new TextEncoder().encode("opaque private socket artifact");
      const tag = "opaque-private-tag";
      const taskHash = "0123456789abcdef";
      const expectedBody = yield* hashBytes(bytes);
      const expectedTag = yield* hashBytes(new TextEncoder().encode(tag));
      const events = yield* Effect.scoped(
        Effect.gen(function* () {
          const proxy = yield* makeCacheConformanceSocketProxy(
            CacheConformanceProxyOptions.make({
              target: targetFor({ url: upstream.url }),
              bearers,
              holdMs: 25,
              maxEvents: 4,
              maxBodyBytes: 1024,
              maxCaptureBytes: 4096,
            })
          );
          yield* Ref.set(saved, O.some(proxy.address));
          const address = Redacted.value(proxy.address);
          expect((yield* fs.stat(address.path)).mode & 0o777).toBe(0o600);
          expect((yield* fs.stat(path.dirname(address.path))).mode & 0o777).toBe(0o700);
          expect(proxy.address.toString()).not.toContain(address.path);
          const agent = yield* NodeHttpClient.makeAgent({ socketPath: address.path });
          const client = yield* NodeHttpClient.makeNodeHttp.pipe(
            Effect.provideService(NodeHttpClient.HttpAgent, agent)
          );
          // Port zero is never a usable fallback endpoint; the agent owns the socket.
          const endpoint = `http://127.0.0.1:0/v8/artifacts/${taskHash}?teamId=${teamId}`;
          const upload = Effect.fn("CachePrivateSocketTest.upload")((token: string) =>
            HttpClientRequest.put(endpoint).pipe(
              HttpClientRequest.setHeaders({ authorization: `Bearer ${token}`, "x-artifact-tag": tag }),
              HttpClientRequest.bodyUint8Array(bytes),
              client.execute,
              Effect.flatMap((response) => response.text.pipe(Effect.as(response.status)))
            )
          );
          expect(yield* upload(secrets.writer)).toBe(200);
          const restored = yield* client.get(endpoint, {
            headers: { authorization: `Bearer ${secrets.reader}` },
          });
          expect(restored.status).toBe(200);
          assertSome(Headers.get(restored.headers, "x-artifact-tag"), tag);
          expect(new Uint8Array(yield* restored.arrayBuffer)).toEqual(bytes);
          expect(yield* upload(secrets.reader)).toBe(403);
          const finalRead = yield* client.get(endpoint, {
            headers: { authorization: `Bearer ${secrets.reader}` },
          });
          expect(finalRead.status).toBe(200);
          expect(new Uint8Array(yield* finalRead.arrayBuffer)).toEqual(bytes);
          const observed = yield* proxy.events;
          expect(observed).toHaveLength(4);
          const put = O.getOrThrow(A.get(observed, 0));
          const get = O.getOrThrow(A.get(observed, 1));
          const denied = O.getOrThrow(A.get(observed, 2));
          expect(put.exchange.role).toBe("writer");
          assertSome(put.exchange.requestSha256, expectedBody);
          assertSome(put.exchange.requestTagSha256, expectedTag);
          assertSome(put.exchange.backendResult, "allowed");
          expect(put.exchange.requestBytes).toBe(bytes.byteLength);
          expect(get.exchange.role).toBe("reader");
          assertNone(get.exchange.requestTagSha256);
          assertTrue(get.exchange.tagPresent);
          assertSome(get.exchange.responseSha256, expectedBody);
          expect(denied.exchange.role).toBe("reader");
          assertSome(denied.exchange.status, 403);
          // The fixture's incompatible allowed header cannot become successful-write evidence.
          assertSome(denied.exchange.backendResult, "invalid-evidence");
          const encoded = yield* encodeEvents(observed);
          for (const value of [secrets.reader, secrets.writer, tag, address.path, new TextDecoder().decode(bytes)])
            expect(encoded).not.toContain(value);
          const exhausted = yield* client.get(endpoint, {
            headers: { authorization: `Bearer ${secrets.reader}` },
          });
          expect(exhausted.status).toBe(503);
          yield* exhausted.text;
          (yield* proxy.events.pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
          return observed;
        })
      );
      expect(events).toHaveLength(4);
      const address = yield* Ref.get(saved).pipe(Effect.map(O.getOrThrow), Effect.map(Redacted.value));
      expect(yield* fs.exists(address.path)).toBe(false);
      expect(yield* fs.exists(path.dirname(address.path))).toBe(false);
    })
  );
});
