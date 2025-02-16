import { Env, NewReleaseWebhook } from "./types";
import { validateWebhookSignature } from "./validateWebhookSignature";
import { fetchBuildJSONs } from "./addDistributablesToStaging/fetchBuildJSONs";
import { collectArtifactsFromManifests } from "./addDistributablesToStaging/collectArtifactsFromManifests";
import { uploadArtifactsToStaging } from "./addDistributablesToStaging/uploadArtifactsToStaging";
import { createPullRequestForNewBuild } from "./createPR";

/**
 * The main logic that was previously inline in `newReleaseWebhook`.
 * This function:
 *   1) Validates the signature (unless it's empty, then it fails)
 *   2) Parses the body into `NewReleaseWebhook`
 *   3) Fetches manifests
 *   4) Collects artifacts
 *   5) Uploads to staging
 *   6) Creates a PR
 *
 * If all is successful, it returns a string message. Otherwise it throws an error.
 */
export async function processNewReleaseWebhook(
  rawBody: string,
  env: Env,
  skip: {
    uploadArtifactsToStaging?: boolean;
    createPullRequest?: boolean;
  } = {}
): Promise<string> {
  // Parse the incoming webhook JSON
  let newReleaseWebhookData: NewReleaseWebhook;
  try {
    newReleaseWebhookData = JSON.parse(rawBody);
  } catch (err) {
    throw new Error("Could not parse webhook JSON body");
  }

  if (!newReleaseWebhookData?.appId || !newReleaseWebhookData?.buildId) {
    throw new Error("Missing appId/buildId in webhook");
  }

  // 1) Fetch the build manifests
  let manifests;
  try {
    manifests = await fetchBuildJSONs(
      newReleaseWebhookData.appId,
      newReleaseWebhookData.buildId
    );
  } catch (err) {
    throw new Error(`Could not fetch build JSON from ToDesktop: ${err}`);
  }

  // 2) Collect all artifacts
  const artifacts = collectArtifactsFromManifests(manifests);

  if (!skip.uploadArtifactsToStaging) {
    // 3) Upload them to staging
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
    // 4) Create a PR with the build
    try {
      await createPullRequestForNewBuild(
        newReleaseWebhookData.buildId,
        newReleaseWebhookData.appVersion,
        newReleaseWebhookData.releaseInfo,
        env
      );
    } catch (err) {
      throw new Error(`Failed to create PR: ${err}`);
    }
  }

  return "PR creation successful";
}
