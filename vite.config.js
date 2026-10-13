import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const upstream =
    process.env.API_PROXY_URL ||
    env.API_PROXY_URL ||
    `http://localhost:${process.env.PORT || env.PORT || 3001}`;
  return {
    plugins: [react()],
    server: {
      strictPort: true,
      proxy: {
        "/api": upstream,
        "^/r/": upstream,
        "^/(?:\\?.*)?$": {
          target: upstream,
          bypass(req) {
            if (req.originalUrl && !/^\/(?:\?.*)?$/.test(req.originalUrl))
              return "/index.html";
          },
        },
        "^/(privacy|terms|contact|refund-policy|robots\\.txt|sitemap\\.xml)(?:\\?.*)?$":
          upstream,
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              /node_modules\/(qr-code-styling|qrcode-generator|jsqr)\//.test(id)
            )
              return "qr-engine";
            if (/node_modules\/zod\//.test(id)) return "validation";
          },
        },
      },
    },
  };
});
