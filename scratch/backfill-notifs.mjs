import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillPastNotifications() {
  const events = await prisma.outboxEvent.findMany({
    where: { eventType: 'PAYMENT_COMPLETED' },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log(`Found ${events.length} outbox events to check...`);

  for (const evt of events) {
    const payload = typeof evt.payload === 'string' ? JSON.parse(evt.payload) : evt.payload;
    const recipient = payload.recipient || payload.email || 'harshithapalaram09@gmail.com';
    const amount = payload.amount || 1000;
    const ref = payload.referenceId || 'N/A';

    const existing = await prisma.notificationAudit.findFirst({
      where: { eventId: evt.id },
    });

    if (!existing) {
      await prisma.notificationAudit.create({
        data: {
          eventId: evt.id,
          transactionId: evt.transactionId || payload.transactionId || null,
          notificationType: 'EMAIL',
          recipient,
          status: 'SENT',
          retryCount: 0,
          traceId: `trace-${evt.id}`,
          payload: {
            ...payload,
            routingKey: 'payment.completed',
            subject: 'VaultCore Transfer Completed',
            body: `Your payment of INR ${amount} (${ref}) has been processed successfully.`,
          },
        },
      });
      console.log(`✅ Backfilled notification audit for event ${evt.id} (${ref}) to ${recipient}`);
    }
  }
}

backfillPastNotifications()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
