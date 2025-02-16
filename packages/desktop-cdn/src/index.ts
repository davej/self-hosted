import { serveFromR2 } from "./serveFromR2";
import type { Env } from "./types";
import { transformLatestBuildPath } from "./utils/transformLatestBuildPath";
import applyRedirections from "./redirections/applyRedirections";

const fetch: ExportedHandlerFetchHandler<Env> = async (request, env, ctx) => {
  const url = new URL(request.url);
  const objectName = decodeURIComponent(url.pathname.slice(1));

  if (objectName === "") {
    return new Response(`Bad Request`, {
      status: 400,
    });
  } else if (objectName === "my-ip") {
    const ip = request.headers.get("cf-connecting-ip");
    return new Response(ip);
  }

  if (request.method !== "GET") {
    return new Response(`Method Not Allowed`, {
      status: 405,
    });
  }

  return fetchFromPath(objectName, request, env, ctx);
};

export async function fetchFromPath(
  path: string,
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  isDownload?: boolean,
  buildId?: string
) {
  const appliedRedirections = await applyRedirections({
    env,
    originalPath: path,
    ip: request.headers.get("cf-connecting-ip"),
  });

  if ("path" in appliedRedirections) {
    path = appliedRedirections.path;
  }

  // Transform the path if it matches the latest-build pattern
  path = transformLatestBuildPath(path);

  const obj = await env.R2_BUCKET.head(path);
  if (obj === null) {
    return new Response(`Not Found`, {
      status: 404,
    });
  }

  return serveFromR2(path, request, env, ctx, isDownload, buildId);
}

export default {
  fetch,
};
