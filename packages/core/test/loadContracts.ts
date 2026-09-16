import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const contractsDir = join(dirname(fileURLToPath(import.meta.url)), "../contracts");

export type PublicApiContract = {
  packageName: string;
  version: string;
  entry: string;
  runtimeExports: string[];
  typeExports: string[];
  stableRuntime: string[];
  stableTypes: string[];
  experimentalTypes: string[];
};

export type ProviderContract = {
  packageName: string;
  allowedMethods: string[];
  forbiddenMethods: string[];
  providers: Record<string, string[]>;
};

function readContract<T>(fileName: string): T {
  return JSON.parse(readFileSync(join(contractsDir, fileName), "utf8")) as T;
}

export function loadPublicApiContract(): PublicApiContract {
  return readContract<PublicApiContract>("public-api.json");
}

export function loadProviderContract(): ProviderContract {
  return readContract<ProviderContract>("provider-contract.json");
}
