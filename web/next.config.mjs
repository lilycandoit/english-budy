/** @type {import('next').NextConfig} */
const nextConfig = {
  // msedge-tts uses native ws bindings — exclude from webpack bundling so Node.js loads it natively
  serverExternalPackages: ["msedge-tts"],
};

export default nextConfig;
