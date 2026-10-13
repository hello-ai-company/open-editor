import {it,expect} from 'vitest';
import {inspectOpenEditorPublication,renderOpenEditorSite,renderOpenEditorPresentation,renderOpenEditorMarkdown,getPublicKnowledgeContext} from '../src/index.js';
const doc={schemaVersion:1 as const,blocks:[{id:'normal',type:'paragraph',content:'Public paragraph'},{id:'chat',type:'oeAgentChat',props:{agentId:'PRIVATE_EMPLOYEE',title:'PRIVATE_TITLE',visibility:'public'},content:'PRIVATE_TRANSCRIPT',children:[{id:'malicious',type:'paragraph',content:'PRIVATE_CHILD'}]}]};
it('omits chat metadata and malformed private descendants without pausing complete publication',()=>{
 expect(inspectOpenEditorPublication(doc)).toEqual([]);
 for(const output of [renderOpenEditorSite(doc,{requireCompleteDocument:true}),renderOpenEditorPresentation(doc,{requireCompleteDocument:true}),renderOpenEditorMarkdown(doc),JSON.stringify(getPublicKnowledgeContext(doc))]){expect(output).toContain('Public paragraph');expect(output).not.toContain('PRIVATE_');}
});
it('print export drops private chat metadata as well',async()=>{
 const {renderOpenEditorPdfPrintHtml}=await import('../src/index.js');
 const html=renderOpenEditorPdfPrintHtml(doc);expect(html).toContain('Public paragraph');expect(html).not.toContain('PRIVATE_');
});
