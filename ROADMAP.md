# ShopAPI — Learning Roadmap

A production-grade e-commerce backend (users, products, orders) built step by step.
Stack: Node.js + Express + TypeScript + MongoDB, deployed on AWS.

| #   | Phase              | Topics                                                                                                                              | Status |
| --- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Project foundation | TS setup, folder structure, env validation, error handling, graceful shutdown                                                       | ✅     |
| 2   | MongoDB + CRUD     | Mongoose models, REST design, validation (zod), pagination/filter/sort, layered architecture (route → controller → service → model) | ✅     |
| 3   | Auth               | bcrypt, JWT access + refresh tokens, httpOnly cookies, role-based authorization (user/admin)                                        | ✅     |
| 4   | Testing            | Jest/Vitest, unit vs integration tests, supertest, in-memory Mongo, coverage                                                        | ✅     |
| 5   | Prod hardening     | Logging (pino), request IDs, helmet, CORS, rate limiting, liveness/readiness probes, proxy & timeout settings                       | ✅     |
| 6   | Database choice    | SQL vs NoSQL vs Postgres, indexing, transactions, CAP theorem (theory + small Postgres comparison)                                  | 🟡     |
| 7   | Docker             | Dockerfile (multi-stage), docker-compose with Mongo + Redis                                                                         | 🟡     |
| 8   | Caching & queues   | Redis caching, background jobs                                                                                                      | ⬜     |
| 9   | Kubernetes         | Deployments, Services, ConfigMaps/Secrets, probes, HPA autoscaling (local with kind/minikube)                                       | ⬜     |
| 10  | AWS & scaling      | ECR, ECS/EKS, Application Load Balancer, horizontal vs vertical scaling, stateless design, CI/CD with GitHub Actions                | ⬜     |
| 11  | System design      | Interview-style designs: URL shortener, rate limiter, e-commerce at scale                                                           | ⬜     |

## Interview notes

Each phase ends with the interview questions it prepares you for (see `notes/`).
