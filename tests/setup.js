const prisma = require('../src/config/database');
const { getRedis } = require('../src/config/redis');

// Clean up database before all tests
beforeAll(async () => {
  const tableNames = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname='public'
  `;
  for (const { tablename } of tableNames) {
    if (tablename !== '_prisma_migrations') {
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
      } catch (error) {
        console.error({ error });
      }
    }
  }
});

// Disconnect after all tests
afterAll(async () => {
  await prisma.$disconnect();
  // Mock redis close if used
});
