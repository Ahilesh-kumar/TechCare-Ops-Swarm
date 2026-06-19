/** @type {import('next').NextConfig} */
// API proxying is handled server-side by src/app/api/[...path]/route.ts
// which injects the Authorization header before forwarding to the backend.
const nextConfig = {};

module.exports = nextConfig;
