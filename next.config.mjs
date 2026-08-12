/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained server bundle for a lean container image.
  output: "standalone",
  // Keep the native SQLite module out of the webpack bundle; it's loaded at runtime.
  serverExternalPackages: ["better-sqlite3"],
  // Generated illustrations are inlined as data URLs in production, so no remote
  // image optimization is needed.
  images: { unoptimized: true },
};

export default nextConfig;
