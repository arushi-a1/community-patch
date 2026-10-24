import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * The AWS adapters (DynamoDB, Bedrock) are OPTIONAL and only used in AWS mode.
 * They're loaded dynamically at runtime. In local mode the SDK packages aren't
 * installed, so we tell webpack to ignore those imports during bundling. When
 * you install the SDK, they resolve normally and are bundled for AWS mode
 * (documented in the README).
 */
const OPTIONAL_AWS = /^@aws-sdk\/(client-bedrock-runtime|client-dynamodb|lib-dynamodb)$/;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [],
  },
  webpack: (config, { webpack }) => {
    config.plugins.push(
      new webpack.IgnorePlugin({
        checkResource(resource) {
          if (!OPTIONAL_AWS.test(resource)) return false;
          try {
            require.resolve(resource);
            return false; // installed -> bundle normally
          } catch {
            return true; // not installed -> ignore (local mode)
          }
        },
      }),
    );
    return config;
  },
};

export default nextConfig;
