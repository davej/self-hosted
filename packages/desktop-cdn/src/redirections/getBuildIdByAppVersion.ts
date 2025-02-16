import { Env } from "../types";

type Build = {
  id: string;
  version: string;
  isReleased: boolean;
  createdAt: string;
};

export async function getBuildIdByAppVersion(
  appVersion: string | undefined,
  env: Env
): Promise<string | undefined> {
  if (!appVersion) return undefined;

  const builds = await env.R2_BUCKET.get("desktop-builds.json");
  const buildsJson = (await builds.json()) as Build[];
  const build = buildsJson.find(
    (build: Build) => build.version === appVersion && build.isReleased
  );
  return build ? build.id : undefined;
}
