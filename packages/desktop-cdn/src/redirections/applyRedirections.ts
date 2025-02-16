import { getBuildIdByAppVersion } from "./getBuildIdByAppVersion";
import type { Env } from "../types";
import { getAppRedirections } from "./getAppRedirections";
import {
  getBuildPath,
  getPlatformFromPath,
  getVersionFromPath,
  isManifestFile,
  pathIncludesBuildId,
  pathIncludesVersion,
} from "./pathUtils";
import { PlatformName } from "../types";
import { ReleaseRedirection } from "@todesktop/release-relay/src/types";

export default async function applyRedirections({
  env,
  ip = "",
  originalPath,
  recursionLevel = 0,
}: {
  env: Env;
  ip?: string;
  originalPath: string;
  recursionLevel?: number;
}): Promise<{ path: string } | { feedUrl: string }> {
  // When requesting the exact manifest by buildId, skip any redirections
  if (isManifestFile(originalPath) && pathIncludesBuildId(originalPath)) {
    return { path: originalPath };
  }

  // When requesting the exact manifest by version, only resolve buildId
  if (isManifestFile(originalPath) && pathIncludesVersion(originalPath)) {
    const versionedBuildId = await getBuildIdByAppVersion(
      getVersionFromPath(originalPath) as string,
      env
    );

    // TDBuilder app has no builds, but has releases
    if (!versionedBuildId) {
      return { path: originalPath };
    }

    return { path: getBuildPath(originalPath, versionedBuildId) };
  }

  if (recursionLevel > 2) {
    throw new Error(`Recursion level exceeded 2`);
  }

  // Self-hosted currently only supports build redirections
  const redirections = getUsedRedirection(await getAppRedirections(env), {
    ip,
    originalPath,
  });

  if (isManifestFile(originalPath) && redirections.buildId) {
    return { path: getBuildPath(originalPath, redirections.buildId) };
  }

  return { path: originalPath };
}

function getUsedRedirection(
  allRules: ReleaseRedirection[],
  options: { ip: string; originalPath: string }
): { buildId?: string } {
  const { ip, originalPath } = options;
  let buildId = "";

  // Expect to have maximum one type of redirection per rule after filtering
  allRules.forEach((redirection) => {
    switch (redirection.rule) {
      case "build": {
        if (redirection.buildId && !buildId) {
          buildId = redirection.buildId;
        }
        break;
      }

      case "buildByIp": {
        if (redirection.buildId && redirection.ipList?.includes(ip)) {
          buildId = redirection.buildId;
        }
        break;
      }

      case "buildByPlatform": {
        const platformsToRedirect: PlatformName[] = redirection.platforms;
        const platform = getPlatformFromPath(originalPath);
        if (
          redirection.buildId &&
          platform &&
          platformsToRedirect.includes(platform)
        ) {
          buildId = redirection.buildId;
        }
        break;
      }
    }
  });

  return { buildId };
}
