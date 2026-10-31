/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'lyric-data-creator\\.vercel\\.app' }],
        destination: 'https://ldc.kayomodoki.com/:path*',
        permanent: true,
      },
      {
        source: '/',
        destination: '/editor/',
        permanent: false,
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        pathname: '/vi/**',
      },
    ],
  },
}

module.exports = nextConfig
