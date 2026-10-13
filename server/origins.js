import { networkInterfaces } from "node:os";
import { config } from "./config.js";

const allowed = new Set([config.origin]);
if (!config.production) {
  const base = new URL(config.origin);
  const hosts = ["localhost", "127.0.0.1", "[::1]"];
  for (const addresses of Object.values(networkInterfaces()))
    for (const address of addresses || [])
      if (address.family === "IPv4") hosts.push(address.address);
  for (const host of hosts) {
    const url = new URL(base);
    url.hostname = host;
    allowed.add(url.origin);
  }
}
export const isAllowedOrigin = (value) => allowed.has(value);
