/** @type {import('next').NextConfig} */
const nextConfig = {
  rewrites: async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    console.log(`[NextConfig] Rewriting /api/:path* requests to: ${apiUrl}`);
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
