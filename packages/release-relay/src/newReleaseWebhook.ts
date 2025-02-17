import { Env, NewReleaseWebhook } from "./types";
import {
  BuildJSON,
  fetchBuildJSONs,
} from "./addDistributablesToStaging/fetchBuildJSONs";
import { collectArtifactsFromManifests } from "./addDistributablesToStaging/collectArtifactsFromManifests";
import { uploadArtifactsToStaging } from "./addDistributablesToStaging/uploadArtifactsToStaging";
import { createPullRequestForNewBuild } from "./createPR";

/**
 * This function:
 *   1) Parses the body into `NewReleaseWebhook`
 *   2) Fetches manifests
 *   3) Collects artifacts
 *   4) Uploads to staging
 *   5) Creates a PR
 */
export async function processNewReleaseWebhook(
  rawBody: string,
  env: Env,
  skip: {
    uploadArtifactsToStaging?: boolean;
    createPullRequest?: boolean;
  } = {}
): Promise<string> {
  // 1) Parse the incoming webhook JSON
  let newReleaseWebhookData: NewReleaseWebhook;
  try {
    newReleaseWebhookData = JSON.parse(rawBody);
  } catch (err) {
    throw new Error("Could not parse webhook JSON body");
  }

  if (!newReleaseWebhookData?.appId || !newReleaseWebhookData?.buildId) {
    throw new Error("Missing appId/buildId in webhook");
  }

  // 2) Fetch the build manifests
  let manifests: BuildJSON[];
  try {
    manifests = await fetchBuildJSONs(
      newReleaseWebhookData.appId,
      newReleaseWebhookData.buildId
    );
  } catch (err) {
    throw new Error(`Could not fetch build JSON from ToDesktop: ${err}`);
  }

  // 3) Collect all artifacts
  const artifacts = collectArtifactsFromManifests(manifests);

  if (!skip.uploadArtifactsToStaging) {
    // 4) Upload them to staging
    try {
      await uploadArtifactsToStaging(
        newReleaseWebhookData.buildId,
        artifacts,
        env
      );
    } catch (err) {
      throw new Error(`Failed to upload artifacts to staging: ${err}`);
    }
  }

  if (!skip.createPullRequest) {
    // 5) Create a PR with the build
    try {
      await createPullRequestForNewBuild(newReleaseWebhookData, env);
    } catch (err) {
      throw new Error(`Failed to create PR: ${err}`);
    }
  }

  return "PR creation successful";
}
