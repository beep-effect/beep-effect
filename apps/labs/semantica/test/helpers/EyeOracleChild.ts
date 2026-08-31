import * as A from "effect/Array";
import * as Str from "effect/String";
import { queryOnce, SwiplEye } from "eyereasoner";

const [rulesPath, dataPath, queryPath, mode] = A.drop(process.argv, 2);

if (rulesPath === undefined || dataPath === undefined || mode === undefined) {
  process.stderr.write("Expected rules, data, optional query, and mode arguments.\n");
  process.exit(2);
}

const output: Array<string> = [];
const module = await SwiplEye({ arguments: ["-q"], print: (text: string) => output.push(text) });
module.FS.writeFile("rules.n3", await Bun.file(rulesPath).text());
const readInput = (input: string): string => Buffer.from(Str.slice(7)(input), "base64").toString("utf8");
const data = Str.startsWith("base64:")(dataPath) ? readInput(dataPath) : await Bun.file(dataPath).text();
if (Buffer.byteLength(data) > 65_536) {
  process.stderr.write("EYE oracle input exceeded 65536 bytes.\n");
  process.exit(3);
}
module.FS.writeFile("data.n3", data);

const args = ["--restricted", "--quiet", "rules.n3", "data.n3"];
if (mode === "closure") {
  queryOnce(module, "main", [...args, "--nope", "--pass-only-new"]);
} else if (queryPath !== undefined) {
  module.FS.writeFile(
    "query.n3",
    Str.startsWith("base64:")(queryPath) ? readInput(queryPath) : await Bun.file(queryPath).text()
  );
  queryOnce(module, "main", [...args, "--query", "query.n3"]);
} else {
  process.stderr.write("Proof mode requires a query path.\n");
  process.exit(2);
}

const rendered = output.join("\n");
if (Buffer.byteLength(rendered) > 1_048_576) {
  process.stderr.write("EYE oracle output exceeded 1048576 bytes.\n");
  process.exit(4);
}
process.stdout.write(rendered);
