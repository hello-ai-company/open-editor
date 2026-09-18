/**
 * Compile-time workspace content composition tests (Phase 4F-2B).
 */
import { createOpenEditorPowerPreset } from "../src/features/compose.js";

type Expect<T extends true> = T;
type Extends<A, B> = A extends B ? true : false;
type IsNever<T> = [T] extends [never] ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;

const withWorkspace = createOpenEditorPowerPreset();
type WithBlocks = (typeof withWorkspace.schema.Block)["type"];
type WithInline = keyof typeof withWorkspace.schema.inlineContentSchema;

type _NotAny = Expect<Extends<IsAny<WithBlocks>, false>>;
type _HasPageCard = Expect<Extends<"pageCard", WithBlocks>>;
type _HasChildPage = Expect<Extends<"childPage", WithBlocks>>;
type _HasDatabaseView = Expect<Extends<"databaseView", WithBlocks>>;
type _HasPageMention = Expect<Extends<"pageMention", WithInline>>;
type _HasBlockRef = Expect<Extends<"blockReference", WithInline>>;

const withoutWorkspace = createOpenEditorPowerPreset({
  includeWorkspaceContent: false
});
type WithoutBlocks = (typeof withoutWorkspace.schema.Block)["type"];
type WithoutInline = keyof typeof withoutWorkspace.schema.inlineContentSchema;

type _NoPageCard = Expect<IsNever<Extract<WithoutBlocks, "pageCard">>>;
type _NoDatabaseView = Expect<IsNever<Extract<WithoutBlocks, "databaseView">>>;
type _NoPageMention = Expect<IsNever<Extract<WithoutInline, "pageMention">>>;

void 0 as unknown as _NotAny;
void 0 as unknown as _HasPageCard;
void 0 as unknown as _HasChildPage;
void 0 as unknown as _HasDatabaseView;
void 0 as unknown as _HasPageMention;
void 0 as unknown as _HasBlockRef;
void 0 as unknown as _NoPageCard;
void 0 as unknown as _NoDatabaseView;
void 0 as unknown as _NoPageMention;
void withWorkspace.featureIds;
void withoutWorkspace.featureIds;
