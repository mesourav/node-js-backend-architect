import { Router } from "express";

const router = Router();

// Load balancers and Kubernetes call this to check whether the app is alive.
router.get("/", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

export default router;
