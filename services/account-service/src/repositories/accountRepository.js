import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AccountRepository {
  async findUserById(userId) {
    return prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
    });
  }

  async createAccount(data) {
    return prisma.account.create({
      data: {
        accountNumber: data.accountNumber,
        userId: data.userId,
        type: data.type || 'CHECKING',
        currency: data.currency || 'USD',
        balance: data.balance || 0.0,
        status: 'ACTIVE',
        version: 0,
      },
    });
  }

  async findByAccountNumber(accountNumber) {
    return prisma.account.findFirst({
      where: {
        accountNumber,
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findByAccountNumberAndUserId(accountNumber, userId) {
    return prisma.account.findFirst({
      where: {
        accountNumber,
        userId,
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findByUserId(userId, skip = 0, take = 10) {
    const [accounts, total] = await Promise.all([
      prisma.account.findMany({
        where: {
          userId,
          deletedAt: null,
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.account.count({
        where: {
          userId,
          deletedAt: null,
        },
      }),
    ]);

    return { accounts, total };
  }

  async findAllAccounts(skip = 0, take = 50, search = '') {
    const whereClause = {
      deletedAt: null,
    };

    if (search) {
      whereClause.OR = [
        { accountNumber: { contains: search, mode: 'insensitive' } },
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [accounts, total, statsAgg] = await Promise.all([
      prisma.account.findMany({
        where: whereClause,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.account.count({ where: whereClause }),
      prisma.account.aggregate({
        where: { deletedAt: null },
        _sum: { balance: true },
        _count: { id: true },
      }),
    ]);

    return {
      accounts,
      total,
      stats: {
        totalAccounts: statsAgg._count.id || 0,
        totalDeposits: statsAgg._sum.balance || 0,
      },
    };
  }
}

