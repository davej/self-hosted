export async function fetchBuildJSONs(
  appId: string,
  buildId: string
): Promise<BuildJSON[]> {
  // Potential manifest URLs
  const base = `https://download.todesktop.com/${appId}`;
  const possibleUrls = [
    `${base}/td-latest-build-${buildId}.json`,
    `${base}/td-latest-mac-build-${buildId}.json`,
    `${base}/td-latest-linux-build-${buildId}.json`,
  ];

  const results: BuildJSON[] = [];

  for (const url of possibleUrls) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const data = (await resp.json()) as BuildJSON;
        results.push({
          ...data,
          appId,
          buildId,
          tdManifestUrl: url,
          ebManifestUrl: url
            .replace("td-latest", "latest")
            .replace(".json", ".yml"),
        });
      } else if (resp.status !== 404) {
        throw new Error(
          `Failed to fetch JSON from ${url}, status = ${resp.status}`
        );
      }
    } catch (err) {
      // If 404 or parsing error, skip
      console.log(`Skipping manifest at ${url}:`, err);
    }
  }

  if (results.length === 0) {
    throw new Error(`No JSON manifests found for buildId=${buildId}.`);
  }

  console.log("Found manifests:", results);

  return results;
}

/**
 * Example shape. Adjust as needed.
 * If your JSON doesn't include `sha256`, remove the checks or gather from your actual fields.
 */
export interface BuildJSON {
  tdManifestUrl: string;
  ebManifestUrl: string;
  version: string;
  appId: string;
  buildId: string;
  createdAt?: string;
  artifacts: {
    [artifactName: string]: {
      [arch: string]: {
        url: string;
        sha256?: string;
      };
    };
  };
}
