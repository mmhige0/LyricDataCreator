/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: '/LyricDataCreator',
  assetPrefix: '/LyricDataCreator/',
  images: {
    unoptimized: true
  }
};

module.exports = nextConfig;