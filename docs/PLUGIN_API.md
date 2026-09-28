# OpenEditor BlockNote feature plugins

`@hello-ai-company/editor-blocknote` accepts optional, instance-scoped
`OpenEditorPowerFeature` descriptors. Each descriptor can add block, inline,
style, command, and extension specs. The registry does not load code or isolate
plugins; hosts should only register trusted code.

```ts
import {
  createOpenEditorPowerFeatureRegistry,
  createOpenEditorPowerPreset
} from "@hello-ai-company/editor-blocknote";

const plugins = createOpenEditorPowerFeatureRegistry();
plugins.register(myFeature);
const preset = createOpenEditorPowerPreset({ features: plugins.list() });
plugins.unregister(myFeature.id);
```

Registration validates the entire candidate set before committing it. Duplicate
feature IDs, block/inline/style schema keys, or command IDs throw an error;
failed registration leaves the prior registry unchanged. `unregister` returns
`false` when the ID is absent. Registries are local to the host/editor instance.

The schema key checks cover conflicts between registered features. Built-in
OpenEditor blocks remain reserved by schema construction, and command conflicts
with built-in commands are rejected when the preset creates its command
registry. Plugins are trusted JavaScript: this API is a composition boundary,
not a security sandbox.
