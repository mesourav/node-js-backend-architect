import { isDBHealthy } from "../../config/db";
import { isRedisHealthy } from "../../config/redis";

let shuttingDown = false;

// Called by server.ts on SIGTERM: readiness starts failing immediately, so the load
// balancer stops routing NEW requests here while in-flight ones finish.
export function markShuttingDown() {
  shuttingDown = true;
}

// Liveness: "is the process alive and able to respond?" Deliberately checks NOTHING
// external. If it checked the DB, a DB outage would make Kubernetes restart every
// healthy app instance in a loop, which fixes nothing and makes recovery slower.
export function getLiveness() {
  return { status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() };
}

// Readiness: "should this instance receive traffic right now?"
// Checks dependencies; failing just takes the instance out of rotation (no restart).
//
// Only CRITICAL dependencies decide readiness. MongoDB is critical: without it we can't
// serve anything. Redis is not: without it we're slower (no cache) but still correct.
// If Redis failed readiness, a Redis outage would pull EVERY instance out of the load
// balancer: a full outage caused by a component the app can live without.
// Redis is still reported, as "degraded", so dashboards and alerts can see it.
export async function getReadiness() {
  const mongodb = await isDBHealthy();
  const redisUp = isRedisHealthy();
  const ready = mongodb && !shuttingDown;
  return {
    ready,
    body: {
      status: !ready ? "not ready" : redisUp ? "ready" : "degraded",
      checks: { mongodb: mongodb ? "up" : "down", redis: redisUp ? "up" : "down", shuttingDown },
    },
  };
}
