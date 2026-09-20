import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const notifs = await prisma.notificationAudit.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  console.log('=== NOTIFICATION AUDITS IN DB ===');
  console.log(JSON.stringify(notifs, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
