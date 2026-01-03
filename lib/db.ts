import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const disableSslVerify =
  process.env.PGSSL_NO_VERIFY === 'true' || process.env.PGSSL_NO_VERIFY === '1'
const sslRootCert = process.env.PGSSL_ROOT_CERT

const adapter = new PrismaPg(
  disableSslVerify
    ? { connectionString, ssl: { rejectUnauthorized: false } }
    : sslRootCert
      ? { connectionString, ssl: { ca: sslRootCert, rejectUnauthorized: true } }
      : { connectionString },
)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
