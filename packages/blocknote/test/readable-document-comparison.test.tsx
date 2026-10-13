import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ReadableDocumentComparison,readableBlockText,mergeComparedDocuments} from '../src/react/ReadableDocumentComparison.js';
import type {EditorDocument} from '@hello-ai-company/editor-core';
const doc=(blocks:EditorDocument['blocks']):EditorDocument=>({schemaVersion:1,blocks});
const block=(id:string,text:string)=>({id,type:'paragraph',content:[{type:'text',text,styles:{}}]});
describe('readable retained comparison',()=>{
 it('renders prose, tables, checklists and nested text without executing payloads',()=>{
  const before=doc([block('a','<script>alert(1)</script>'),{id:'t',type:'table',content:{type:'tableContent',rows:[{cells:[[{type:'text',text:'Cell'}]]}]}},{id:'c',type:'checkListItem',props:{checked:true},content:'Done',children:[block('n','Nested')]}]);
  const markup=renderToStaticMarkup(<ReadableDocumentComparison before={before} after={doc([])}/>);
  expect(markup).toContain('&lt;script&gt;');expect(markup).not.toContain('<script>');expect(markup).toContain('Cell');expect(markup).toContain('Nested');expect(markup).toContain('☑');expect(markup).not.toContain('schemaVersion');
 });
 it('shows exact optional titles, distinguishes an empty title, and escapes markup',()=>{
  const same=doc([block('p','Unchanged body')]);
  const markup=renderToStaticMarkup(<ReadableDocumentComparison before={same} after={same} beforeTitle={'  <img src=x>\nlocal  '} afterTitle=""/>);
  expect(markup).toContain('  &lt;img src=x&gt;\nlocal  ');expect(markup).not.toContain('<img');expect(markup).toContain('［タイトルなし］');
  expect(renderToStaticMarkup(<ReadableDocumentComparison before={same} after={same}/>)).not.toContain('のタイトル');
 });
 it.each([undefined,{}, {type:'tableContent'}, {type:'tableContent',rows:42}])('retains opaque table content without crashing',content=>{expect(readableBlockText({id:'x',type:'future',content:content as never})).toBe('');});
 it('chooses whole roots losslessly, includes explicit deletions and preserves desired order',()=>{
  const local=doc([{...block('a','local'),props:{opaque:{keep:true}},children:[block('child','child')]},block('b','deleted upstream')]);
  const latest=doc([block('a','server'),block('c','added')]);const copy=JSON.stringify([local,latest]);
  const merged=mergeComparedDocuments(local,latest,{a:'local',b:'latest',c:'latest'},'latest');
  expect(merged.blocks.map(x=>x.id)).toEqual(['a','c']);expect(merged.blocks[0]).toEqual(local.blocks[0]);expect(JSON.stringify([local,latest])).toBe(copy);
 });
 it('rejects a moved child selected twice and never mutates either source',()=>{
  const child=block('x','child'),local=doc([{...block('a','parent'),children:[child]}]),latest=doc([block('a','parent'),child]);
  expect(()=>mergeComparedDocuments(local,latest,{a:'local',x:'latest'},'local')).toThrow('移動');
  expect(mergeComparedDocuments(local,latest,{a:'latest',x:'latest'},'latest').blocks).toEqual(latest.blocks);
 });
});

it('shows reviewed callout labels and column geometry without active payloads',()=>{
 const value=doc([{id:'callout',type:'callout',props:{title:'<unsafe>',variant:'warning'},content:'Body'},{id:'columns',type:'oeColumns',props:{gap:16},children:[{id:'left',type:'oeColumn',props:{width:2},children:[block('p','Left')]},{id:'right',type:'oeColumn',props:{width:1},children:[block('q','Right')]}]}]);
 const html=renderToStaticMarkup(<ReadableDocumentComparison before={value} after={value}/>);expect(html).toContain('&lt;unsafe&gt;');expect(html).toContain('warning');expect(html).toContain('Columns: 2');expect(html).toContain('gap 16px');expect(html).toContain('Relative width: 2');expect(html).not.toContain('<unsafe>');
});
