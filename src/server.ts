import { ConfigSchemaType, rootConfigSchema } from "./config-schema";
import cluster, { Worker } from "node:cluster";
import http from "node:http";
import { WorkerMessageType, workerMessageSchema } from "./server-schema";
import { WorkerMessageReplyType, workerMessageReplySchema } from "./server-schema";

interface CreateServerConfig {
  port: number;
  workerCount: number;
  config: ConfigSchemaType;
}

export async function createServer(config: CreateServerConfig) {
  const { workerCount, port } = config;
  const WORKER_POOL: Worker[] = [];

  if (cluster.isPrimary) {
    console.log("Master Process is up.");

    for (let i = 0; i < workerCount; i++) {
      const w = cluster.fork({ config: JSON.stringify(config.config) });
      WORKER_POOL.push(w);
      console.log(`Master process: Worker Node Spinned UP ${i}`);
    }

    const server = http.createServer(function (req, res) {
      const index = Math.floor(Math.random() * WORKER_POOL.length);
      const worker = WORKER_POOL.at(index);
      if (!worker) throw new Error(`Worker not found`);

      const payload: WorkerMessageType = {
        requestType: "HTTP",
        headers: req.headers,
        body: null,
        url: `${req.url}`,
      };

      worker.send(JSON.stringify(payload));

      // ✅ FIXED: Use `.once` to avoid multiple responses
      worker.once("message", async (workerReply: string) => {
        const reply = await workerMessageReplySchema.parseAsync(
          JSON.parse(workerReply)
        );

        if (reply.errorCode) {
          res.writeHead(parseInt(reply.errorCode));
          res.end(reply.error);
        } else {
          res.writeHead(200);
          res.end(reply.data);
        }
      });
    });

    server.listen(config.port, function () {
      console.log(`Reverse Proxy Ninja listening on PORT ${port}`);
    });
  } else {
    console.log(`Worker Node`);
    const config = await rootConfigSchema.parseAsync(
      JSON.parse(`${process.env.config}`)
    );

    process.on("message", async (message: string) => {
      const messagevalidated = await workerMessageSchema.parseAsync(
        JSON.parse(message)
      );

      const requestURL = messagevalidated.url;
      const rule = config.server.rules.find((e) =>
        requestURL?.startsWith(e.path)
      );

      const upstreamID = rule?.upstreams[0];
      const upstream = config.server.upstreams.find(
        (e) => e.id === upstreamID
      );

      if (!upstream) {
        const reply: WorkerMessageReplyType = {
          errorCode: "500",
          error: `Upstream not found`,
        };
        if (process.send) return process.send(JSON.stringify(reply));
        return;
      }

      const parsedUrl = new URL(upstream.url);

      const proxyRequest = http.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 80,
          path: requestURL,
          method: "GET",
          // headers: messagevalidated.headers, // Optional: forward headers if needed
        },
        (proxyRes) => {
          let body = "";

          proxyRes.on("data", (chunk) => {
            body += chunk;
          });

          proxyRes.on("end", () => {
            const reply: WorkerMessageReplyType = {
              data: body,
            };
            if (process.send) return process.send(JSON.stringify(reply));
          });
        }
      );

      proxyRequest.on("error", (err) => {
        const reply: WorkerMessageReplyType = {
          errorCode: "500",
          error: `Request to upstream failed: ${err.message}`,
        };
        if (process.send) return process.send(JSON.stringify(reply));
      });

      proxyRequest.end();
    });
  }
}
