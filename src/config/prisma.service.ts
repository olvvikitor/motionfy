import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// @ts-ignore
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      max: 10
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle Prisma/PG client:', err.message);
    });
    const adapter = new PrismaPg(pool as any);
    super({ adapter, log: ['error'] } as any);
  }

  async onModuleInit() {
    await this.$connect();
  }
}