/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  ...(process.env.NODE_ENV === 'production' && {
    basePath: '/LyricDataCreator',
    assetPrefix: '/LyricDataCreator/',
  }),
  images: {
    unoptimized: true
  }
};

module.exports = nextConfig;