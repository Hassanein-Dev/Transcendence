import Fastify from "fastify";
import { WebSocketServer } from "ws";
import cors from "@fastify/cors";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import fastifyStatic from "@fastify/static";

// Load environment variables FIRST
dotenv.config();

// Ensure DB models (and schema init) are loaded at startup
import "./models";
// Import route modules AFTER environment setup
import authRoutes from "./controllers/auth";
import tournamentRoutes from "./controllers/tournaments";
import userRoutes from "./controllers/users";
import friendRoutes from "./controllers/friends";
import oauthRoutes from "./controllers/oauth";
import twoFactorRoutes from "./controllers/twoFactor";
import adminRoutes from "./controllers/admin";
import gdprRoutes from "./controllers/gdpr";
import newsRoutes from "./controllers/news";
import messagesRoutes from "./routes/messages";
import sessionPlugin from './plugins/session';

// Import WebSocket functions
import { handleWebSocketMessage, activeConnections, gameRooms } from "./websocket/router";
import { generateClientId, handleUserDisconnect } from "./utils/websocket";


const certPath = path.join("/app", "certs", "fullchain.pem");
const keyPath = path.join("/app", "certs", "privkey.pem");
const isHttps = fs.existsSync(certPath) && fs.existsSync(keyPath);


// Correct Fastify options - use 'http2' as a property of the options object
const fastifyOptions: any = {
  logger: true,
  // Increase body size limit to 10MB for avatar uploads
  bodyLimit: 10 * 1024 * 1024 // 10MB in bytes
};

if (isHttps) {
  // For HTTP/2 with HTTPS using PEM certificates
  fastifyOptions.http2 = true;
  fastifyOptions.https = {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
    allowHTTP1: true
  };
}

const fastify = Fastify(fastifyOptions);

// Create WebSocket server for real-time communications
const wss = new WebSocketServer({ noServer: true });

// WebSocket connection handler
wss.on("connection", (ws, request) => {
  const clientId = generateClientId();
  activeConnections.set(clientId, { ws, userId: null, gameRoom: null });

  fastify.log.info(`[WS] New connection: ${clientId}`);

  // Send connection established message
  ws.send(JSON.stringify({
    type: 'CONNECTION_ESTABLISHED',
    clientId,
    timestamp: new Date().toISOString()
  }));

  // Handle incoming WebSocket messages
  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleWebSocketMessage(clientId, message);
    } catch (error) {
      fastify.log.error(`[WS] Invalid message format: ${error}`);
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'Invalid message format'
      }));
    }
  });

  ws.on("close", (code, reason) => {
    fastify.log.info(`[WS] Connection closed: ${clientId} - ${code}`);
    handleUserDisconnect(clientId, activeConnections, gameRooms);
    activeConnections.delete(clientId);
  });

  ws.on("error", (error) => {
    fastify.log.error(`[WS] Error for ${clientId}: ${error.message}`);
  });
});

// HTTP upgrade handler
fastify.server.on("upgrade", (request, socket, head) => {
  const requestedPath = request.url?.split('?')[0];
  fastify.log.info(`[WS] Upgrade request for: ${requestedPath}`);

  if (requestedPath === "/ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    fastify.log.warn(`[WS] Rejected upgrade for unknown path: ${requestedPath}`);
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
  }
});

// CORS configuration - Allow all origins for local network testing
fastify.register(cors, {
  origin: true, // Allow all origins (needed for cross-PC testing on local network)
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // Allow cookies/credentials
});

// Register route modules - IN ORDER to avoid circular dependencies
fastify.register(sessionPlugin);
fastify.register(authRoutes, { prefix: '/api' });
fastify.register(oauthRoutes, { prefix: '/api' });
fastify.register(userRoutes, { prefix: '/api' });
fastify.register(friendRoutes, { prefix: '/api' });
fastify.register(tournamentRoutes, { prefix: '/api' });
fastify.register(twoFactorRoutes, { prefix: '/api' });
fastify.register(messagesRoutes, { prefix: '/api/messages' });
// Admin routes (must be registered after auth to ensure environment is ready)
fastify.register(adminRoutes, { prefix: '/api' });
fastify.register(newsRoutes, { prefix: '/api' });
// GDPR routes for data management and account deletion
fastify.register(gdprRoutes, { prefix: '/api' });

// Serve static files if public directory exists
const publicPath = path.join(__dirname, "..", "public");

if (fs.existsSync(publicPath)) {
  fastify.register(fastifyStatic, {
    root: publicPath,
    prefix: "/public/",
    wildcard: false,
  });
}

// HTTP endpoints
fastify.get("/health", async () => ({
  status: "ok",
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
  websockets: {
    activeConnections: activeConnections.size,
    gameRooms: gameRooms.size
  }
}));

fastify.get("/ws-info", async () => ({
  endpoint: `${isHttps ? 'wss' : 'ws'}://localhost:3000/ws`,
  connectedClients: activeConnections.size,
  activeGameRooms: gameRooms.size,
  protocol: "WebSocket"
}));

fastify.get("/", async () => "Fastify TypeScript Pong Backend Up!");

// Server startup
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: "0.0.0.0" });
    const protocol = isHttps ? 'https' : 'http';
    const wsProtocol = isHttps ? 'wss' : 'ws';
    fastify.log.info(`🚀 Backend listening on ${protocol}://0.0.0.0:3000`);
    fastify.log.info(`📡 WebSocket available at ${wsProtocol}://localhost:3000/ws`);
    fastify.log.info(`❤️  Health check at ${protocol}://localhost:3000/health`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  fastify.log.info('Shutting down gracefully...');

  activeConnections.forEach((connection) => {
    connection.ws.close(1001, 'Server shutting down');
  });

  await fastify.close();
  process.exit(0);
});

start();