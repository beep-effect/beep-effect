import assert from "node:assert/strict";
import { once } from "node:events";
import { createRequire } from "node:module";
import net from "node:net";

// Resolve the exact transitive chain installed for the Box SDK, not a second test dependency.
const rootRequire = createRequire(`${process.argv[2]}/package.json`);
const boxRequire = createRequire(rootRequire.resolve("box-node-sdk"));
const proxyRequire = createRequire(boxRequire.resolve("proxy-agent"));
const pacRequire = createRequire(proxyRequire.resolve("pac-proxy-agent"));
const require = createRequire(pacRequire.resolve("get-uri"));
const { getUri } = pacRequire("get-uri");
const { parseList } = require("basic-ftp/dist/parseList.js");
assert.equal(require("basic-ftp/package.json").version, rootRequire("./package.json").overrides["basic-ftp"]);

const sockets = new Set();
const passives = new Set();
const commands = [];
const payload = 'function FindProxyForURL(url, host) { return "DIRECT"; }\n';
const server = net.createServer((socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
  socket.write("220 fixture ready\r\n");
  let buffer = "";
  let dataConnection;
  let chain = Promise.resolve();
  socket.on("data", (chunk) => {
    buffer += chunk;
    let at;
    while ((at = buffer.indexOf("\r\n")) >= 0) {
      const line = buffer.slice(0, at);
      buffer = buffer.slice(at + 2);
      chain = chain
        .then(async () => {
          const [verb, ...parts] = line.split(" ");
          const arg = parts.join(" ");
          commands.push(verb);
          if (verb === "USER") socket.write("331 password required\r\n");
          else if (verb === "PASS") socket.write("230 logged in\r\n");
          else if (verb === "FEAT") socket.write("211 no extensions\r\n");
          else if (verb === "MDTM") socket.write(arg === "/missing" ? "550 missing\r\n" : "213 20260901000000\r\n");
          else if (verb === "EPSV") {
            const passive = net.createServer();
            passives.add(passive);
            dataConnection = once(passive, "connection").then(([data]) => {
              sockets.add(data);
              data.on("close", () => sockets.delete(data));
              return data;
            });
            passive.listen(0, "127.0.0.1");
            await once(passive, "listening");
            socket.write(`229 Entering Extended Passive Mode (|||${passive.address().port}|)\r\n`);
          } else if (verb === "RETR") {
            socket.write("150 opening data\r\n");
            const data = await dataConnection;
            data.end(payload);
            await once(data, "close");
            socket.write("226 transfer complete\r\n");
          } else if (verb === "QUIT") socket.end("221 bye\r\n");
          else socket.write("200 accepted\r\n");
        })
        .catch((error) => {
          socket.destroy(error);
        });
    }
  });
});
const deadline = setTimeout(() => {
  console.error("fixture timeout");
  process.exit(1);
}, 10000);
try {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `ftp://127.0.0.1:${server.address().port}`;
  const stream = await getUri(`${base}/proxy.pac`);
  let actual = "";
  for await (const chunk of stream) actual += chunk;
  assert.equal(actual, payload);
  assert.equal(stream.lastModified.toISOString(), "2026-09-01T00:00:00.000Z");
  await assert.rejects(getUri(`${base}/missing`), (e) => e.code === "ENOTFOUND");
  await assert.rejects(getUri(`${base}/proxy.pac`, { cache: stream }), (e) => e.code === "ENOTMODIFIED");
  const start = performance.now();
  const rows = parseList(`-rw-r--r-- 1 ${"a ".repeat(65536)}!\r\n-rw-r--r-- 1 owner group 42 Jan 1 2020 file.txt\r\n`);
  const elapsed = performance.now() - start;
  assert(rows.some((x) => x.name === "file.txt"));
  assert(elapsed < 1000, `listing parser took ${elapsed}ms`);
  console.log(
    JSON.stringify({
      getUriVersion: require("get-uri/package.json").version,
      basicFtpVersion: require("basic-ftp/package.json").version,
      download: "exact payload",
      missing: "ENOTFOUND",
      cache: "ENOTMODIFIED",
      parserMilliseconds: elapsed,
      commands,
    })
  );
} finally {
  clearTimeout(deadline);
  for (const s of sockets) s.destroy();
  for (const p of passives) p.close();
  server.close();
}
