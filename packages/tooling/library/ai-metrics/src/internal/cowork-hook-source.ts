/** Standalone plugin callback: transient positive projection, silent output, one local send. */
export const coworkHookSource = String.raw`import { createConnection } from "node:net";
import { randomUUID } from "node:crypto";
// This executable reads only its own public source selector and configured socket argument.
// It never opens transcript paths, user configuration, credentials or process environments.
let socket;
const finish = () => { socket?.destroy(); process.exit(0); };
const timer = setTimeout(finish, 1200);
try {
  if (process.env.CLAUDE_CODE_ENTRYPOINT === "local-agent") {
    const socketPath = process.argv[2];
    if (typeof socketPath === "string" && /^\/[A-Za-z0-9_./-]{1,106}$/.test(socketPath)) {
      let size = 0;
      const chunks = [];
      for await (const chunk of process.stdin) {
        size += chunk.byteLength;
        if (size > 8192) throw 0;
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const start = body.hook_event_name === "SessionStart";
      const end = body.hook_event_name === "SessionEnd";
      const starts = ["startup", "resume", "clear", "compact", "fork"];
      const ends = ["clear", "resume", "logout", "prompt_input_exit", "other"];
      if (typeof body.session_id !== "string" || body.session_id.length < 1 || body.session_id.length > 256 ||
          !(start && starts.includes(body.source) && body.reason === undefined ||
            end && ends.includes(body.reason) && body.source === undefined)) throw 0;
      const callback = {hook_event_name: body.hook_event_name, session_id: body.session_id,
        ...(start ? {source: body.source} : {reason: body.reason})};
      const projected = JSON.stringify({occurrenceId: randomUUID(), selector: "local-agent", callback});
      await new Promise((resolve) => {
        let received = 0;
        socket = createConnection({path: socketPath, allowHalfOpen: true});
        socket.once("connect", () => socket.end(projected));
        socket.on("data", (chunk) => { received += chunk.byteLength; if (received > 1024) socket.destroy(); });
        socket.once("error", resolve);
        socket.once("close", resolve);
        socket.once("end", () => { socket.destroy(); resolve(); });
      });
    }
  }
} catch {
  // No exception text, hook body or context is printed, even when a callback cannot be delivered.
} finally {
  clearTimeout(timer);
  finish();
}
`;
