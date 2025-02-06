// Match pattern: {id}/latest-build-{buildId}-{platform}.yml
const LATEST_BUILD_PATTERN =
  /^([^/]+)\/latest-build-([a-z0-9]+)-([a-z]+)\.yml$/i;

/**
 * Transforms paths for latest build files because the names are slightly incorrect on S3
 * Pattern: {id}/latest-build-{buildId}-{platform}.yml -> {id}/latest-{platform}-build-{buildId}.yml
 * If no platform is specified, the path remains unchanged
 *
 * @param path The original file path
 * @returns The transformed path
 */
export function transformLatestBuildPath(path: string): string {
  const match = LATEST_BUILD_PATTERN.exec(path);
  return match
    ? match[1] + '/latest-' + match[3] + '-build-' + match[2] + '.yml'
    : path;
}
