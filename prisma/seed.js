const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo user
  const passwordHash = await bcrypt.hash('Demo@1234', 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@postly.com' },
    update: {},
    create: {
      email: 'demo@postly.com',
      username: 'demo_user',
      passwordHash,
      name: 'Demo User',
      bio: 'Postly demo account',
    },
  });

  console.log('✅ Created demo user:', user.email);
  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
