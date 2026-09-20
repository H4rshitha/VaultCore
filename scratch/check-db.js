const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, fullName: true, role: true } });
  console.log('=== USERS IN DB ===');
  console.log(users);

  const outbox = await prisma.outboxEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
  console.log('\n=== LATEST 5 OUTBOX EVENTS ===');
  console.log(JSON.stringify(outbox, null, 2));

  const notifs = await prisma.notificationAudit.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
  console.log('\n=== LATEST 5 NOTIFICATION AUDITS ===');
  console.log(JSON.stringify(notifs, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
