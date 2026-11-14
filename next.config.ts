import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A página inicial (/) mostra a Central de Simulações (public/simulacoes.html).
  async rewrites() {
    return [{ source: "/", destination: "/simulacoes.html" }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
