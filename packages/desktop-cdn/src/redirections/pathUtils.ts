import { PlatformName } from "../types";

export function extractAppIdFromPath(path: string): string {
  const pathParts = path.split("/");
  return pathParts[0];
}

function extractFilenameFromPath(path: string): string {
  const pathParts = path.split("/");
  return pathParts[pathParts.length - 1];
}

export function getBuildPath(originalPath: string, buildId: string) {
  // Remove version number from path
  const pathWithoutVersion = originalPath.replace(
    /-\d+\.\d+\.\d+(?=\.(yml|json)$)/,
    ""
  );
  // Add build ID to path
  return pathWithoutVersion.replace(/\.(yml|json)$/, `-build-${buildId}.$1`);
}

/**
 * Checks if a string contains a version number (e.g., "3.1.3") preceded by a
 * "-" character and followed by a file extension (either ".json" or ".yml").
 *
 *  @example
 * // returns "3.1.3"
 * getVersionFromPath('210203cqcj00tw1/td-latest-linux-3.1.3.json');
 *
 * @example
 * // returns undefined
 * getVersionFromPath('210203cqcj00tw1/td-latest-linux.json');
 */
export function getVersionFromPath(path: string): string | undefined {
  const regex = /-(\d+\.\d+\.\d+)(?=\.json$|\.yml$)/i;
  const match = path.match(regex);
  return match ? match[1] : undefined;
}

/**
 * Extracts the platform from a path.
 *
 * @example
 * // returns "linux"
 * getPlatformFromPath('210203cqcj00tw1/td-latest-linux.json');
 *
 *  @example
 * // returns "windows" if no platform specified
 * getPlatformFromPath('210203cqcj00tw1/td-latest.json');
 *
 *  @example
 * // returns `undefined` if not a manifest file
 * getPlatformFromPath('210203cqcj00tw1/latest-mac.dmg');
 */
export function getPlatformFromPath(path: string): PlatformName | undefined {
  if (isLatestManifestFile(path)) {
    const filename = extractFilenameFromPath(path);

    // If the filename is "td-latest.json" or "latest.yml" then the platform is windows
    if (filename === "td-latest.json" || filename === "latest.yml") {
      return "windows";
    }

    // If the filename is not "td-latest.json" or "latest.yml" then the platform is "-{platform}.json/yml"
    const regex = /-(\w+)(?=\.json$|\.yml$)/i;
    const match = path.match(regex);
    if (match && ["mac", "linux"].includes(match[1])) {
      return match[1] as "mac" | "linux";
    }
  }
  return undefined;
}

export function isManifestFile(path: string): boolean {
  return path.endsWith(".json") || path.endsWith(".yml");
}

export function isLatestManifestFile(path: string): boolean {
  if (isManifestFile(path)) {
    const filename = extractFilenameFromPath(path);
    return filename.startsWith("td-latest") || filename.startsWith("latest");
  }
  return false;
}

export function pathIncludesBuildId(path: string): boolean {
  return path.includes("-build-");
}

export function pathIncludesVersion(path: string): boolean {
  return getVersionFromPath(path) !== undefined;
}
