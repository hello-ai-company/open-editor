import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// Local-only candidate artifacts. Does not alter release manifests, install or publish.
const root=resolve(import.meta.dirname,'../..'), output=join(root,'output/candidate');
mkdirSync(output,{recursive:true});
const stage=mkdtempSync(join(tmpdir(),'oe-notes-candidate-')), inventory=[];
for(const name of ['blocknote','ai']) {
  const src=join(root,'packages',name), directory=join(stage,name); mkdirSync(directory);
  for(const file of ['dist','LICENSE','README.md']) cpSync(join(src,file),join(directory,file),{recursive:true});
  const manifest=JSON.parse(readFileSync(join(src,'package.json'),'utf8'));
  manifest.version='0.3.0-notes.0'; delete manifest.scripts; delete manifest.devDependencies; delete manifest.publishConfig;
  cpSync(join(root,'docs/notes-candidate-handoff.md'),join(directory,'CANDIDATE.md'));
  manifest.files.push('CANDIDATE.md');
  writeFileSync(join(directory,'package.json'),JSON.stringify(manifest,null,2)+'\n');
  const packed=JSON.parse(execFileSync('npm',['pack','--ignore-scripts','--json','--pack-destination',output,'--cache',join(stage,'cache')],{cwd:directory,encoding:'utf8'}))[0];
  const file=join(output,packed.filename), bytes=readFileSync(file);
  inventory.push({name:manifest.name,version:manifest.version,filename:packed.filename,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),integrity:packed.integrity,files:packed.files.map(f=>f.path)});
}
const consumer=join(stage,'consumer'), modules=join(consumer,'node_modules');mkdirSync(modules,{recursive:true});
for(const entry of readdirSync(join(root,'node_modules'))) {
  if(entry==='@hello-ai-company') continue;
  symlinkSync(join(root,'node_modules',entry),join(modules,entry));
}
const scope=join(modules,'@hello-ai-company');mkdirSync(scope);
symlinkSync(join(root,'packages/core'),join(scope,'editor-core'));
for(const entry of inventory) {
  const destination=join(scope,entry.name.split('/')[1]);mkdirSync(destination);
  execFileSync('tar',['-xzf',join(output,entry.filename),'--strip-components=1','-C',destination]);
  if(!existsSync(join(destination,'dist/index.d.ts'))) throw new Error('Missing public declarations');
}
writeFileSync(join(consumer,'package.json'),' {"type":"module"}\n');
const source=`import { createDocumentColumns, updateDocumentColumns, importLegacyNotesBlocks, exportLegacyNotesBlocks, createHtmlWidgetPreview, createDocumentWorkspaceFeature, createDocumentTypographyFeature } from '@hello-ai-company/editor-blocknote';
import { createDurableReviewCoordinator, createQuietCooperationSession, type QuietCooperationSnapshot } from '@hello-ai-company/editor-ai';
import { QuietCooperationCard } from '@hello-ai-company/editor-blocknote/react';
import { createEditorDocument } from '@hello-ai-company/editor-core';
const initial = [{ id:'human',type:'paragraph',text:'日本語',version:4,sourceId:'host-id',custom:{keep:true} }];
const imported=importLegacyNotesBlocks(initial);
if(JSON.stringify(exportLegacyNotesBlocks(imported.document,imported.archive,initial))!==JSON.stringify(initial)) throw new Error('Legacy no-op loss');
const columns=createDocumentColumns([[{id:'left',type:'paragraph',content:'left'}],[{id:'right',type:'paragraph',content:'right'}]]);
updateDocumentColumns(createEditorDocument([columns]),{type:'width',columnId:columns.children![0]!.id,width:2});
if(!createHtmlWidgetPreview({html:'<p>safe</p>',css:'',javascript:'alert(1)'}).includes("script-src 'none'")) throw new Error('Widget policy');
const session=createQuietCooperationSession({document:imported.document,agentId:'local',purpose:'Check export',provider:{prepare:async()=>{throw new Error('No model calls');},cancel:async()=>{}}});
const snapshot:QuietCooperationSnapshot=session.getSnapshot(); if(snapshot.enabled)throw new Error('Unexpected opt-in');session.dispose();
if([createDurableReviewCoordinator,createDocumentWorkspaceFeature,createDocumentTypographyFeature,QuietCooperationCard].some(value=>typeof value!=='function'))throw new Error('Missing public export');
console.log('Candidate public runtime and declarations PASS');
`;
writeFileSync(join(consumer,'index.ts'),source);
execFileSync(process.execPath,[join(root,'node_modules/typescript/bin/tsc'),'index.ts','--module','NodeNext','--moduleResolution','NodeNext','--target','ES2022','--skipLibCheck','--strict','--outDir','compiled'],{cwd:consumer,stdio:'pipe'});
const runtime=execFileSync(process.execPath,['compiled/index.js'],{cwd:consumer,encoding:'utf8'});
writeFileSync(join(output,'manifest.json'),JSON.stringify({localOnly:true,published:false,sourceHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),workingTree:execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:root,encoding:'utf8'}).trim().length>0,corePeer:'existing @hello-ai-company/editor-core ^0.2.0',consumerValidation:runtime.trim(),packages:inventory},null,2)+'\n');
console.log(JSON.stringify({output,packages:inventory.map(({files,...entry})=>entry),consumer:runtime.trim()},null,2));
