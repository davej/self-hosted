import { Arch, HTTPError, PlatformName } from "../types";

// Get / default to an artifact name for the platform given
export default ({
  customManifest,
  desired,
  arch,
  platform,
  isMacInstallerSupported,
}: {
  customManifest;
  desired?: string;
  arch?: Arch;
  platform: PlatformName;
  isMacInstallerSupported: boolean;
}): string => {
  /*
    The order of the inner array items determine which artifact we download
    when the universal download is requested (depending on which 
    artifact is enabled)
  */
  const platformArtifactsMap = {
    linux: ["appImage", "deb", "rpm", "snap"],
    mac:
      arch === "universal"
        ? // Installer is only supported for universal arch
          ["installer", "dmg", "zip", "mas"]
        : ["dmg", "zip", "pkg"],
    windows: ["nsis-web", "nsis", "msi", "appx"],
  };

  let artifactNames = platformArtifactsMap[platform];

  // Validate what they asked for
  if (desired && artifactNames.includes(desired.toLowerCase())) {
    return desired.toLowerCase();
  }

  /*
  Otherwise return the first universal artifact which is enabled. If no
  universal then we fallback to 64-bit. We fallback to 64-bit because you
  can't specify the architecture and not an artifact name.
  */
  if (platform === "mac" && !isMacInstallerSupported) {
    // Some versions of macOS don't support the universal installer
    artifactNames = artifactNames.filter((name) => name !== "installer");
  }

  const result = artifactNames.find(
    (artifactName) =>
      customManifest.artifacts[artifactName] &&
      (customManifest.artifacts[artifactName].universal ||
        customManifest.artifacts[artifactName].x64)
  );
  if (result) {
    return result;
  }

  // No artifact enabled. It should only get this far for build/version URLs
  throw new HTTPError(404, `Couldn't find ${platform} app`);
};
