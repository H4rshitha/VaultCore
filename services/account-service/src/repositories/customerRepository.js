import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class CustomerRepository {
  async findById(customerId) {
    return prisma.user.findFirst({
      where: {
        id: customerId,
        deletedAt: null,
      },
      include: {
        accounts: {
          where: { deletedAt: null },
        },
        _count: {
          select: { accounts: true },
        },
      },
    });
  }

  async searchCustomers({ customerId, email, phone, name, query }) {
    const where = {
      deletedAt: null,
    };

    if (customerId) {
      where.id = customerId;
    } else if (email) {
      where.email = { contains: email, mode: 'insensitive' };
    } else if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length > 1) {
        where.OR = [
          {
            AND: [
              { firstName: { contains: parts[0], mode: 'insensitive' } },
              { lastName: { contains: parts[1], mode: 'insensitive' } },
            ],
          },
          { firstName: { contains: name, mode: 'insensitive' } },
          { lastName: { contains: name, mode: 'insensitive' } },
        ];
      } else {
        where.OR = [
          { firstName: { contains: name, mode: 'insensitive' } },
          { lastName: { contains: name, mode: 'insensitive' } },
          { email: { contains: name, mode: 'insensitive' } },
        ];
      }
    } else if (query) {
      const q = query.trim();
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
      if (isUUID) {
        where.OR = [{ id: q }, { email: { contains: q, mode: 'insensitive' } }];
      } else {
        where.OR = [
          { email: { contains: q, mode: 'insensitive' } },
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ];
      }
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { accounts: true },
        },
        accounts: {
          where: { deletedAt: null },
          select: {
            id: true,
            accountNumber: true,
            type: true,
            balance: true,
            currency: true,
            status: true,
          },
        },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      customerId: u.id,
      id: u.id,
      fullName: `${u.firstName} ${u.lastName}`.trim(),
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: phone || '+1 (555) 019-2834',
      status: u.isActive ? 'ACTIVE' : 'INACTIVE',
      role: u.role,
      existingAccountCount: u._count?.accounts ?? u.accounts?.length ?? 0,
      accountCount: u._count?.accounts ?? u.accounts?.length ?? 0,
      accounts: u.accounts || [],
    }));
  }
}
