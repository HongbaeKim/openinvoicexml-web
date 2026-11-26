import "./000-core/config.js";
import Fastify from "fastify";
import { registerCors } from "./100-middleware/cors.js";
import { registerDocs } from "./100-middleware/docs.js";
import { TrustedProxy } from "./100-middleware/trusted-proxy.js";
import { registerRoutes } from "./200-routes/register-routes.js";

// nginx is the only public entry point. X-Forwarded-For is believed only when the TCP peer is
// the nginx container (looked up by its service name), and only the one address nginx wrote;
// from any other peer request.ip is the peer itself. See trusted-proxy.ts.
const trustedProxy = new TrustedProxy({
  host: process.env.TRUSTED_PROXY_HOST ?? "nginx",
});

const app = Fastify({
  logger: true,
  trustProxy: trustedProxy.trust,
});

trustedProxy.attachLogger(app.log);
app.addHook("onClose", async () => {
  trustedProxy.stop();
});
// First lookup before listening (bounded, never throws): requests are not accepted before the
// trusted address is known, and if the lookup fails nothing is trusted.
await trustedProxy.start();

await registerCors(app);
await registerDocs(app);
await registerRoutes(app);

const port = Number(process.env.PORT ?? 3000);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
