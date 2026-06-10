import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/nasdaq": {
        target: "https://api.nasdaq.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nasdaq/, ""),
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json,text/plain,*/*",
        },
      },
      "/stocktwits": {
        target: "https://api.stocktwits.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/stocktwits/, ""),
      },
      "/yahoo": {
        target: "https://query1.finance.yahoo.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yahoo/, ""),
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json,text/plain,*/*",
        },
      },
      "/halts": {
        target: "https://www.nasdaqtrader.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/halts/, ""),
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/rss+xml,text/xml,text/plain,*/*",
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
