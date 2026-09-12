import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const root = 'explorations/effect-schema-parity/research/';
const files = spawnSync('rg', ['--files', '--hidden', 'packages', 'apps'], { encoding: 'utf8', maxBuffer: 20000000 }).stdout.trim().split('\n').filter(p => /^(packages|apps)\/.+\/src\/.+\.(ts|tsx)$/.test(p) && !/(^|\/)(node_modules|dist|\.repos|fixtures|__fixtures__|test|tests|__tests__)(\/|$)/.test(p) && !/\.(test|spec|tst)\.[cm]?tsx?$/.test(p)).sort();
const patterns = {
 F01: String.raw`\bLiteralKit\(`,
 F02: String.raw`\b(?:S|Schema)\.Union\(\[\s*(?:S|Schema)\.Literal\([^\n]+(?:S|Schema)\.Literal\(`,
 F03: String.raw`\b(?:SchemaUtils\.)?(?:withKeyDefaults|withEmptyArrayDefaults|optionalKeyWithDefault|withConstructorDefaults|withEncodeDefault|boolWithDefault)\(`,
 F04: String.raw`\b(?:S|Schema)\.makeFilter\(`,
 F05: String.raw`\b(?:S|Schema)\.decode(?:Unknown)?Sync\(`,
 F06: String.raw`\b(?:S|Schema)\.suspend\(`,
 F07: String.raw`\.\.\.[A-Za-z_$][\w$.]*\.fields\b`,
 F08: String.raw`\b(?:S|Schema)\.mutable\b`,
 F09: String.raw`\b(?:S|Schema)\.ArrayEnsure\b`,
 F10: String.raw`transformOrFail`,
 F11: String.raw`documentation:`,
 F12: String.raw`~standard|toStandardSchemaV1|standardSchemaResolver|effectTsResolver`,
 F13: String.raw`\): [A-Za-z_$][\w$]* is `,
 F14: String.raw`\b(?:S|Schema)\.declare(?:Constructor)?[<(]`,
 F15: String.raw`\bwithCodecStatics\(`,
 F16: String.raw`_tag: (?:S|Schema)\.Literal\(`,
 F17: String.raw`extends (?:Error|Data\.TaggedError|Data\.Error)\b`,
 F18: String.raw`\bmakeStatusCauseError\b`,
 F19: String.raw`\b(?:JSONSchema|JsonSchema|SchemaRepresentation)\.`,
 F20: String.raw`\b(?:Arbitrary|FastCheck|fc)\.|arbitrary:`,
 F21: String.raw`VariantSchema|Model\.Class|FieldOption`,
 F22: String.raw`\b(?:S|Schema)\.brand\(`,
 F23: String.raw`\b(?:S|Schema)\.NullOr\(`,
 F24: String.raw`\b(?:Defect|OpaqueUnknown)\(`,
 F25: String.raw`\b(?:S|Schema)\.toEncoded\(`,
 F26: String.raw`\.annoteError(?:<|\()`,
 F27: String.raw`S\.makeFilterGroup\(\[S\.isGreaterThanOrEqualTo\([^\n]+S\.isLessThanOrEqualTo\(`,
 F28: String.raw`S\.makeFilter\([^\n]*(?:[Uu]nique|[Dd]edupe)`,
 F29: String.raw`S\.makeFilter\(S\.is\(`,
 F30: String.raw`S\.makeFilter\([^\n]*(?:>=|<=|\.test\()`,
};
const selectedId = process.argv[2];
const rows = [];
for (const [id, regex] of Object.entries(patterns)) {
 if (selectedId && selectedId !== id) continue;
 const run = spawnSync('rg', ['--json', '-e', regex, '--', ...files], { encoding: 'utf8', maxBuffer: 50000000 });
 if (![0,1].includes(run.status)) throw Error(run.stderr);
 const matches = run.stdout.split('\n').filter(Boolean).map(JSON.parse).filter(x=>x.type==='match').map(x=>({path:x.data.path.text,line:x.data.line_number,text:x.data.lines.text.trimEnd()})).sort((a,b)=>a.path.localeCompare(b.path)||a.line-b.line);
 rows.push({id,regex,lines:matches.length,files:new Set(matches.map(x=>x.path)).size,matches});
}
if (!selectedId) writeFileSync(root+'idiom-census.json',JSON.stringify({scopeFiles:files.length,scope:files,unit:'matching source lines; comments and generated source retained; not confirmed violations',rows},null,2)+'\n');
for(const r of rows) console.log(`${r.id}\t${r.lines}\t${r.files}\t${r.matches.slice(0,3).map(x=>x.path+':'+x.line+': '+x.text.trim()).join('\n')}`);
console.log('SCOPE FILES', files.length);
