import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// Local-only candidate artifacts. Does not alter release manifests, install or publish.
const version=process.argv[2];
if(!/^0\.3\.0-notes\.[1-9]\d*$/.test(version??'')) throw new Error('Pass a new explicit candidate version, e.g. 0.3.0-notes.1');
const notesV2 = Number(version.split('.').at(-1)) >= 8;
const notesV9 = Number(version.split('.').at(-1)) >= 9;
const notesV12 = Number(version.split('.').at(-1)) >= 12;
const notesV13 = Number(version.split('.').at(-1)) >= 13;
const notesV14 = Number(version.split('.').at(-1)) >= 14;
const notesV15 = Number(version.split('.').at(-1)) >= 15;
const notesV16 = Number(version.split('.').at(-1)) >= 16;
const notesV17 = Number(version.split('.').at(-1)) >= 17;
const notesV18 = Number(version.split('.').at(-1)) >= 18;
const notesV21 = Number(version.split('.').at(-1)) >= 21;
const notesV22 = Number(version.split('.').at(-1)) >= 22;
const notesV23 = Number(version.split('.').at(-1)) >= 23;
const notesV24 = Number(version.split('.').at(-1)) >= 24;
const notesV27 = Number(version.split('.').at(-1)) >= 27;
const notesV33 = Number(version.split('.').at(-1)) >= 33;
const notesV36 = Number(version.split('.').at(-1)) >= 36;
const notesV35 = Number(version.split('.').at(-1)) >= 35;
const notesV34 = Number(version.split('.').at(-1)) >= 34;
const notesV32 = Number(version.split('.').at(-1)) >= 32;
const notesV31 = Number(version.split('.').at(-1)) >= 31;
const notesV30 = Number(version.split('.').at(-1)) >= 30;
const notesV28 = Number(version.split('.').at(-1)) >= 28;
const notesV26 = Number(version.split('.').at(-1)) >= 26;
const notesV20 = Number(version.split('.').at(-1)) >= 20;
const notesV19 = Number(version.split('.').at(-1)) >= 19;
const root=resolve(import.meta.dirname,'../..'), output=join(root,'output/candidate',version);
if(existsSync(output)) throw new Error('Candidate directory already exists; never overwrite an acceptance artifact');
mkdirSync(output,{recursive:true});
const stage=mkdtempSync(join(tmpdir(),'oe-notes-candidate-')), inventory=[];
for(const name of (notesV21 ? ['blocknote','ai','canvas','publish'] : ['blocknote','ai'])) {
  const src=join(root,'packages',name), directory=join(stage,name); mkdirSync(directory);
  for(const file of ['dist','LICENSE','README.md']) cpSync(join(src,file),join(directory,file),{recursive:true});
  const manifest=JSON.parse(readFileSync(join(src,'package.json'),'utf8'));
  manifest.version=version;
  if (notesV21 && name === 'publish') manifest.dependencies['@hello-ai-company/editor-canvas'] = version;
  delete manifest.scripts; delete manifest.devDependencies; delete manifest.publishConfig;
  cpSync(join(root,'docs/notes-candidate-'+version+'.md'),join(directory,'CANDIDATE.md'));
  cpSync(join(root,'docs/note-organization-host-contract.md'),join(directory,'HOST-CONTRACT.md'));
  manifest.files.push('CANDIDATE.md','HOST-CONTRACT.md');
  if (notesV9) {
    for (const [source, destination] of [
      ['docs/notes-candidate-'+version+'-host-delta.md', 'NOTES9-HOST-DELTA.md'],
      ['docs/notes-candidate-'+version+'-verification.md', 'NOTES9-VERIFICATION.md'],
    ]) { cpSync(join(root, source), join(directory, destination)); manifest.files.push(destination); }
  }
  if (notesV12) {
    cpSync(join(root, 'docs/notes-candidate-'+version+'-acceptance.json'), join(directory, 'NOTES12-ACCEPTANCE.json'));
    manifest.files.push('NOTES12-ACCEPTANCE.json');
  }
  if (notesV13) { cpSync(join(root, 'docs/notes-candidate-'+version+'-pa-contract.md'), join(directory, 'NOTES13-PA-CONTRACT.md')); manifest.files.push('NOTES13-PA-CONTRACT.md'); }
  if (existsSync(join(src,'dist/notes/index.js')) && existsSync(join(root,'docs/notes-workspace-acceptance-matrix.md'))) {
    cpSync(join(root,'docs/notes-workspace-host-contract.md'),join(directory,'NOTES-WORKSPACE-HOST.md'));
    cpSync(join(root,'docs/notes-workspace-acceptance-matrix.md'),join(directory,'NOTES-WORKSPACE-ACCEPTANCE.md'));
    manifest.files.push('NOTES-WORKSPACE-HOST.md','NOTES-WORKSPACE-ACCEPTANCE.md');
  }
  if (notesV16) { cpSync(join(root, 'docs/notes-remaining-work.md'), join(directory, 'notes-remaining-work.md')); manifest.files.push('notes-remaining-work.md'); }
  if (notesV2 && name === 'blocknote') {
    cpSync(join(root,'examples/notes-minimal/NotesExample.tsx'),join(directory,'MINIMAL-EXAMPLE.tsx'));
    cpSync(join(root,'examples/notes-minimal/README.md'),join(directory,'MINIMAL-EXAMPLE.md'));
    manifest.files.push('MINIMAL-EXAMPLE.tsx','MINIMAL-EXAMPLE.md');
  }
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
const source=`import { createOpenEditorBlockNoteSchema, describeOpenEditorAgentSchema, createDocumentColumns, updateDocumentColumns, importLegacyNotesBlocks, exportLegacyNotesBlocks, createHtmlWidgetPreview, createDocumentWorkspaceFeature, createDocumentTypographyFeature, applyNotesMetadataEdits, createRevisionedNotesResourceEditor, validateNotesPropertyValue } from '@hello-ai-company/editor-blocknote';
import { parseAgentEditorCapabilities, safeAgentLink, createNoteOrganizationSession, createOrganizationRequest, parseOrganizationSnapshot, NOTE_ORGANIZATION_INSTRUCTION, createDurableReviewCoordinator, createQuietCooperationSession, createSecretaryWorkflow, parseQuietPreparationContext, type QuietCooperationSnapshot } from '@hello-ai-company/editor-ai';
import { QuietCooperationCard, NotesPropertyEditor, NoteOrganizationCard } from '@hello-ai-company/editor-blocknote/react';
import { createEditorDocument } from '@hello-ai-company/editor-core';
const initial = [{ id:'human',type:'paragraph',text:'日本語',version:4,sourceId:'host-id',custom:{keep:true} }];
const imported=importLegacyNotesBlocks(initial);
if(JSON.stringify(exportLegacyNotesBlocks(imported.document,imported.archive,initial))!==JSON.stringify(initial)) throw new Error('Legacy no-op loss');
const columns=createDocumentColumns([[{id:'left',type:'paragraph',content:'left'}],[{id:'right',type:'paragraph',content:'right'}]]);
updateDocumentColumns(createEditorDocument([columns]),{type:'width',columnId:columns.children![0]!.id,width:2});
if(!createHtmlWidgetPreview({html:'<p>safe</p>',css:'',javascript:'alert(1)'}).includes("script-src 'none'")) throw new Error('Widget policy');
const session=createQuietCooperationSession({document:imported.document,agentId:'local',purpose:'Check export',provider:{prepare:async()=>{throw new Error('No model calls');},cancel:async()=>{}}});
const snapshot:QuietCooperationSnapshot=session.getSnapshot(); if(snapshot.enabled)throw new Error('Unexpected opt-in');session.dispose();
if([createDurableReviewCoordinator,createDocumentWorkspaceFeature,createDocumentTypographyFeature,QuietCooperationCard,createSecretaryWorkflow,NotesPropertyEditor,createRevisionedNotesResourceEditor].some(value=>typeof value!=='function'))throw new Error('Missing public export');
parseQuietPreparationContext({documentId:'note',revision:'r1',secretaryId:'secretary',instruction:'Review the selection',selectionBlockIds:['human']});
validateNotesPropertyValue({type:'multi_select',optionIds:['a','b']},['b']);
const edited=applyNotesMetadataEdits([{id:'table',type:'table',tableProps:{width:100,future:true}}],[{blockId:'table',field:'tableProps',key:'width',expected:{present:true,value:100},value:120}]);
if(JSON.stringify(edited)!==JSON.stringify([{id:'table',type:'table',tableProps:{width:120,future:true}}]))throw new Error('Metadata loss');
const widget=[{id:'h',type:'editorTool',toolKind:'htmlEmbed',toolBody:'old',toolData:'{"html":"old","future":42}'}];
const loaded=importLegacyNotesBlocks(widget); loaded.document.blocks[0]!.props!.html='new';
const synced=exportLegacyNotesBlocks(loaded.document,loaded.archive,widget) as Record<string,unknown>[];
if(synced[0]!.toolBody!=='new'||JSON.parse(synced[0]!.toolData as string).html!=='new'||JSON.parse(synced[0]!.toolData as string).future!==42)throw new Error('HTML body/data regression');
const bodyOnly=[{id:'body',type:'editorTool',toolKind:'htmlEmbed',toolBody:'<b>legacy</b>'}];
if(importLegacyNotesBlocks(bodyOnly).document.blocks[0]!.props!.html!=='<b>legacy</b>')throw new Error('Body fallback regression');
const blank=importLegacyNotesBlocks([]),created=exportLegacyNotesBlocks(createEditorDocument([{id:'new',type:'oeHtmlWidget',props:{html:'new',css:'',javascript:''}}]),blank.archive,[]) as Record<string,unknown>[];
if(created[0]!.toolBody!=='new'||JSON.parse(created[0]!.toolData as string).html!=='new')throw new Error('New HTML synchronization regression');
const note=parseOrganizationSnapshot({documentId:'note',revision:'r1',hierarchyRevision:'h1',pinRevision:'p1',document:createEditorDocument([{id:'original',type:'paragraph',content:'旅の準備'}]),title:'Untitled',parentId:null,titleManual:false,parentPinned:false,autoOrganize:true,pages:[{id:'note',parentId:null,title:'Untitled',scope:'local',sharing:'private',editable:true}],root:{scope:'local',sharing:'private',editable:true}});
const organization=createOrganizationRequest(note,{documentId:'note',revision:'r1',hierarchyRevision:'h1',pinRevision:'p1',formats:[{blockId:'original',type:'heading',level:2}],title:'旅の準備',parentId:null,placement:'certain'},'consumer-op');
if(organization.after.document.blocks[0]!.content!=='旅の準備'||[createNoteOrganizationSession,NoteOrganizationCard].some(v=>typeof v!=='function')||!NOTE_ORGANIZATION_INSTRUCTION.includes('untrusted'))throw new Error('Organization public API regression');
const inventory=describeOpenEditorAgentSchema(createOpenEditorBlockNoteSchema());
const capabilities=parseAgentEditorCapabilities({...inventory,revision:'cap1',operations:['heading','link.add','title']});
if(!capabilities.inlineTypes.includes('link')||safeAgentLink('https://example.com',[])!=='https://example.com/')throw new Error('Capability/link public API regression');
let dangerousRejected=false;try{safeAgentLink('javascript:alert(1)',[]);}catch{dangerousRejected=true;}if(!dangerousRejected)throw new Error('Dangerous link accepted');
const capabilityNote=parseOrganizationSnapshot({...note,assistance:{capabilities,selection:{revision:'sel1',blockIds:[]},proposalsAllowed:true,autoLinks:false}});
createOrganizationRequest(capabilityNote,{...organization.plan!,assistance:{capabilityRevision:'cap1',selectionRevision:'sel1',reason:'Only installed heading operation',links:[]}},'capability-op');
console.log('Candidate public runtime and declarations PASS');
`;
const hasNotes = JSON.parse(readFileSync(join(root,'packages/blocknote/package.json'),'utf8')).exports['./notes'];
const notesConsumer = hasNotes ? `
import { createNotesWorkspaceController, createOpenEditorNotesPreset, parseNotesWorkspaceConfig, NOTES_DATABASE_PROPERTY_KINDS, type NotesWorkspaceHost, type NotesDocumentSnapshot } from '@hello-ai-company/editor-blocknote/notes';
import { NotesWorkspace, NotesTabbedWorkspace, NotesInsertDialog, NotesDatabaseProperties, NotesDatabaseSchema, NotesWorkspaceModes, NotesProposalRail } from '@hello-ai-company/editor-blocknote/react';
const notesScope={actorId:'consumer-fixture',workspaceId:'consumer-fixture'}, notesTarget={kind:'page',pageId:'fixture'} as const;
const fixtureSnapshot:NotesDocumentSnapshot={scope:notesScope,target:notesTarget,revision:'r1',contentRevision:'c1',title:'Fixture',metadata:{future:{preserved:true}},document:createEditorDocument([{id:'fixture',type:'paragraph',content:'fixture'}]),capabilities:[],capabilitySemantics:{}};
const fixtureHost:NotesWorkspaceHost={scope:notesScope,readDocument:async()=>fixtureSnapshot,beforeSubmit:async()=>{throw new Error('Read-only fixture');},commit:async()=>{throw new Error('Read-only fixture');},lookupOperation:async(target,operationId)=>({status:'unknown',target,operationId})};
const fixtureController=createNotesWorkspaceController(fixtureHost);if(!await fixtureController.open(notesTarget))throw new Error('Notes open unavailable');
fixtureController.setLocalDraft('consumer-field',{source:'preserved'});if(!fixtureController.getState().pendingEditors||await fixtureController.open({kind:'page',pageId:'other'}))throw new Error('Draft barrier unavailable');
if(await fixtureController.persistLocalDrafts())throw new Error('Unbound persistence claimed');fixtureController.setLocalDraft('consumer-field',undefined);fixtureController.dispose();
parseNotesWorkspaceConfig({version:1,locale:'ja',theme:'light'});
if(NOTES_DATABASE_PROPERTY_KINDS.length!==22||[createOpenEditorNotesPreset,NotesWorkspace,NotesTabbedWorkspace,NotesInsertDialog,NotesDatabaseProperties,NotesDatabaseSchema,NotesWorkspaceModes,NotesProposalRail].some(value=>typeof value!=='function'))throw new Error('Missing Notes public export');
console.log('Notes public entry, components, read-only host and local-draft barrier PASS');
` : '';
const v2Consumer = notesV2 ? `
import { createNotesIndexedDBLayoutStorage, importLegacyNotesEditableBlocks, exportLegacyNotesEditableBlocks, createLegacyNotesEditingFeature } from '@hello-ai-company/editor-blocknote/notes';
import { createNotesCanvasController } from '@hello-ai-company/editor-blocknote/react';
const legacyProfile={whiteboardViewport:{width:640,height:360}};
const legacyDrawing=[{id:'legacy',type:'editorTool',toolKind:'whiteboard',toolData:' [] ',unknown:{keep:true}}];
const legacyV2=importLegacyNotesEditableBlocks(legacyDrawing,legacyProfile);
if(legacyV2.document.blocks[0]!.type!=='oeLegacyNotesDrawing'||JSON.stringify(exportLegacyNotesEditableBlocks(legacyV2.document,legacyV2.archive,legacyDrawing,{profile:legacyProfile}))!==JSON.stringify(legacyDrawing))throw new Error('Installed v2 lossless roundtrip');
parseNotesWorkspaceConfig({version:1,appearance:'classic',pageStyle:'midnight'});
const installedCanvas=createNotesCanvasController({scope:notesScope,target:notesTarget,documentRevision:'d1',validate:()=>[]});
if(!Object.isFrozen(installedCanvas.identity)||[createNotesIndexedDBLayoutStorage,createLegacyNotesEditingFeature].some(value=>typeof value!=='function'))throw new Error('Missing installed v2 public API');installedCanvas.dispose();
console.log('Installed legacy v2/Canvas/layout/classic public API PASS');
` : '';
const v9Consumer = notesV9 ? `
import type { NotesPageAppearanceOptions, NotesTabbedWorkspaceProps, NotesWorkspaceProps } from '@hello-ai-company/editor-blocknote/react';
const installedAppearance:NotesPageAppearanceOptions={fields:{icon:'hostIcon',tags:'hostTags'}};
const installedTabbedAppearance:Pick<NotesTabbedWorkspaceProps,'pageAppearance'>={pageAppearance:installedAppearance};
const installedWorkspaceAppearance:Pick<NotesWorkspaceProps,'pageAppearance'>=installedTabbedAppearance;
if(installedWorkspaceAppearance.pageAppearance?.fields?.tags!=='hostTags')throw new Error('Missing installed appearance contract');
console.log('Installed .9 public appearance type and workspace props PASS');
` : '';
const v12Consumer = notesV12 ? `
import { validateNotesDatabasePropertyValue } from '@hello-ai-company/editor-blocknote/notes';
import { NotesAssistancePanel, NotesDatabaseExplorer, NotesDictionaryPanel, NotesLegacyLinkPresentation, NotesLegacyMediaPreview, useNotesPropertyPickers, type NotesAssistanceService, type NotesDatabaseNavigationHost, type NotesPropertyOptionsHost } from '@hello-ai-company/editor-blocknote/react';
import { fromBlockNote, toBlockNote } from '@hello-ai-company/editor-blocknote';
const service:NotesAssistanceService={run:async request=>({scope:request.scope,target:request.target,revision:request.revision,text:'synthetic'})};
const db:NotesDatabaseNavigationHost={read:async request=>({scope:request.scope,databaseId:request.databaseId,revision:'r1',columns:[],rows:[]})};
const options:NotesPropertyOptionsHost={read:async request=>({scope:request.scope,target:request.target,propertyId:request.definition.id,valueMode:'reference',choices:[]})};
const additional:Pick<NotesWorkspaceProps,'assistance'|'databaseNavigation'|'documentOptions'>={assistance:{search:service,askPage:service},databaseNavigation:{databases:[],host:db},documentOptions:{dictionaryEntries:[]}};
if(!additional.assistance||!options.read||[NotesAssistancePanel,NotesDatabaseExplorer,NotesDictionaryPanel,NotesLegacyLinkPresentation,NotesLegacyMediaPreview,useNotesPropertyPickers].some(value=>typeof value!=='function'))throw new Error('Missing .12 read/picker/presentation exports');
if(validateNotesDatabasePropertyValue({id:'user',name:'User',type:'user',config:{valueMode:'legacy-text'}},'原本の名前')!=='原本の名前')throw new Error('Legacy text inference');
const storedTable=fromBlockNote([{id:'table12',type:'table',content:{type:'tableContent',columnWidths:[undefined,180,undefined],rows:[{cells:[[],[],[]]}]}}]);
const tableRoundtrip=fromBlockNote(toBlockNote(JSON.parse(JSON.stringify(storedTable)),{knownBlockTypes:['table']}));
if(JSON.stringify(tableRoundtrip)!==JSON.stringify(storedTable))throw new Error('Automatic table widths JSON roundtrip');
console.log('Installed .12 public read services/pickers/legacy modes/table JSON PASS');
` : '';
const v13Consumer = notesV13 ? `
import { createDefaultDatabaseViewConfig } from '@hello-ai-company/editor-blocknote';
import type { NotesTabbedWorkspaceOptions } from '@hello-ai-company/editor-blocknote/react';
const defaultDatabaseView=createDefaultDatabaseViewConfig({databaseId:'synthetic-db',viewId:'main-table',viewType:'table'});
const optionalCanvas:Pick<NotesTabbedWorkspaceOptions,'createCanvasController'|'databasePresentation'>={createCanvasController:()=>undefined,databasePresentation:{resolveRowMedia:()=>({src:'/synthetic.svg',alt:'Synthetic'})}};
if(defaultDatabaseView.databaseId!=='synthetic-db'||defaultDatabaseView.viewId!=='main-table'||!optionalCanvas.createCanvasController)throw new Error('Missing installed .13 DB/optional Canvas contract');
console.log('Installed .13 public DB presentation/default config/optional Canvas types PASS');
` : '';
const v14Consumer = notesV14 ? `
import { NotesStyleGalleryButton, NotesSelectionTools, type NotesCoverCatalog, type NotesSelectionAIService, type NotesTextSelection, type NotesEditorBridge } from '@hello-ai-company/editor-blocknote/react';
const covers14:NotesCoverCatalog={read:async request=>({scope:request.scope,target:request.target,revision:request.revision,items:[{id:'local',label:'Synthetic cover',url:'https://example.invalid/cover',alt:'Synthetic',style:'studio',layout:'wide'}]})};
const selection14:NotesSelectionAIService={run:async request=>({requestId:request.requestId,scope:request.scope,target:request.target,revision:request.revision,contentRevision:request.contentRevision,selectionId:request.selection.id,text:'Synthetic proposal'})};
const design14:Pick<NotesWorkspaceProps,'selectionAI'|'pageAppearance'>={selectionAI:selection14,pageAppearance:{fields:{style:'hostStyle',cover:'hostCover',coverAlt:'hostCoverAlt',coverLayout:'hostCoverLayout'},coverCatalog:covers14}};
const tabs14:Pick<NotesTabbedWorkspaceProps,'selectionAI'|'pageAppearance'>=design14;
const selected14:NotesTextSelection={id:'opaque',scope:notesScope,target:notesTarget,revision:'r1',contentRevision:'b1',blockId:'fixture',text:'Synthetic source'};
const replace14:NonNullable<NotesEditorBridge['replaceSelection']>=(selection,text,localDraftId,expectedLocalDraft)=>{if(selection.id!==selected14.id||!text||!localDraftId||!expectedLocalDraft)throw new Error('Invalid local review');};
replace14(selected14,'Synthetic replacement','own-draft','reviewed-fingerprint');
if(!tabs14.selectionAI||[NotesStyleGalleryButton,NotesSelectionTools].some(value=>typeof value!=='function'))throw new Error('Missing .14 public design/selection API');
console.log('Installed .14 cover catalog/selection service/scoped body review contracts PASS');
` : '';
const v15Consumer = notesV15 ? `
import { createReviewedDatabaseViewConfigProvider, clusterMapPins, type DatabaseViewConfigWriteVersion, type DatabaseViewConfigReceiptPort } from '@hello-ai-company/editor-blocknote';
import type { NotesResourceInvalidation, LegacyNotesEditingProfile } from '@hello-ai-company/editor-blocknote/notes';
import type { NotesTabbedWorkspaceSession } from '@hello-ai-company/editor-blocknote/react';
const profile15:LegacyNotesEditingProfile={databaseBindings:{fixture:{databaseId:'db',viewField:'databaseView',viewId:'view',viewIdField:'databaseViewId'}}};
const notice15:NotesResourceInvalidation={scope:notesScope,target:notesTarget};
const refresh15:NotesTabbedWorkspaceSession['refreshTarget']=async()=>false;
const port15:DatabaseViewConfigReceiptPort={scope:notesScope,read:async r=>({...r,revision:null,config:null}),beforeSubmit:async()=>{},commit:async r=>({...r,status:'unknown'}),lookup:async r=>({...r,status:'not-found',terminal:true})};
const provider15=createReviewedDatabaseViewConfigProvider(port15);
const baseline15:DatabaseViewConfigWriteVersion={readId:'opaque-local-reader',revision:null};
if(!baseline15.readId||typeof provider15.provider.loadVersioned!=='function'||typeof provider15.provider.saveVersioned!=='function')throw new Error('Missing per-reader CAS API');
if(provider15.getRecoveries().length||!profile15.databaseBindings||!notice15.target||!refresh15||clusterMapPins([],600,300).length)throw new Error('Missing .15 contracts');provider15.dispose();
console.log('Installed .15 scoped viewId/invalidation/receipt and clustering APIs PASS');
` : '';
const v16Consumer = notesV16 ? `
const search16:NonNullable<NotesEditorBridge['setSearchQuery']>=query=>({count:query?1:0,capped:false});
const focus16:NonNullable<NotesEditorBridge['focusSearchMatch']>=index=>index===0;
if(search16('literal [a]').count!==1||!focus16(0))throw new Error('Missing .16 additive search bridge');
console.log('Installed .16 optional search bridge types PASS');
` : '';
const v17Consumer = notesV17 ? `
import { NotesRelatedPages, type NotesRelatedPagesProps } from '@hello-ai-company/editor-blocknote/react';
import type { NotesPageSummary } from '@hello-ai-company/editor-blocknote/notes';
const related17:NonNullable<NotesPageSummary['relatedPageIds']>=['known-page'];
const openRelated17:NotesRelatedPagesProps['onOpen']=async()=>false;
if(related17.length!==1||!openRelated17||typeof NotesRelatedPages!=='function')throw new Error('Missing .17 relation contracts');
console.log('Installed .17 optional related page summary and panel types PASS');
` : '';
const v18Consumer = notesV18 ? `
const drawer18:Pick<NotesTabbedWorkspaceProps,'navigationPresentation'>={navigationPresentation:'drawer'};
const sidebar18:Pick<NotesWorkspaceProps,'navigationPresentation'>={navigationPresentation:'sidebar'};
if(drawer18.navigationPresentation!=='drawer'||sidebar18.navigationPresentation!=='sidebar')throw new Error('Missing installed .18 optional navigation presentation contract');
console.log('Installed .18 navigation presentation public type PASS');
` : '';
const v19Consumer = notesV19 ? `
import { NotesPageIcon } from '@hello-ai-company/editor-blocknote/react';
import type { NotesInsertRequest } from '@hello-ai-company/editor-blocknote/react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const drop19:NonNullable<Parameters<NotesEditorBridge['insert']>[2]>={anchor:{blockId:'retained',placement:'before'},table:{rows:2,columns:3}};
const request19:NotesInsertRequest={id:'drop-card',kind:'card',anchor:drop19.anchor};
if(!request19.anchor||!renderToStaticMarkup(createElement(NotesPageIcon,{value:'lucide:book-open'})).includes('data-page-icon="lucide:book-open"'))throw new Error('Missing .19 icon renderer/anchored insertion contract');
console.log('Installed .19 canonical page icon renderer and anchored insertion types PASS');
` : '';
const v20Consumer = notesV20 ? `
const bounds20:NonNullable<NotesEditorBridge['getInputBounds']>=()=>({left:10,top:20,right:12,bottom:40});
const selectionBounds20:NonNullable<NotesEditorBridge['getSelectionBounds']>=()=>({left:10,top:20,right:90,bottom:40});
const identity20:NonNullable<NotesEditorBridge['getSelectionIdentity']>=()=>JSON.stringify(['block',1,5]);
const focus20:NonNullable<NotesEditorBridge['focusEditor']>=()=>{};
if(bounds20()?.right!==12||selectionBounds20()?.right!==90||!identity20()||!focus20)throw new Error('Missing installed .20 optional floating selection bridge');
console.log('Installed .20 additive selection/caret geometry, range identity and focus bridge types PASS');
` : '';
const v21Consumer = notesV21 ? `
import { CanvasEditor } from '@hello-ai-company/editor-canvas/react';
import { inspectOpenEditorPublication, IncompletePublicationError, renderOpenEditorSite } from '@hello-ai-company/editor-publish';
import type { NotesWorkspaceRenderers } from '@hello-ai-company/editor-blocknote/react';
const preflight21:NonNullable<NotesWorkspaceRenderers['validatePublication']>=inspectOpenEditorPublication;
const complete21=createEditorDocument([{id:'cols',type:'oeColumns',children:[{id:'col',type:'oeColumn',children:[{id:'body',type:'paragraph',content:'retained column copy'}]}]}]);
if(preflight21(complete21).length||!renderOpenEditorSite(complete21,{requireCompleteDocument:true}).includes('retained column copy')||typeof CanvasEditor!=='function')throw new Error('Missing .21 column/Canvas/publication contract');
const unsupported21=createEditorDocument([{id:'drawing',type:'oeNotesDrawing'}]);
let paused21=false;try{renderOpenEditorSite(unsupported21,{requireCompleteDocument:true});}catch(error){paused21=error instanceof IncompletePublicationError;}
if(!paused21||!preflight21(unsupported21).length)throw new Error('Missing .21 complete publication guard');
console.log('Installed .21 Canvas React, retained current columns and typed complete preview guard PASS');
` : '';
const v22Consumer = notesV22 ? `
import { createInteractiveWidgetInputExtension, createDocumentColumnsBlockSpec, createDocumentColumnBlockSpec, createHtmlWidgetBlockSpec } from '@hello-ai-company/editor-blocknote';
import { createNotesDrawingBlockSpec, createNotesSyncedBlockSpec, createNotesDocumentWidgetsFeature } from '@hello-ai-company/editor-blocknote/notes';
const widgetFeature22=createNotesDocumentWidgetsFeature();
const widgetSpecs22=[createDocumentColumnsBlockSpec(),createDocumentColumnBlockSpec(),createHtmlWidgetBlockSpec(),createNotesDrawingBlockSpec(),createNotesSyncedBlockSpec(),...Object.values(createLegacyNotesEditingFeature().blockSpecs)];
if(typeof createInteractiveWidgetInputExtension!=='function'||widgetFeature22.extensions.length!==1||widgetSpecs22.some(spec=>spec.implementation.meta?.selectable!==false))throw new Error('Missing .22 widget input boundary');
const inert22=createEditorDocument([{id:'retained22',type:'oeHtmlWidget',props:{html:'<p>preserved</p>',css:'',javascript:'neverExecute()'}}]);
if(inert22.blocks[0]!.props!.javascript!=='neverExecute()')throw new Error('.22 widget source changed');
console.log('Installed .22 public widget extension, native/legacy/Columns metadata and retained inert source PASS');
` : '';
const v23Consumer = notesV23 ? `
import { createPageRuntimeStore, resolvePageCardDisplay, resolveChildPageDisplay, PageRuntimeAccessDeniedError } from '@hello-ai-company/editor-blocknote';
const unbound23=createPageRuntimeStore(); await unbound23.load('p');
if(resolvePageCardDisplay({store:unbound23},'p').status!=='unavailable'||resolveChildPageDisplay({store:unbound23},'p').missing)throw new Error('Unbound provider reported missing');
const missing23=createPageRuntimeStore({getPage:async()=>null}); await missing23.load('p');
if(!resolvePageCardDisplay({store:missing23},'p').missing)throw new Error('Explicit missing not retained');
const denied23=createPageRuntimeStore({getPage:async()=>{throw new PageRuntimeAccessDeniedError();}}); await denied23.load('p');
if(resolvePageCardDisplay({store:denied23},'p').status!=='forbidden')throw new Error('Typed access signal absent');
const error23=createPageRuntimeStore({getPage:async()=>{throw new Error('offline');}}); await error23.load('p');
if(resolvePageCardDisplay({store:error23},'p').missing||!resolveChildPageDisplay({store:error23},'p').error)throw new Error('Failed read reported missing');
console.log('Installed .23 Card metadata outcomes and explicit typed access signal PASS');
` : '';
const v24Consumer = notesV24 ? `
import { createOpenEditorPowerPreset as createClipboardPreset24 } from '@hello-ai-company/editor-blocknote';
const feature24=createDocumentWorkspaceFeature();
const preset24=createClipboardPreset24({features:[feature24]});
if(feature24.extensions.length!==${notesV32 ? 4 : notesV30 ? 3 : 2}||preset24.editorOptions().extensions?.length!==${notesV32 ? 4 : notesV30 ? 3 : 2})throw new Error('Document clipboard selection guard missing from public feature composition');
console.log('Installed .24+ Document feature clipboard selection composition PASS');
` : '';
const v26Consumer = notesV26 ? `
import { createNotesTableEditingRegistry, notesTableBindingKey, type NotesTableEditingHost, type NotesTableInputDraft, type NotesTableBinding, type NotesTableRowsPage } from '@hello-ai-company/editor-blocknote/notes';
const binding26:NotesTableBinding={scope:notesScope,parentTarget:notesTarget,databaseId:'table26',viewId:'main',query:{query:'',trashed:false,sortBy:'position',direction:'asc',limit:20}};
let raw26:NotesTableInputDraft|undefined;
const rows26:NotesTableRowsPage={binding:binding26,revision:'table-r1',rows:[{id:'row',title:'Synthetic row',deleted:false,sortOrder:0,values:{amount:2,unknown:{keep:true}}}],total:1,nextCursor:null};
const host26:NotesTableEditingHost={version:1,scope:notesScope,journal:{version:1,compareAndSwap:true,read:async()=>raw26?[structuredClone(raw26)]:[],list:async()=>raw26?[structuredClone(raw26)]:[],put:async(d,expected)=>{if(JSON.stringify(raw26)!==JSON.stringify(expected))throw Error('CAS input');raw26=structuredClone(d);},remove:async d=>{if(JSON.stringify(raw26)!==JSON.stringify(d))throw Error('Exact removal');raw26=undefined;}},resolvePort:async binding=>({binding,resourceId:'notes-db-edit:table26',read:async()=>({scope:notesScope,parentTarget:notesTarget,databaseId:'table26',revision:'table-r1',schema:{revision:'schema-r1',properties:[{id:'amount',name:'Amount',type:'number'}]},capabilities:['row.patch']}),rows:async()=>rows26,beforeSubmit:async()=>{throw Error('Invalid input must never reach ticket');},provider:{commit:async()=>{throw Error('No transport');},lookupOperation:async()=>{throw Error('No lookup');}}})};
const tables26=createNotesTableEditingRegistry(host26),table26=(await tables26.connect(binding26))!;
if(tables26.version!==1||!notesTableBindingKey(binding26)||tables26.getGeneration()<0)throw Error('Missing .26 registry identity');
await table26.beginCell('row','amount');table26.setRaw('途中12x');await table26.persistInput();
if(await table26.submit()||await tables26.beforeLeave(notesTarget,new AbortController().signal)||raw26?.rawInput!=='途中12x'||raw26.originalValue!==2||raw26.expectedSchemaRevision!=='schema-r1')throw Error('.26 input protection unavailable');
const tabs26:Pick<NotesTabbedWorkspaceOptions,'tableEditing'>={tableEditing:tables26};
const preset26=createOpenEditorNotesPreset({host:fixtureHost,tableEditing:tabs26.tableEditing});if(typeof preset26.captureTableLeaveGuard!=='function')throw Error('Missing .26 enclosing leave fence');preset26.dispose();tables26.dispose();
console.log('Installed .26 table journal CAS/rows identity/optional workspace/invalid raw and leave guard PASS');
` : '';
const v27Consumer = notesV27 ? `
import { parseNotesHtmlSourceDraft, parseNotesHtmlRawSource, notesHtmlSourceDraftKey, sameNotesHtmlSourceDraft, type NotesHtmlSourceDraft, type NotesHtmlSourceDraftJournal, type NotesHtmlSourceDraftState } from '@hello-ai-company/editor-blocknote/notes';
const original27={html:'<p>Canonical</p>\\n',css:' p {}\\n',javascript:'preservedText()\\n'};
let raw27:NotesHtmlSourceDraft|undefined=parseNotesHtmlSourceDraft({version:1,scope:notesScope,target:notesTarget,blockId:'widget27',revision:'r1',contentRevision:'c1',original:original27,input:{html:'<invalid 日本語\\n',css:'broken{',javascript:'neverExecute()\\n'},sequence:'raw-sequence',stage:'editing',part:'javascript',composing:true});
const journal27:NotesHtmlSourceDraftJournal={version:1,compareAndSwap:true,list:async()=>raw27?[structuredClone(raw27)]:[],put:async(d,expected)=>{if(!sameNotesHtmlSourceDraft(raw27,expected))throw Error('CAS raw');raw27=parseNotesHtmlSourceDraft(d);},remove:async expected=>{if(!sameNotesHtmlSourceDraft(raw27,expected))throw Error('Exact raw removal');raw27=undefined;}};
const host27:NotesWorkspaceHost={...fixtureHost,sourceDraftJournal:journal27,readDocument:async target=>({scope:notesScope,target,revision:'r1',contentRevision:'c1',document:createEditorDocument([{id:'widget27',type:'oeHtmlWidget',props:original27}]),title:'Synthetic raw',metadata:{},capabilities:['document.save'],capabilitySemantics:{'document.save':'test-only'}})};
const controller27=createNotesWorkspaceController(host27);
if(!await controller27.open(notesTarget)||!controller27.getState().pendingEditors||controller27.getState().composing||controller27.getState().dirty||await controller27.open({kind:'page',pageId:'other'}))throw Error('.27 raw hydrate/leave/IME recovery guard failed');
const state27:NotesHtmlSourceDraftState=controller27.getState().sourceDrafts!;
if(state27.records[0]!.input.html!=='<invalid 日本語\\n'||!notesHtmlSourceDraftKey(raw27!)||parseNotesHtmlRawSource(original27).javascript!==original27.javascript)throw Error('.27 raw identity/parser loss');
controller27.dispose();
console.log('Installed .27 public source journal CAS/parser/hydration/optional host/leave guard declarations and runtime PASS');
` : '';
const v28Consumer = notesV28 ? `
import type { NotesWorkspaceProps as NotesWorkspaceProps28 } from '@hello-ai-company/editor-blocknote/react';
const retained28: NonNullable<NotesWorkspaceProps28['workspaceFeedback']> = { text: 'Synthetic layout state is unconfirmed', tone: 'error', persistent: true };
const transient28: NonNullable<NotesWorkspaceProps28['workspaceFeedback']> = { text: 'Synthetic layout saved', tone: 'success' };
if(!retained28.persistent || transient28.tone !== 'success')throw Error('.28 presentation type mismatch');
console.log('Installed .28 optional workspace feedback presentation declarations PASS');
` : '';
const v30Consumer = notesV30 ? `
import { moveDocumentBlock, documentBlockKeyboardMove, applyDocumentBlockMove, DocumentBlockMovement, MAX_DOCUMENT_COLUMNS, type DocumentColumnsAction as ColumnsAction30 } from '@hello-ai-company/editor-blocknote';
const columns30=createDocumentColumns([[{id:'text30',type:'paragraph',content:'Keep'}],[]],{id:'group30',widths:[2,1],idFactory:(()=>{let n=0;return()=>"col30-"+n++;})()});
const before30=createEditorDocument([columns30,{id:'after30',type:'paragraph',content:'After'}]);
const add30:ColumnsAction30={type:'add-column',groupId:'group30',columnId:'third30',index:2};
const added30=updateDocumentColumns(before30,add30);
const moved30=moveDocumentBlock(added30,{blockId:'group30',anchorId:'after30',placement:'after'});
if(MAX_DOCUMENT_COLUMNS!==6||before30.blocks[0]!.children!.length!==2||moved30.blocks[1]!.children!.length!==3||moved30.blocks[1]!.children![0]!.props!.width!==2)throw Error('.30 structural identity mismatch');
if(documentBlockKeyboardMove(added30.blocks,'col30-0','ArrowRight')?.anchorId!=='col30-1'||[applyDocumentBlockMove,DocumentBlockMovement].some(v=>typeof v!=='function'))throw Error('.30 movement public API missing');
console.log('Installed .30 identity-preserving Columns addition and scoped block movement PASS');
` : '';
const v31Consumer = notesV31 ? `
import { createDocumentCoeditingSession, type DocumentCoeditingEditor, type DocumentCoeditingIdentity } from '@hello-ai-company/editor-blocknote';
import { notesDocumentEditingAvailable } from '@hello-ai-company/editor-blocknote/notes';
import type { NotesTabbedWorkspaceProps as NotesTabbedWorkspaceProps31, NotesCoeditingOptions } from '@hello-ai-company/editor-blocknote/react';
import { Schema as Schema31 } from '@tiptap/pm/model';
import { EditorState as EditorState31 } from '@tiptap/pm/state';
const schema31=new Schema31({nodes:{doc:{content:'paragraph+'},paragraph:{content:'text*',attrs:{id:{default:''}}},text:{}}});
let state31=EditorState31.create({schema:schema31,doc:schema31.node('doc',null,[schema31.node('paragraph',{id:'range31'},schema31.text('Source'))])});
const editor31={isEditable:true,get prosemirrorState(){return state31;},prosemirrorView:{composing:false,hasFocus:()=>false},transact(work){const tr=state31.tr,result=work(tr);state31=state31.apply(tr);return result;}} as DocumentCoeditingEditor;
const identity31:DocumentCoeditingIdentity={actorId:'synthetic',workspaceId:'consumer',documentKey:'page:consumer',paneId:'consumer',sessionId:'1',revision:'r1',contentRevision:'c1'};
const session31=createDocumentCoeditingSession(editor31,{access:()=>({identity:identity31,available:true,composing:false})});state31=state31.reconfigure({plugins:[session31.plugin]});
const ticket31=(await session31.port.capture({blockId:'range31',from:0,to:6}))!;
const proposal31=(await session31.port.offer(ticket31,'Synthetic'))!;
const result31=session31.port.apply(proposal31,{mode:'reviewed'});
if(!result31.applied||String(state31.doc.textContent)!=='Synthetic'||!session31.port.undo(result31.operationId).applied||String(state31.doc.textContent)!=='Source')throw Error('.31 range apply/Undo mismatch');
const options31:NotesCoeditingOptions={paneId:'consumer',onReady:port=>{if(port&&!port.read().active)throw Error('Inactive port');}};
const tabbed31:Pick<NotesTabbedWorkspaceProps31,'coediting'>={coediting:({paneId})=>({...options31,paneId})};
if(typeof tabbed31.coediting!=='function'||typeof notesDocumentEditingAvailable!=='function'||!ticket31.sourceHash.match(/^[a-f0-9]{64}$/))throw Error('.31 public connection/hash missing');session31.dispose();
console.log('Installed .31 scoped public ghost/range apply/AI-only Undo and optional per-pane connection PASS');
` : '';
const v32Consumer = notesV32 ? `
import { documentColumnResizeWidths, type DocumentColumnsAction as ColumnsAction32 } from '@hello-ai-company/editor-blocknote';
import { DocumentSideMenuController, type NotesDocumentRenderer as NotesDocumentRenderer32 } from '@hello-ai-company/editor-blocknote/react';
const pair32=documentColumnResizeWidths(1,1,400,40);
const resize32:ColumnsAction32={type:'resize-pair',groupId:'group30',leftId:'col30-0',rightId:'col30-1',leftWidth:pair32[0],rightWidth:pair32[1]};
const resized32=updateDocumentColumns(before30,resize32);
if(resized32.blocks[0]!.children![0]!.props!.width!==1.2||resized32.blocks[0]!.children![1]!.props!.width!==.8||resized32.blocks[0]!.children![0]!.children![0]!.id!=='text30'||typeof DocumentSideMenuController!=='function')throw Error('.32 public pair resize/gutter mismatch');
const render32:NotesDocumentRenderer32=({sideMenu})=>sideMenu;
if(typeof render32!=='function')throw Error('.32 public renderer context missing');
console.log('Installed .32 adjacent pair resize, bounds, public gutter and optional renderer child PASS');
` : '';
const v33Consumer = notesV33 ? `
import { NotesInspector as Inspector33, type NotesInspectorProps as InspectorProps33 } from '@hello-ai-company/editor-blocknote/react';
const rail33:Pick<InspectorProps33,'activePanel'|'hideTabs'|'onPanelChange'>={activePanel:'info',hideTabs:true,onPanelChange:panel=>{if(!['insert','style','info'].includes(panel))throw Error('Unexpected panel');}};
rail33.onPanelChange!('insert');
if(typeof Inspector33!=='function'||!rail33.hideTabs)throw Error('.33 controlled inspector contract missing');
const config33=parseNotesWorkspaceConfig({version:1,appearance:'classic',inspectorPanels:['insert','info'],defaultInspectorPanel:'info'});
if(config33.inspectorPanels!.length!==2||parseNotesWorkspaceConfig({version:1,inspectorPanels:[]}).inspectorPanels!.length!==0)throw Error('.33 configured rail contract missing');
console.log('Installed .33 controlled inspector and configured icon rail declarations PASS');
` : '';
const v34Consumer = notesV34 ? `
import { type NotesInsertionHost as InsertionHost34, type NotesEditorBridge as EditorBridge34, type NotesMediaScope as MediaScope34 } from '@hello-ai-company/editor-blocknote/react';
import { createPageCardBlockSpec as Card34, createChildPageBlockSpec as Child34, HTML_WIDGET_PRESETS as Html34 } from '@hello-ai-company/editor-blocknote';
const insertion34:InsertionHost34={scope:{actorId:'synthetic',workspaceId:'local'},onCreatedPageReady(context){if(context.signal.aborted||context.page.parentId!==context.parentTarget.pageId)throw Error('Wrong scoped child');}};
const options34:NonNullable<Parameters<EditorBridge34['insert']>[2]>={html:{empty:true},anchor:{blockId:'body',placement:'before'}};
const media34:MediaScope34={scope:insertion34.scope,target:{kind:'page',pageId:'parent'},blockId:'body',placement:'before'};
if(!options34.html!.empty||media34.placement!=='before')throw Error('.34 insertion options missing');
insertion34.onCreatedPageReady!({page:{id:'child',title:'Child',parentId:'parent',position:0},scope:insertion34.scope,parentTarget:{kind:'page',pageId:'parent'},parentRevision:'r1',parentContentRevision:'c1',signal:new AbortController().signal});
if(Card34().config.propSchema.presentation.default!=='modern'||!Child34().config.propSchema.presentation.values.includes('link')||!Html34.find(p=>p.id==='modern')?.source.html)throw Error('.34 reference presentation or built-in source missing');
console.log('Installed .34 scoped created-page callback, insertion options, media placement and reference presentation PASS');
` : '';
const v35Consumer = notesV35 ? `
import { notesInsertionCommands as commands35, NotesSlashMenuController as Slash35, NOTES_INSERT_LABELS_EN as labels35, type NotesInsertOptions as Options35, type NotesDocumentRenderer as Renderer35 } from '@hello-ai-company/editor-blocknote/react';
const options35:Options35={anchor:{blockId:'body',placement:'after'},replaceEmptyBlockId:'body',html:{empty:true}};
const request35:NonNullable<EditorBridge34['requestInsert']>=async(kind,signal,options)=>{if(signal.aborted||kind!=='htmlEmbed'||!options?.html?.empty)throw Error('Wrong shared insert options');};
await request35('htmlEmbed',new AbortController().signal,options35);
const render35:Renderer35=({sideMenu,slashMenu})=>slashMenu??sideMenu;
import { createDocumentIndex as index35 } from '@hello-ai-company/editor-blocknote';
const bridge35:EditorBridge34={index:index35(),installedBlockTypes:['paragraph','databaseView','oeColumns','oeColumn'],supportedInsertActions:['text','columns'],supportedStyleActions:[],editable:true,commandsAvailable:true,focusBlock(){},insert(){},format(){},requestInsert:request35};
const commands=commands35(bridge35,'en');
if(commands.some(c=>c.kind==='collection')||commands.find(c=>c.kind==='columns')?.label!=='Columns'||!commands.find(c=>c.kind==='columns')?.aliases.includes('カラム')||typeof Slash35!=='function'||typeof render35!=='function'||labels35.collection!=='Database')throw Error('.35 public shared commands/binding guard missing');
console.log('Installed .35 common insertion catalog, scoped availability, shared choices and additive slash renderer PASS');
` : '';
const v36Consumer = notesV36 ? `
import { notesEditorDictionary as dictionary36 } from '@hello-ai-company/editor-blocknote/notes';
import { createPowerEditorOptions as editorOptions36 } from '@hello-ai-company/editor-blocknote';
import { type NotesSelectionProposalEntry as Entry36, type NotesSelectionProposalRequest as Request36, type NotesWorkspaceProps as Props36, type NotesTabbedWorkspaceProps as Tabbed36, type NotesDocumentRenderer as Renderer36 } from '@hello-ai-company/editor-blocknote/react';
const locale36=dictionary36('ja-JP');
if(locale36.formatting_toolbar.bold.tooltip!=='太字'||dictionary36('en').formatting_toolbar.bold.tooltip!=='Bold'||editorOptions36({dictionary:locale36}).dictionary!==locale36)throw Error('.36 public dictionary missing');
const entry36:Entry36={open(request:Request36){if(!request.isCurrent()||request.signal.aborted)throw Error('Stale forwarded source');}};
const props36:Pick<Props36,'selectionProposal'>={selectionProposal:entry36},tabbed36:Pick<Tabbed36,'selectionProposal'|'dictionary'>={...props36,dictionary:locale36};
const render36:Renderer36=({formattingToolbar,sideMenu,slashMenu})=>formattingToolbar??slashMenu??sideMenu;
entry36.open({selection:{id:'opaque-synthetic',scope:{actorId:'actor',workspaceId:'workspace'},target:{kind:'page',pageId:'page'},revision:'r1',contentRevision:'c1',blockId:'body',text:'Synthetic source'},signal:new AbortController().signal,isCurrent:()=>true});
if(tabbed36.selectionProposal!==entry36||typeof render36!=='function')throw Error('.36 additive composition missing');
console.log('Installed .36 public dictionary override, unified toolbar slot and guarded host review entry PASS');
` : '';
writeFileSync(join(consumer,'index.ts'),source+notesConsumer+v2Consumer+v9Consumer+v12Consumer+v13Consumer+v14Consumer+v15Consumer+v16Consumer+v17Consumer+v18Consumer+v19Consumer+v20Consumer+v21Consumer+v22Consumer+v23Consumer+v24Consumer+v26Consumer+v27Consumer+v28Consumer+v30Consumer+v31Consumer+v32Consumer+v33Consumer+v34Consumer+v35Consumer+v36Consumer);
if(notesV2)cpSync(join(scope,'editor-blocknote/MINIMAL-EXAMPLE.tsx'),join(consumer,'NotesExample.tsx'));
execFileSync(process.execPath,[join(root,'node_modules/typescript/bin/tsc'),'index.ts',...(notesV2?['NotesExample.tsx','--jsx','react-jsx']:[]),'--module','NodeNext','--moduleResolution','NodeNext','--target','ES2022','--skipLibCheck','--strict','--outDir','compiled'],{cwd:consumer,stdio:'pipe'});
const runtime=execFileSync(process.execPath,['compiled/index.js'],{cwd:consumer,encoding:'utf8'});
writeFileSync(join(output,'manifest.json'),JSON.stringify({localOnly:true,published:false,sourceHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),workingTree:execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:root,encoding:'utf8'}).trim().length>0,corePeer:'existing @hello-ai-company/editor-core ^0.2.0',consumerValidation:runtime.trim(),packages:inventory},null,2)+'\n');
console.log(JSON.stringify({output,packages:inventory.map(({files,...entry})=>entry),consumer:runtime.trim()},null,2));
