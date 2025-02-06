import { basics, combine } from "@worker-tools/middleware";
import type { BasicsContext } from "@worker-tools/middleware";
import type { Handler, RouteContext } from "@worker-tools/router";
import type { DownloadParams, Env } from "./types";

export type AddCtxAndEnvType<T> = Omit<T, "ctx" | "env"> & {
  ctx?: ExecutionContext;
  env?: Env;
};

export type Awaitable<T> = T | PromiseLike<T>;
export type TypedMiddlware<T extends (...args) => any> = Handler<
  Awaited<ReturnType<T>> & RouteContext
>;
export const typedParams =
  () =>
  async <X extends BasicsContext>(
    ax: Awaitable<X>
  ): Promise<X & { downloadParams?: DownloadParams }> => {
    const x = await ax;
    return Object.assign(x, { downloadParams: x.params as DownloadParams });
  };

export const middleware = combine(basics(), typedParams());
