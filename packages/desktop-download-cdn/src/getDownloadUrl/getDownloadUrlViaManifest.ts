// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import type { CustomManifest } from "@todesktop/shared";
import getArtifactName from "./getArtifactName";
import getMacArch from "./getMacArch";
import getPlatform from "./getPlatform";
import { isSupportedPlatform } from "./isSupportedPlatform";
import { Arch, Env, HTTPError, supportedArchs } from "../types";
import applyRedirections from "desktop-cdn/src/redirections/applyRedirections";
import { transformLatestBuildPath } from "desktop-cdn/src/utils/transformLatestBuildPath";

export function resolveUrl(from, to) {
  const resolvedUrl = new URL(to, new URL(from, "resolve://").href);
  if (resolvedUrl.protocol === "resolve:") {
    // `from` is a relative URL.
    const { pathname, search, hash } = resolvedUrl;
    return pathname + search + hash;
  }
  return resolvedUrl.toString();
}

const getManifestFilename = ({
  appVersion,
  buildId,
  channel = "latest",
  isCustomManifest = false,
  platform,
}: {
  appVersion?: string;
  buildId?: string;
  channel?: string;
  isCustomManifest?: boolean;
  platform: string;
}): string => {
  let filename = (isCustomManifest ? "td-" : "") + channel;
  if (platform !== "windows") {
    filename += `-${platform}`;
  }
  if (appVersion) {
    // A versioned manifest exists for each build
    filename += `-${appVersion}`;
  } else if (buildId) {
    filename += `-build-${buildId}`;
  }
  filename += isCustomManifest ? ".json" : ".yml";

  return filename;
};

// NOTE: this adds a suffix to the error message
const exitWithError = (
  message: string,
  buildId: string,
  responseCode?: number
): void => {
  throw new HTTPError(
    responseCode,
    message + (buildId ? ` and build ID ${buildId}` : "")
  );
};

const onArtifactNotFound = ({
  arch,
  artifactName,
  buildId,
  platform,
}): void => {
  exitWithError(
    `Couldn't find ${platform} app (${artifactName}-${arch})`,
    buildId,
    404
  );
};

export interface ManifestDetails {
  url: string;
  path: string;
  platform: "linux" | "mac" | "windows";
  arch: "ia32" | "x64" | "arm64" | "universal";
  sha256?: string;
  size?: number;
  md5?: string;
  version?: string;
  createdAt?: string;
}

export async function fetchManifest({
  appVersion,
  buildId,
  channel,
  platform,
  env,
}: {
  appVersion?: string;
  buildId?: string;
  channel?: string;
  platform: string;
  env: Env;
}): Promise<CustomManifest> {
  let manifestFilename = getManifestFilename({
    appVersion,
    buildId,
    channel,
    isCustomManifest: true,
    platform,
  });

  const appliedRedirections = await applyRedirections({
    env,
    originalPath: manifestFilename,
  });

  if ("path" in appliedRedirections) {
    manifestFilename = appliedRedirections.path;
  }

  // Transform the path if it matches the latest-build pattern
  manifestFilename = transformLatestBuildPath(manifestFilename);

  const manifest = await env.R2_BUCKET.get(manifestFilename);

  if (manifest) {
    return (await manifest.json()) as CustomManifest;
  }

  exitWithError(`Could not find: ${manifestFilename}`, buildId, 404);

  return null;
}

export default async ({
  appVersion,
  arch,
  artifactName: artifactNameArgument,
  buildId,
  channel,
  platform: platformArgument,
  userAgent,
  env,
}: {
  appVersion?: string;
  arch?: Arch;
  artifactName?: string;
  buildId?: string;
  channel?: string;
  platform?: string;
  userAgent: string;
  env: Env;
}): Promise<ManifestDetails> => {
  if (platformArgument && !isSupportedPlatform(platformArgument)) {
    throw new HTTPError(400, `Unsupported platform (${platformArgument})`);
  }
  const platform = getPlatform({ desired: platformArgument, userAgent });

  let isMacInstallerSupported = true;

  let archBackup: Arch;
  let archBackup2: Arch;
  if (!arch) {
    if (platform === "mac") {
      const macArch = getMacArch(userAgent);
      arch = macArch.arch;
      // Universal Mac installer only supports macOS 10.15 and later.
      isMacInstallerSupported = macArch.isMacInstallerSupported;
    } else {
      arch = "universal";
    }
    // TODO: Keep an eye on metrics. It may be worth considering a switch to arm64 at some point soon.
    // Arm64 would need to be significantly more popular to change this because this is a breaking change.
    archBackup = "x64";
    archBackup2 = "arm64";
  }

  if (platform === "mac" && (buildId || appVersion)) {
    // Universal Mac Installer only serves the lastest version, it doesn't
    // currently support builds or versions
    isMacInstallerSupported = false;
  }

  if (!supportedArchs.includes(arch)) {
    throw new HTTPError(400, `Unsupported architecture (${arch})`);
  }

  const customManifest = await fetchManifest({
    appVersion,
    buildId,
    channel,
    platform,
    env,
  });

  if (!customManifest) {
    return;
  }

  const artifactName = getArtifactName({
    customManifest,
    arch,
    desired: artifactNameArgument,
    platform,
    isMacInstallerSupported,
  });

  let artifactDetails = null;
  if (customManifest.artifacts[artifactName]) {
    artifactDetails = customManifest.artifacts[artifactName][arch];
    if (!artifactDetails && archBackup) {
      artifactDetails = customManifest.artifacts[artifactName][archBackup];
    }
    if (!artifactDetails && archBackup2) {
      artifactDetails = customManifest.artifacts[artifactName][archBackup2];
    }
  }

  if (artifactDetails) {
    return {
      ...artifactDetails,
      platform,
      arch,
      version: customManifest.version,
      createdAt: customManifest.createdAt,
    };
  }

  // tslint:disable-next-line no-console
  console.log(`${artifactName}-${arch} falsy in manifest`);
  onArtifactNotFound({
    arch,
    artifactName,
    buildId,
    platform,
  });
  return;
};
