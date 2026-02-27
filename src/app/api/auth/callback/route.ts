import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/auth/callback
 * Called by the client-side callback page after exchanging the code for a session.
 * Ensures the Prisma User record exists and returns the redirect destination.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user: authUser }, error } = await supabase.auth.getUser(token);

    if (error || !authUser) {
      return Response.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Ensure Prisma User exists — check supabaseId first, then email fallback
    // (handles users invited as collaborators before they signed up)
    let user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
    });

    if (!user && authUser.email) {
      // Check for a pending/invited record with this email
      user = await prisma.user.findUnique({
        where: { email: authUser.email },
      });

      if (user) {
        // Link the existing record to the real Supabase account
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            supabaseId: authUser.id,
            name: user.name || authUser.user_metadata?.full_name || null,
            authProvider: authUser.app_metadata?.provider || 'email',
          },
        });
      }
    }

    if (!user) {
      try {
        user = await prisma.user.create({
          data: {
            supabaseId: authUser.id,
            email: authUser.email!,
            name: authUser.user_metadata?.full_name || null,
            authProvider: authUser.app_metadata?.provider || 'email',
          },
        });
      } catch (err: unknown) {
        // Race condition: another request may have created the user
        if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
          user = await prisma.user.findUnique({ where: { supabaseId: authUser.id } })
            ?? await prisma.user.findUnique({ where: { email: authUser.email! } });
          if (!user) throw err;
        } else {
          throw err;
        }
      }
    }

    const redirectTo = user.isOnboardingComplete ? '/saved' : '/onboarding';
    return Response.json({ redirectTo });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * GET /api/auth/callback
 * Legacy redirect — sends users to the client-side callback page
 * so the browser's Supabase client can exchange the code and persist the session.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return Response.redirect(new URL('/login?error=missing_code', req.url));
  }

  // Forward code to the client-side callback page
  return Response.redirect(new URL(`/auth/callback?code=${code}`, req.url));
}
