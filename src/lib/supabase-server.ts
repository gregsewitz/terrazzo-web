import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Extract the authenticated user from a request's Authorization header.
 * Returns the Prisma User record (creates one if first login).
 * Returns null if no valid session.
 */
export async function getUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user: authUser }, error } = await supabase.auth.getUser(token);

  if (error || !authUser) return null;

  // Find or create Prisma user
  let user = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        supabaseId: authUser.id,
        email: authUser.email!,
        name: authUser.user_metadata?.full_name || null,
        authProvider: authUser.app_metadata?.provider || 'email',
      },
    });
  }

  return user;
}

/**
 * Helper: return 401 JSON response
 */
export function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
