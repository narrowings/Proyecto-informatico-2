import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Imagen de Docker liviana (infra/qa). No cambia `pnpm dev`.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
