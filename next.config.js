/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // دعم RTL للغة العربية
  i18n: {
    locales: ['ar'],
    defaultLocale: 'ar',
  },
  // Transpile shared package
  transpilePackages: ['@najd/shared'],
}

module.exports = nextConfig

