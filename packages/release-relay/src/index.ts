import { Env } from "./types";
import { processNewReleaseWebhook } from "./newReleaseWebhook";
import { validateWebhookSignature } from "./validateWebhookSignature";

async function newReleaseWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const rawBody = await request.text();

    await validateWebhookSignature(
      request.headers.get("X-ToDesktop-HMAC-SHA256"),
      rawBody,
      env.WEBHOOK_HMAC_KEY
    );

    const resultMessage = await processNewReleaseWebhook(rawBody, env);
    return new Response(resultMessage, { status: 200 });
  } catch (err) {
    console.error("Error processing new release webhook:", err);
    return new Response((err as Error).message, { status: 400 });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (
      !env.GITHUB_OWNER ||
      !env.GITHUB_REPO ||
      !env.GITHUB_TOKEN ||
      !env.WEBHOOK_HMAC_KEY ||
      !env.STAGING_R2_BUCKET
    ) {
      return new Response("Missing environment variables", { status: 400 });
    }

    const url = new URL(request.url);
    if (url.pathname === "/new-release-webhook") {
      return newReleaseWebhook(request, env);
    }
    return new Response("Not Found", { status: 404 });
  },
};
