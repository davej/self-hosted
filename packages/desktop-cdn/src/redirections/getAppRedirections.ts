import { ReleaseRedirection } from "@todesktop/release-relay/src/types";
import { Env } from "../types";

type Release = {
  latestReleaseBuildId: string;
  releaseRedirections: ReleaseRedirection[];
};

export async function getAppRedirections(
  env: Env
): Promise<ReleaseRedirection[]> {
  const releases = await env.R2_BUCKET.get("desktop-releases.json");
  const releasesJson = (await releases.json()) as Release;
  const redirections: ReleaseRedirection[] =
    releasesJson.releaseRedirections || [];

  const latestReleaseBuildId = releasesJson.latestReleaseBuildId;
  if (latestReleaseBuildId) {
    redirections.push({ rule: "build", buildId: latestReleaseBuildId });
  }
  return redirections;
}
