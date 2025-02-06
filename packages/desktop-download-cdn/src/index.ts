import { WorkerRouter } from "@worker-tools/router";
import { trailingSlashHandler } from "./trailingSlashHandler";
import { handler } from "./handler";
import { middleware } from "./middleware";

const router = new WorkerRouter(middleware)
  .get("/versions/:appVersion/:platform/:artifactName/:arch", handler)
  .get("/versions/:appVersion/:platform/:artifactName", handler)
  .get("/versions/:appVersion/:platform", handler)
  .get("/versions/:appVersion", handler)
  .get("/builds/:buildId/:platform/:artifactName/:arch", handler)
  .get("/builds/:buildId/:platform/:artifactName", handler)
  .get("/builds/:buildId/:platform", handler)
  .get("/builds/:buildId", handler)
  .get("/:platform/:artifactName/:arch", handler)
  .get("/:platform/:artifactName", handler)
  .get("/:platform", handler)
  .get("/", handler)
  .get("/*", trailingSlashHandler);

export default router;
