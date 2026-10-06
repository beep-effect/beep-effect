#!/usr/bin/env node
// fallow-ignore-file unused-file -- run by hand to rebuild the illustrated page; nothing in the workspace graph imports it
// Builds the illustrated "The Agentic Yoyo" page from the canonical article
// (THE_AGENTIC_YOYO.md at the repo root) plus the shell and data in this dir.
// Node stdlib only; output is byte-deterministic for a given input set.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
const mdPath = resolve(here, args.md ?? "../../../../THE_AGENTIC_YOYO.md");
const shellPath = resolve(here, args.shell ?? "shell.html");
if (!args.out) fail("--out <path> is required (the page is published, never served from the repo)");

const md = readFileSync(mdPath, "utf8");
const shell = readFileSync(shellPath, "utf8");
const subdag = JSON.parse(readFileSync(resolve(here, "subdag.json"), "utf8"));
const filesDoc = JSON.parse(readFileSync(resolve(here, "files.json"), "utf8"));
const lanes = JSON.parse(readFileSync(resolve(here, "lanes.json"), "utf8"));

/* ---------------- chapter -> beat map (slug: [beatId, label, ...pairs]) ---------------- */
const BEATS = {
  __intro__: ["throw", "the throw"],
  "the-puzzle-that-started-it": ["checks", "the checks"],
  "turbo-is-a-single-player-game": ["invert", "the inversion"],
  "the-numbers": ["red", "a red check"],
  "the-silver-cord": ["sleeper", "the sleeper"],
  "the-replay-found-a-body": ["severed", "the severed cord", "evict", "the eviction"],
  "the-diary-learned-its-words": ["evict", "the eviction, now written down"],
  "everything-returns-to-the-source": ["return", "the return"],
};

/* ---------------- markdown subset renderer ---------------- */
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function inline(text) {
  // escape first, then re-introduce the few inline forms we use
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
  // bare URLs (Sources list); trailing punctuation stays outside the link
  s = s.replace(
    /(^|[\s(])(https?:\/\/[^\s<)]+?)([.,;:)]*)(?=\s|$)/g,
    (m, pre, url, tail) => `${pre}<a href="${url}">${url}</a>${tail}`
  );
  return s;
}

function beatButtons(slugKey) {
  const spec = BEATS[slugKey];
  if (!spec) return "";
  const out = [];
  for (let i = 0; i < spec.length; i += 2)
    out.push(
      `<button class="beat" type="button" data-beat="${spec[i]}">&#9654; show me &middot; ${esc(spec[i + 1])}</button>`
    );
  return `<div class="beats">${out.join("")}</div>`;
}

