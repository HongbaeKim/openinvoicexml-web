import type { FastifyInstance } from "fastify";
import { invoicingRoutes } from "../700-invoicing/routes.js";
import { betaRoutes } from "../800-beta/routes.js";
import { developerRoutes } from "../900-developer/routes.js";
import { pool } from "../800-beta/db.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(invoicingRoutes);
  await app.register(betaRoutes);
  await app.register(developerRoutes);
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/api/health", async (request, reply) => {
    try {
      await pool.query("SELECT 1");
      return { status: "ok", database: "ok" };
    } catch (err) {
      request.log.error(err);
      return reply.code(503).send({ status: "error", database: "unreachable" });
    }
  });
}
