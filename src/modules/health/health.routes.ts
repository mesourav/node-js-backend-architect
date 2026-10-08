import { Request, Response, Router } from "express";
import { getLiveness, getReadiness } from "./health.service";

const router = Router();

function live(_req: Request, res: Response) {
  res.json(getLiveness());
}

async function ready(_req: Request, res: Response) {
  const { ready, body } = await getReadiness();
  // 503 Service Unavailable tells the load balancer "skip me for now".
  res.status(ready ? 200 : 503).json(body);
}

// GET /health and /health/live -> liveness probe (Kubernetes restarts the container if it fails)
// GET /health/ready             -> readiness probe (load balancer stops sending traffic if it fails)
router.get("/", live);
router.get("/live", live);
router.get("/ready", ready);

export default router;
