import { getDownloadUrlAndMetadata } from "./getDownloadUrl/getDownloadUrlAndMetadata";
import { fetchFromPath } from "desktop-cdn/src/index";
import { objectNotFound } from "desktop-cdn/src/objectNotFound";
import { AddCtxAndEnvType, middleware } from "./middleware";
import type { TypedMiddlware } from "./middleware";
import { HTTPError } from "./types";

export const handler: TypedMiddlware<typeof middleware> = async (
  req,
  {
    downloadParams,
    userAgent,
    env,
    ctx,
    waitUntil,
    url,
  }: AddCtxAndEnvType<Parameters<TypedMiddlware<typeof middleware>>[1]>
): Promise<Response> => {
  const { appVersion, buildId, platform, artifactName, arch } = downloadParams;
  try {
    const downloadMetadata = await getDownloadUrlAndMetadata({
      appVersion,
      buildId,
      platform,
      artifactName,
      arch,
      userAgent,
      env,
    });

    return await fetchFromPath(
      downloadMetadata.path,
      req,
      env,
      ctx,
      true,
      buildId
    );
  } catch (err) {
    if (err instanceof HTTPError && [400, 404].includes(err.responseCode)) {
      return objectNotFound(
        new URL(req.url).pathname,
        err.responseCode,
        err.message
      );
    }
    return new Response(`Unexpected error`, {
      status: err.responseCode ?? 500,
    });
  }
};
