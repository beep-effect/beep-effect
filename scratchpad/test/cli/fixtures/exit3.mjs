#!/usr/bin/env node
process.stdout.write(`home=${process.env.HOME}\n`);
process.stderr.write("error: something failed\n");
let input = "";
process.stdin.on("data", (chunk) => {
	input += chunk;
});
process.stdin.on("end", () => {
	if (input !== "") process.stdout.write(`stdin=${input}\n`);
	process.exit(3);
});
