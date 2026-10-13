import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root = path.resolve(process.argv[2] ?? 'node_modules/lucide-react');
if (JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version !== '0.468.0') throw Error('Use the reviewed Lucide 0.468.0 package');
const groups = {
  documents: 'file-text book-open notebook-pen clipboard-list library folder-open sticky-note newspaper bookmark graduation-cap pen-tool highlighter receipt scroll-text',
  work: 'briefcase-business building-2 chart-no-axes-combined presentation target flag rocket lightbulb calendar-days clock-3 check-check list-todo mail message-circle users',
  technology: 'code-2 terminal cpu database network globe server monitor laptop smartphone camera video headphones mic',
  life: 'house heart smile coffee utensils gift music palette clapperboard gamepad-2 trophy puzzle wallet shopping-bag',
  nature: 'sun moon cloud cloud-rain mountain trees flower-2 leaf sprout paw-print fish bird flame droplet',
  travel: 'compass map map-pin navigation plane train-front car bike ship tent luggage ticket',
  symbols: 'star circle-check circle-help shield-check lock-keyhole key-round sparkles zap infinity anchor atom hash tag gem diamond',
  interface: 'refresh-cw list-filter panels-top-left monitor-play plus x chevron-right info maximize trash-2 type link image table-2 minus check mouse-pointer-2 eraser square circle undo-2 redo-2 download paperclip sigma copy images columns-3 columns-2 separator-horizontal file-minus-2 heading quote list list-ordered align-left align-center align-right indent-increase indent-decrease baseline a-large-small remove-formatting arrow-up arrow-down arrow-up-to-line arrow-down-to-line eye eye-off lock lock-open move-horizontal square-pen'
};
const japanese = { documents:'文書 ノート 本 学習', work:'仕事 計画 タスク 会議', technology:'技術 コード データベース メディア', life:'生活 趣味 音楽 アート', nature:'自然 天気 動物 花', travel:'旅行 地図 交通', symbols:'記号 マーク 星', interface:'画面 操作' };
function value(n) {
  if (ts.isStringLiteral(n)) return n.text;
  if (ts.isNumericLiteral(n)) return Number(n.text);
  if (ts.isArrayLiteralExpression(n)) return n.elements.map(value);
  if (ts.isObjectLiteralExpression(n)) return Object.fromEntries(n.properties.map(p => { if(!ts.isPropertyAssignment(p)) throw Error('Unsupported property'); return [p.name.text, value(p.initializer)]; }));
  throw Error('Non-static SVG data');
}
function read(slug, visited = new Set()) {
  if (!/^[a-z0-9-]+$/.test(slug) || visited.has(slug)) throw Error('Invalid alias'); visited.add(slug);
  const source = ts.createSourceFile(slug, fs.readFileSync(path.join(root,'dist/esm/icons',slug+'.js'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  let result;
  function walk(n) { if(ts.isCallExpression(n) && n.expression.getText(source)==='createLucideIcon') result=value(n.arguments[1]); ts.forEachChild(n,walk); } walk(source);
  if(!result) { const imp=source.statements.find(n=>(ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier?.text.startsWith('./')); if(!imp) throw Error('Missing '+slug); return read(imp.moduleSpecifier.text.slice(2,-3),visited); }
  for(const [tag,attrs] of result) { if(!['path','circle','rect','line','polyline','polygon','ellipse'].includes(tag) || Object.keys(attrs).some(k=>!['d','key','cx','cy','r','x','y','width','height','rx','ry','x1','y1','x2','y2','points','fill'].includes(k))) throw Error('Unsafe shape '+slug+' '+JSON.stringify([tag,attrs])); delete attrs.key; }
  return result;
}
const items = Object.entries(groups).flatMap(([category,slugs])=>slugs.split(' ').map(slug=>({id:slug,category,label:slug.replaceAll('-',' '),keywords:japanese[category],nodes:read(slug)})));
const license=fs.readFileSync(path.join(root,'LICENSE'),'utf8')+'\n'+'MIT License (Feather-derived portions)\nCopyright (c) 2013-2022 Cole Bemis\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n';
const out=path.resolve(process.argv[3] ?? '/tmp/notesLucideIcons.ts');
if(fs.existsSync(out)) throw Error('Output already exists; compare regenerated data before updating reviewed source');
fs.writeFileSync(out,`/** @license Selected Lucide 0.468.0 SVG data.\n${license.split('\n').map(s=>s?' * '+s:' *').join('\n')}\n */\nexport type NotesIconCategory = ${Object.keys(groups).map(k=>JSON.stringify(k)).join(' | ')};\nexport type NotesLucideIcon = { id: string; category: NotesIconCategory; label: string; keywords: string; nodes: readonly (readonly [string, Readonly<Record<string,string | number>>])[] };\nexport const NOTES_LUCIDE_ICONS: readonly NotesLucideIcon[] = ${JSON.stringify(items,null,2)};\nexport const NOTES_LUCIDE_BY_ID = new Map(NOTES_LUCIDE_ICONS.map(icon => [icon.id, icon]));\n`);
console.log(JSON.stringify({icons:items.length,bytes:fs.statSync(out).size,sourceVersion:JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version}));
