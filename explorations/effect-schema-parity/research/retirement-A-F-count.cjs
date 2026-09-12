// Read-only source audit; writes evidence only alongside this script.
const fs = require('fs'), path = require('path'), ts = require('typescript');
const out = __dirname, base = 'packages/foundation/modeling/schema/src/';
const files = fs.readFileSync(path.join(out,'retirement-A-F-source-files.txt'),'utf8').trim().split('\n');
const concepts = [...new Set(files.map(f=>f.slice(base.length).split('/')[0].replace(/\.ts$/,'')))].sort();
const conceptOf = f => f.startsWith(base) ? f.slice(base.length).split('/')[0].replace(/\.ts$/,'') : null;
const cache = new Map();
function exported(f) {
 if(cache.has(f)) return cache.get(f);
 const result = new Map(); cache.set(f,result);
 if(!fs.existsSync(f))return result;
 const sf=ts.createSourceFile(f,fs.readFileSync(f,'utf8'),ts.ScriptTarget.Latest,true);
 for(const n of sf.statements){
  if(ts.isExportDeclaration(n)){
   const target=n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier)?path.normalize(path.join(path.dirname(f),n.moduleSpecifier.text)):null;
   if(n.exportClause&&ts.isNamespaceExport(n.exportClause)){result.set(n.exportClause.name.text,conceptOf(target||f));continue;}
   const imported=target?exported(target):result;
   if(n.exportClause&&ts.isNamedExports(n.exportClause))for(const e of n.exportClause.elements)result.set(e.name.text,imported.get((e.propertyName||e.name).text)||conceptOf(target||f));
   else if(target)for(const [name,c] of imported)result.set(name,c);
  }else if(n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)){
   if(ts.isVariableStatement(n))for(const d of n.declarationList.declarations)if(ts.isIdentifier(d.name))result.set(d.name.text,conceptOf(f));
   else {}
   if(n.name&&ts.isIdentifier(n.name))result.set(n.name.text,conceptOf(f));
  }
 }
 return result;
}
const root = exported(base+'index.ts'), hits=Object.fromEntries(concepts.map(c=>[c,new Set()])), unresolved=[];
const candidates=fs.readFileSync(path.join(out,'retirement-A-F-import-candidates.txt'),'utf8').trim().split('\n');
function add(c,f){if(hits[c])hits[c].add(f);}
for(const f of candidates){
 const sf=ts.createSourceFile(f,fs.readFileSync(f,'utf8'),ts.ScriptTarget.Latest,true), namespaces=new Set();
 for(const n of sf.statements){
  if(!ts.isImportDeclaration(n)&&!ts.isExportDeclaration(n))continue;
  const spec=n.moduleSpecifier?.text;if(!spec?.startsWith('@beep/schema'))continue;
  if(spec.startsWith('@beep/schema/')){let c=spec.slice('@beep/schema/'.length).split('/')[0];if(c==='FileDiff')c='FileDiff.schema';add(c,f);continue;}
  if(spec!=='@beep/schema')continue;
  const cl=ts.isImportDeclaration(n)?n.importClause?.namedBindings:n.exportClause;
  if(cl&&(ts.isNamespaceImport(cl)||ts.isNamespaceExport(cl))){namespaces.add(cl.name.text);if(ts.isNamespaceExport(cl))unresolved.push({file:f,kind:'root namespace reexport'});}
  else if(cl&&(ts.isNamedImports(cl)||ts.isNamedExports(cl)))for(const e of cl.elements)add(root.get((e.propertyName||e.name).text),f);
  else if(ts.isExportDeclaration(n))unresolved.push({file:f,kind:'root export star'});
 }
 function walk(n){
  if(ts.isPropertyAccessExpression(n)&&ts.isIdentifier(n.expression)&&namespaces.has(n.expression.text))add(root.get(n.name.text),f);
  if(ts.isQualifiedName(n)&&ts.isIdentifier(n.left)&&namespaces.has(n.left.text))add(root.get(n.right.text),f);
  if(ts.isElementAccessExpression(n)&&ts.isIdentifier(n.expression)&&namespaces.has(n.expression.text)){
   if(n.argumentExpression&&ts.isStringLiteral(n.argumentExpression))add(root.get(n.argumentExpression.text),f);else unresolved.push({file:f,kind:'computed namespace access'});
  }
  if(ts.isImportTypeNode(n)&&ts.isLiteralTypeNode(n.argument)&&ts.isStringLiteral(n.argument.literal)){
    const spec=n.argument.literal.text;if(spec.startsWith('@beep/schema/'))add(spec.slice(13).split('/')[0],f);
    else if(spec==='@beep/schema'&&n.qualifier){let q=n.qualifier;while(ts.isQualifiedName(q))q=q.left;add(root.get(q.text),f);}
  }
  ts.forEachChild(n,walk);
 }
 walk(sf);
}
const evidence=Object.fromEntries(concepts.map(c=>[c,{count:hits[c].size,files:[...hits[c]].sort(),rootNames:[...root].filter(([n,x])=>x===c).map(([n])=>n)}]));
fs.writeFileSync(path.join(out,'retirement-A-F-consumers.json'),JSON.stringify({method:'rg candidate census plus TypeScript syntax import/root member resolution; no transitive reexport closure',concepts:evidence,unresolved},null,2)+'\n');
for(const [c,e]of Object.entries(evidence))console.log(c+'\t'+e.count+'\t'+e.rootNames.join(','));console.log('unresolved',JSON.stringify(unresolved));
