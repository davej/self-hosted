import { Env } from "../types";

export async function uploadArtifactsToStaging(
  buildId: string,
  artifacts: { fileName: string; url: string; sha256?: string }[],
  env: Env
): Promise<void> {
  for (const artifact of artifacts) {
    console.log(`Downloading: ${artifact.url}`);
    const resp = await fetch(artifact.url);
    if (!resp.ok) {
      throw new Error(
        `Failed to download artifact (${artifact.url}): ${resp.status}`
      );
    }

    // Use streaming instead of loading entire file into memory
    const objectKey = `${buildId}/${artifact.fileName}`;
    await env.STAGING_R2_BUCKET.put(objectKey, resp.body, {
      httpMetadata: { contentType: guessContentType(artifact.fileName) },
    });

    console.log(`Uploaded ${objectKey} to staging successfully.`);

    // Similarly for blockmaps, use streaming
    if (
      !objectKey.includes("Mac%20Installer") &&
      !objectKey.endsWith(".yml") &&
      !objectKey.endsWith(".json")
    ) {
      const blockmapUrl = `${artifact.url}.blockmap`;
      const blockmapObjectKey = `${buildId}/${artifact.fileName}.blockmap`;
      const blockmapResp = await fetch(blockmapUrl);
      if (blockmapResp.ok) {
        await env.STAGING_R2_BUCKET.put(blockmapObjectKey, blockmapResp.body, {
          httpMetadata: { contentType: guessContentType(blockmapUrl) },
        });
        console.log(`Uploaded ${blockmapObjectKey} to staging successfully.`);
      } else {
        console.warn(`No blockmap found for ${artifact.url}`);
      }
    }
  }
}

async function computeSha256(data: ArrayBuffer): Promise<string> {
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function guessContentType(filename: string): string {
  if (filename.endsWith(".exe"))
    return "application/vnd.microsoft.portable-executable";
  if (filename.endsWith(".yml")) return "text/yaml";
  if (filename.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}
