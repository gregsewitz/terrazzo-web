import path from 'node:path';
import { defineConfig } from 'prisma/config';
import dotenv from 'dotenv';

// Load .env.local so Prisma CLI picks up DATABASE_URL / DIRECT_URL
dotenv.config({ path: path.join(__dirname, '.env.local') });

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),

  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || undefined,
  },
});