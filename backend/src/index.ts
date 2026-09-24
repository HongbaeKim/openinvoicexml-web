import "./000-core/config.js";
import Fastify from "fastify";
import { registerCors } from "./100-middleware/cors.js";
import { registerRoutes } from "./200-routes/register-routes.js";

const app = Fastify({
  logger: true,
  // nginx is the only public entry point (the backend port is bound to loopback / the Docker
  // network, see docker-compose.yml). Trust its X-Forwarded-For so request.ip is the real client
  // IP rather than the nginx container's — needed for app-level rate limiting later. Don't expose
  // this port publicly: a direct client could then spoof the header.
  trustProxy: true,
});

await registerCors(app);
await registerRoutes(app);

const port = Number(process.env.PORT ?? 3000);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
