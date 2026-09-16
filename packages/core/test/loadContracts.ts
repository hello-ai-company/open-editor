import publicApiSource from "../contracts/public-api.json?raw";
import providerContractSource from "../contracts/provider-contract.json?raw";

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

export function loadPublicApiContract(): PublicApiContract {
  return JSON.parse(publicApiSource) as PublicApiContract;
}

export function loadProviderContract(): ProviderContract {
  return JSON.parse(providerContractSource) as ProviderContract;
}
