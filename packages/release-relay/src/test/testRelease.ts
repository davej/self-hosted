// testRelease.ts
import fs from "node:fs/promises";
import { processNewReleaseWebhook } from "../newReleaseWebhook";
import { Env } from "../types";

// You still need to provide any references used within Env:
const mockEnv = process.env as unknown as Env;

async function main() {
  // Load JSON fixture
  const fixtureFile = process.argv[2];
  if (!fixtureFile) {
    console.error("Usage: npm run test-release-webhook -- <fixtureFilePath>");
    process.exit(1);
  }

  const rawBody = await fs.readFile(fixtureFile, "utf-8");

  try {
    const result = await processNewReleaseWebhook(rawBody, mockEnv, {
      uploadArtifactsToStaging: true,
      // createPullRequest: true,
    });
    console.log("Success:", result);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
