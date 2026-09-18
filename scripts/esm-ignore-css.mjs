/**
 * Node ESM loader hook: treat .css imports as empty modules.
 * Needed so isolated consumers can import @blocknote/math-block (katex CSS).
 */
export async function load(url, context, nextLoad) {
  if (url.endsWith(".css") || url.includes(".css?")) {
    return {
      format: "module",
      shortCircuit: true,
      source: "export default {};\n"
    };
  }
  return nextLoad(url, context);
}
