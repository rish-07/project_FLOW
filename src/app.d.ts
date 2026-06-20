import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { Session, User } from 'better-auth';

declare global {
  namespace App {
    interface Platform {
      env: {
        DB: D1Database;
        DIARY_PHOTOS: R2Bucket;
        GEMINI_API_KEY: string;
        BETTER_AUTH_SECRET: string;
      };
      context?: {
        waitUntil(promise: Promise<unknown>): void;
      };
    }
    interface Locals {
      user: User | null;
      session: Session | null;
    }
  }
}

export {};
