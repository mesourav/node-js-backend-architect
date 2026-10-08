import { isDBHealthy } from "../../config/db";

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
export async function getReadiness() {
  const mongodb = await isDBHealthy();
  const ready = mongodb && !shuttingDown;
  return {
    ready,
    body: {
      status: ready ? "ready" : "not ready",
      checks: { mongodb: mongodb ? "up" : "down", shuttingDown },
    },
  };
}
