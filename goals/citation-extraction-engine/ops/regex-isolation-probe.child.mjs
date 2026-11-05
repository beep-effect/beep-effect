/** Deliberately blocking maintainer probe child; never a production worker. */
process.on("message", (message) => {
  if (message?.kind !== "match") process.exit(2);
  const regex = new RegExp(message.pattern, message.flags);
  process.send({ kind: "started" }, () => {
    const matched = regex.test(message.text);
    process.send({ kind: "result", matched }, () => process.exit(0));
  });
});
process.send({ kind: "ready", runtime: process.version, bunVersion: globalThis.Bun?.version ?? null });
