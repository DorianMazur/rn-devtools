#!/usr/bin/env node
import { createServer } from "vite";
import open from "open";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server as SocketIOServer } from "socket.io";
import socketHandle from "./socketHandler";

async function startServer() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const server = await createServer({
    configFile: path.resolve(__dirname, "../vite.config.ts"),
    root: path.resolve(__dirname, "../"),
    base: "/",
    server: {
      host: true,
      port: 3000,
    },
  });
  await server.listen();
  const httpServer = server.httpServer;
  if (!httpServer) {
    throw new Error("Vite httpServer not available after listen()");
  }

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  socketHandle({ io });

  await open("http://localhost:3000", {
    newInstance: true,
    app: { name: "google chrome", arguments: ["--new-window"] },
  });
  console.log("Server is running at http://localhost:3000");
}

startServer().catch((error) => {
  console.error("Error starting server:", error);
  process.exit(1);
});