// fallow-ignore-next-line complexity -- one-pass markdown renderer for a hand-run docs asset, not product code
function renderMarkdown(src) {
  // article-level comment frame + any other HTML comments are not visible prose
  let text = src;
  if (args["artifact-url"]) {
    text = text.replace(/<!--\s*- The animation: <artifact url>\s*-->/, `- The animation: ${args["artifact-url"]}`);
  }
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  const lines = text.split("\n");
  const chapters = [];
  let cur = { slug: "__intro__", title: null, blocks: [] };
  const push = () => {
    chapters.push(cur);
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^# /.test(line)) {
      i++;
      continue;
    } // page header already carries the h1
    if (/^## /.test(line)) {
      push();
      const title = line.slice(3).trim();
      cur = { slug: slug(title), title, blocks: [] };
      i++;
      continue;
    }
    if (/^#{3,6} /.test(line)) {   // deeper headings stay inside the current chapter
      const level = Math.min(6, line.match(/^#+/)[0].length);
      cur.blocks.push(`<h${level}>${inline(line.replace(/^#+ /, "").trim())}</h${level}>`);
      i++;
      continue;
    }
    if (/^> ?/.test(line)) {
      const q = [];
      while (i < lines.length && /^> ?/.test(lines[i])) {
        q.push(lines[i].replace(/^> ?/, ""));
        i++;
      }
      const body = q.filter((l) => !/^— /.test(l) && !/^-- /.test(l));
      const cite = q.find((l) => /^— |^-- /.test(l));
      cur.blocks.push(
        `<blockquote>${body.map((l) => `<p>${inline(l)}</p>`).join("")}${cite ? `<cite>${inline(cite.replace(/^— |^-- /, ""))}</cite>` : ""}</blockquote>`
      );
      continue;
    }
    if (/^- /.test(line)) {
      const items = [];
      while (i < lines.length && /^- /.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      cur.blocks.push(`<ul>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      cur.blocks.push(`<ol>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</ol>`);
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    // paragraph: consecutive non-blank, non-structural lines
    const p = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6} |>|- |\d+\. )/.test(lines[i])) {
      p.push(lines[i]);
      i++;
    }
    if (p.length === 0) fail(`unhandled markdown at line ${i + 1}: ${lines[i]}`);   // never loop without consuming a line
    cur.blocks.push(`<p>${inline(p.join(" "))}</p>`);
  }
  push();
  return chapters;
}

const chapters = renderMarkdown(md);
const story = chapters
  .map((c) => {
    const head = c.title ? `<h2 id="${c.slug}">${inline(c.title)}</h2>` : "";
    const beats = beatButtons(c.slug);
    return `<section class="chapter" data-slug="${c.slug}">${head}${beats}${c.blocks.join("\n")}</section>`;
  })
  .join("\n");
const nav = chapters
  .filter((c) => c.title)
  .map((c) => `<a href="#${c.slug}">${inline(c.title)}</a>`)
  .join("");

/* ---------------- receipts ---------------- */
const meta = new Map(subdag.nodes.map((n) => [n.n, n]));
const touchedSet = new Set(subdag.touched);
const fanRows = [...subdag.nodes]
  .sort((a, b) => a.hop - b.hop || b.dependents - a.dependents || a.n.localeCompare(b.n))
  .map(
    (n) =>
      `<tr${touchedSet.has(n.n) ? ' class="touched"' : ""}><td>${esc(n.n)}</td><td class="num">${n.hop}</td><td class="num">${n.deps}</td><td class="num">${n.dependents}</td></tr>`
  )
  .join("");
const fileRows = filesDoc.files.map((f) => `<li>${esc(f)}</li>`).join("");
const laneRows = lanes.planner
  .map((l) => `<tr><td><code>${esc(l.id)}</code></td><td>${esc(l.lane)}</td><td>${esc(l.note)}</td></tr>`)
  .join("");
const s7 = lanes.s7;
const j = lanes.journal;
const receipts = `
<details class="receipts-block">
  <summary>The fan: ${subdag.nodes.length} packages, ${subdag.edges.length} dependsOn edges, from commit ${esc(subdag.commit.sha)}</summary>
  <p class="note">Node radius grows with dependents. Touched packages (the three the commit edited) are the yoyo targets; hop-1 packages are what those depend on. Blast radius of the commit across the full 126-package graph: ${subdag.commit.blast}.</p>
  <div class="scroll"><table><thead><tr><th>package</th><th>hop</th><th>deps</th><th>dependents</th></tr></thead><tbody>${fanRows}</tbody></table></div>
</details>
<details class="receipts-block">
  <summary>The beads: the ${subdag.commit.files} files commit ${esc(filesDoc.commit)} edited, as ${filesDoc.files.length} distinct names</summary>
  <p class="note">Bead labels are basenames; two names (package.json, README.md) each cover two of the ${subdag.commit.files} paths.</p>
  <ul class="files">${fileRows}</ul>
</details>
<details class="receipts-block">
  <summary>The chips: real yeet planner steps</summary>
  <p class="note">Fan nodes roll out <code>${lanes.fan.join("</code> <code>")}</code>; the touched package rolls out the full feedback ladder <code>${lanes.touched.join("</code> <code>")}</code>. Chips collapse nearest-first: the cheapest check that can prove you wrong runs first.</p>
  <div class="scroll"><table><thead><tr><th>planner step</th><th>chip</th><th>what it is</th></tr></thead><tbody>${laneRows}</tbody></table></div>
</details>
<details class="receipts-block">
  <summary>The severed cord: S7 differential replay census</summary>
  <div class="scroll"><table><tbody>
    <tr><th>journal events</th><td class="num">${s7.events}</td></tr>
    <tr><th>admitted</th><td class="num">${s7.admitted}</td></tr>
    <tr><th>released</th><td class="num">${s7.released}</td></tr>
    <tr><th>first-choice divergences before inference</th><td class="num">${s7.divergencesBeforeInference.length} (events ${s7.divergencesBeforeInference.join(", ")})</td></tr>
    <tr><th>phantom grant</th><td><code>${esc(s7.evictedNonce)}</code>, weight ${s7.evictedWeight}, admitted at event ${s7.admittedAtEvent}, never released</td></tr>
    <tr><th>inferred eviction</th><td>event ${s7.evictionEvent}, active tokens ${s7.activeBefore} &rarr; ${s7.activeAfter} of ${s7.capacity}</td></tr>
    <tr><th>after inference</th><td class="num">${s7.admitted} of ${s7.admitted} admissions match</td></tr>
    <tr><th>since then</th><td>the journal gained eviction events (2026-09-03) and enqueue/withdraw events (2026-09-08); on ${esc(j.date)} the author's canonical journal held ${j.rows} rows: ${j.enqueued} enqueued, ${j.withdrawn} withdrawn, ${j.admitted} admitted, ${j.released} released, ${j.leaseEvicted} lease evictions, ${j.ticketEvicted} ticket eviction; ${j.admissionsTracedToEnqueue} of ${j.admitted} admissions trace to their enqueue by nonce; protocol <code>${esc(j.protocol)}</code>, eviction emission ${esc(j.evictionEmission)}</td></tr>
    <tr><th>deployed law replayed</th><td>charge + weight &le; ${s7.capacity}; publish ahead of verify with ${s7.publishAgingSeconds}s aging; review-fix cap ${s7.reviewFixClassCap}; weights full-proof ${s7.weights["full-proof"]}, merged-preview ${s7.weights["merged-preview"]}, review-fix ${s7.weights["review-fix"]}, publish ${s7.weights.publish}</td></tr>
  </tbody></table></div>
</details>`;

/* ---------------- assemble ---------------- */
const revised = (md.match(/revised\s+(\d{4}-\d{2}-\d{2})/) || [, "undated"])[1];
const DATA = JSON.stringify({
  nodes: subdag.nodes,
  edges: subdag.edges,
  touched: subdag.touched,
  commit: subdag.commit,
  files: filesDoc.files,
  lanes: { fan: lanes.fan, touched: lanes.touched },
  s7: {
    evictionEvent: s7.evictionEvent,
    evictedWeight: s7.evictedWeight,
    activeBefore: s7.activeBefore,
    activeAfter: s7.activeAfter,
    capacity: s7.capacity,
  },
});

const required = ["<!--STORY-->", "<!--NAV-->", "<!--RECEIPTS-->", "__DATA__", "__REVISED__"];
for (const r of required) if (!shell.includes(r)) fail(`shell.html is missing placeholder ${r}`);
const body = shell
  .replace("<!--STORY-->", story)
  .replace("<!--NAV-->", nav)
  .replace("<!--RECEIPTS-->", receipts)
  .replace("__DATA__", () => DATA)
  .replace("__REVISED__", revised);
// The Artifact host wraps the body in its own doctype/head/body skeleton; a local file
// preview needs the same wrapper or the browser drops into quirks mode (--standalone).
const page = args.standalone
  ? `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n${body}\n</body>\n</html>\n`
  : body;

const outPath = resolve(process.cwd(), args.out);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, page);
process.stdout.write(
  `built ${outPath}\n  chapters ${chapters.filter((c) => c.title).length}  bytes ${Buffer.byteLength(page)}\n`
);

/* ---------------- helpers ---------------- */
// fallow-ignore-next-line complexity -- flat argv switch for a hand-run docs asset, not product code
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[k] = v;
    }
  }
  return out;
}
function fail(msg) {
  process.stderr.write(`build.mjs: ${msg}\n`);
  process.exit(1);
}
