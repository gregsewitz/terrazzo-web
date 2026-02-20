import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', req.url));
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      return NextResponse.redirect(new URL('/login?error=auth_failed', req.url));
    }

    // Ensure Prisma User exists
    const existing = await prisma.user.findUnique({
      where: { supabaseId: data.user.id },
    });

    if (!existing) {
      await prisma.user.create({
        data: {
          supabaseId: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.full_name || null,
          authProvider: data.user.app_metadata?.provider || 'email',
        },
      });
    }

    // Check if user has completed onboarding
    const user = await prisma.user.findUnique({
      where: { supabaseId: data.user.id },
    });

    const redirectTo = user?.isOnboardingComplete ? '/saved' : '/onboarding';
    return NextResponse.redirect(new URL(redirectTo, req.url));
  } catch {
    return NextResponse.redirect(new URL('/login?error=server_error', req.url));
  }
}
