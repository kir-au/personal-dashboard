/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

const nextConfig = withPWA({
  reactStrictMode: true,
  // Remove swcMinify as it's deprecated in newer Next.js versions
  // Add turbopack config to avoid warning
  turbopack: {},
});

module.exports = nextConfig;
