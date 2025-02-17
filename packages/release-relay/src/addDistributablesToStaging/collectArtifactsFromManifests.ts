import { BuildJSON } from "./fetchBuildJSONs";

function changeURLToToDesktopURL(url: string, appId: string): string {
  return `https://download.todesktop.com/${appId}/${url.split("/").pop()}`;
}

export function collectArtifactsFromManifests(manifests: BuildJSON[]): {
  fileName: string;
  url: string;
  sha256?: string;
}[] {
  const allArtifacts: {
    fileName: string;
    url: string;
    sha256?: string;
  }[] = [];

  for (const manifest of manifests) {
    if (manifest.tdManifestUrl) {
      allArtifacts.push({
        fileName: decodeURIComponent(manifest.tdManifestUrl.split("/").pop()!),
        url: manifest.tdManifestUrl,
      });
    }
    if (manifest.ebManifestUrl) {
      allArtifacts.push({
        fileName: decodeURIComponent(manifest.ebManifestUrl.split("/").pop()!),
        url: manifest.ebManifestUrl,
      });
    }
    // E.g. manifest.artifacts = { nsis: { x64: {...}, arm64: {...} }, "nsis-web": {...}, ... }
    if (!manifest.artifacts) continue;
    for (const artifactName of Object.keys(manifest.artifacts)) {
      const arches = manifest.artifacts[artifactName];
      if (!arches) continue;
      for (const arch of Object.keys(arches)) {
        const info = arches[arch];
        if (!info?.url) continue;

        // "fileName" is just the final part of the URL, or pick your own logic
        const fileName = decodeURIComponent(info.url.split("/").pop()!);
        allArtifacts.push({
          fileName,
          url: changeURLToToDesktopURL(info.url, manifest.appId),
          // sha256: info.sha256,
        });
      }
    }
  }

  console.log("Found artifacts:", allArtifacts);

  return allArtifacts;
}
