"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
const config_schema_1 = require("./config-schema");
const node_cluster_1 = __importDefault(require("node:cluster"));
const node_http_1 = __importDefault(require("node:http"));
const server_schema_1 = require("./server-schema");
const server_schema_2 = require("./server-schema");
function createServer(config) {
    return __awaiter(this, void 0, void 0, function* () {
        const { workerCount, port } = config;
        const WORKER_POOL = [];
        if (node_cluster_1.default.isPrimary) {
            console.log("Master Process is up.");
            for (let i = 0; i < workerCount; i++) {
                const w = node_cluster_1.default.fork({ config: JSON.stringify(config.config) });
                WORKER_POOL.push(w);
                console.log(`Master process: Worker Node Spinned UP ${i}`);
            }
            const server = node_http_1.default.createServer(function (req, res) {
                const index = Math.floor(Math.random() * WORKER_POOL.length);
                const worker = WORKER_POOL.at(index);
                if (!worker)
                    throw new Error(`Worker not found`);
                const payload = {
                    requestType: "HTTP",
                    headers: req.headers,
                    body: null,
                    url: `${req.url}`,
                };
                worker.send(JSON.stringify(payload));
                // ✅ FIXED: Use `.once` to avoid multiple responses
                worker.once("message", (workerReply) => __awaiter(this, void 0, void 0, function* () {
                    const reply = yield server_schema_2.workerMessageReplySchema.parseAsync(JSON.parse(workerReply));
                    if (reply.errorCode) {
                        res.writeHead(parseInt(reply.errorCode));
                        res.end(reply.error);
                    }
                    else {
                        res.writeHead(200);
                        res.end(reply.data);
                    }
                }));
            });
            server.listen(config.port, function () {
                console.log(`Reverse Proxy Ninja listening on PORT ${port}`);
            });
        }
        else {
            console.log(`Worker Node`);
            const config = yield config_schema_1.rootConfigSchema.parseAsync(JSON.parse(`${process.env.config}`));
            process.on("message", (message) => __awaiter(this, void 0, void 0, function* () {
                const messagevalidated = yield server_schema_1.workerMessageSchema.parseAsync(JSON.parse(message));
                const requestURL = messagevalidated.url;
                const rule = config.server.rules.find((e) => requestURL === null || requestURL === void 0 ? void 0 : requestURL.startsWith(e.path));
                const upstreamID = rule === null || rule === void 0 ? void 0 : rule.upstreams[0];
                const upstream = config.server.upstreams.find((e) => e.id === upstreamID);
                if (!upstream) {
                    const reply = {
                        errorCode: "500",
                        error: `Upstream not found`,
                    };
                    if (process.send)
                        return process.send(JSON.stringify(reply));
                    return;
                }
                const parsedUrl = new URL(upstream.url);
                const proxyRequest = node_http_1.default.request({
                    hostname: parsedUrl.hostname,
                    port: parsedUrl.port || 80,
                    path: requestURL,
                    method: "GET",
                    // headers: messagevalidated.headers, // Optional: forward headers if needed
                }, (proxyRes) => {
                    let body = "";
                    proxyRes.on("data", (chunk) => {
                        body += chunk;
                    });
                    proxyRes.on("end", () => {
                        const reply = {
                            data: body,
                        };
                        if (process.send)
                            return process.send(JSON.stringify(reply));
                    });
                });
                proxyRequest.on("error", (err) => {
                    const reply = {
                        errorCode: "500",
                        error: `Request to upstream failed: ${err.message}`,
                    };
                    if (process.send)
                        return process.send(JSON.stringify(reply));
                });
                proxyRequest.end();
            }));
        }
    });
}
