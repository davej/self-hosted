import type { Handler, RouteContext } from '@worker-tools/router';

export const trailingSlashHandler: Handler<RouteContext> = async (
  req
): Promise<Response> => {
  if (req.url.endsWith('/')) {
    // redirect to URL without trailing slash
    return new Response('redirect', {
      status: 301,
      headers: {
        Location: req.url.replace(/\/$/, ''),
      },
    });
  } else {
    return new Response('not found', { status: 404 });
  }
};
