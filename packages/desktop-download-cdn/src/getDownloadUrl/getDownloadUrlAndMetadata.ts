import getDownloadUrlViaManifest from "./getDownloadUrlViaManifest";
import type { ManifestDetails } from "./getDownloadUrlViaManifest";
import { isSupportedPlatform } from "./isSupportedPlatform";
import { Arch, PlatformName, HTTPError, Env } from "../types";

export interface DownloadUrl {
  appId?: string;
  appVersion?: string;
  arch?: Arch;
  artifactName?: string;
  buildId?: string;
  platform?: PlatformName;
  userAgent: string;
  fetcher?: typeof fetch;
  env: Env;
}

export async function getDownloadUrlAndMetadata({
  appVersion,
  arch,
  artifactName,
  buildId,
  platform: platformArgument,
  userAgent,
  fetcher = fetch,
  env,
}: DownloadUrl): Promise<ManifestDetails> {
  const xssRegex = /[A-Za-z0-9.-]/g;
  // Sanitize for XSS
  if (appVersion && appVersion.match(xssRegex).length !== appVersion.length) {
    throw new Error(`URL is invalid (appVersion)`);
  }
  if (arch && arch.match(xssRegex).length !== arch.length) {
    throw new Error(`URL is invalid (arch)`);
  }
  if (
    artifactName &&
    artifactName.match(xssRegex).length !== artifactName.length
  ) {
    throw new Error(`URL is invalid (artifactName)`);
  }
  if (buildId && buildId.match(xssRegex).length !== buildId.length) {
    throw new Error(`URL is invalid (buildId)`);
  }
  if (
    platformArgument &&
    platformArgument.match(xssRegex).length !== platformArgument.length
  ) {
    throw new Error(`URL is invalid (platform)`);
  }

  if (platformArgument && !isSupportedPlatform(platformArgument)) {
    throw new HTTPError(400, `Unsupported platform (${platformArgument})`);
  }

  if (!userAgent) {
    throw new HTTPError(400, `No userAgent argument given`);
  }

  return await getDownloadUrlViaManifest({
    appVersion,
    arch,
    artifactName,
    buildId,
    platform: platformArgument,
    userAgent,
    env,
  });
}
