import net from "node:net";
import { PrismaClient } from "@prisma/client";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import WebSocket from "ws";

neonConfig.webSocketConstructor = WebSocket;

// Node tries each DNS address (IPv6 + IPv4) for only 250ms by default. Where IPv6 is unreachable
// and the Neon region is far away (~330ms+ to connect), every attempt is cut off and the WebSocket
// fails with ETIMEDOUT, so every DB query errors. Give each address attempt more time.
if (typeof net.getDefaultAutoSelectFamilyAttemptTimeout === "function" && net.getDefaultAutoSelectFamilyAttemptTimeout() < 1000) {
  net.setDefaultAutoSelectFamilyAttemptTimeout(1000);
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma() {
  const config = { connectionString: process.env.DATABASE_URL };
  const adapter = new PrismaNeon(config);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function closePrisma() {
  try {
    await prisma.$disconnect();
  } catch {}
}
