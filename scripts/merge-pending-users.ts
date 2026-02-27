/**
 * One-off script: merge placeholder "pending-" users with real Supabase users.
 *
 * When a user is invited as a trip collaborator before they have an account,
 * a placeholder User record is created with supabaseId = "pending-<email>".
 * If they later sign up, a second User record may exist with the real supabaseId.
 *
 * This script:
 *   1. Finds all "pending-*" users
 *   2. For each, checks if a real (non-pending) user exists with the same email
 *   3. If so, migrates all relationships (trips, collaborators, saved places, etc.)
 *      from the pending user to the real user, then deletes the pending record
 *   4. If no real user exists yet, leaves the pending record — it will be linked
 *      automatically on first login via the updated getUser() logic
 *
 * Run: npx tsx scripts/merge-pending-users.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const pendingUsers = await prisma.user.findMany({
    where: { supabaseId: { startsWith: 'pending-' } },
  });

  console.log(`Found ${pendingUsers.length} pending user(s)\n`);

  for (const pending of pendingUsers) {
    console.log(`─── ${pending.email} (id: ${pending.id}, supabaseId: ${pending.supabaseId})`);

    // Check for a real user with the same email
    const realUser = await prisma.user.findFirst({
      where: {
        email: pending.email,
        NOT: { supabaseId: { startsWith: 'pending-' } },
      },
    });

    if (!realUser) {
      console.log(`  → No real user found yet — will be linked on first login\n`);
      continue;
    }

    console.log(`  → Found real user: id=${realUser.id}, supabaseId=${realUser.supabaseId}`);

    // Migrate all relationships from pending → real user
    const updates: string[] = [];

    // Trips owned by the pending user
    const tripsUpdated = await prisma.trip.updateMany({
      where: { userId: pending.id },
      data: { userId: realUser.id },
    });
    if (tripsUpdated.count > 0) updates.push(`${tripsUpdated.count} trip(s)`);

    // Trip collaborators
    const collabsUpdated = await prisma.tripCollaborator.updateMany({
      where: { userId: pending.id },
      data: { userId: realUser.id },
    });
    if (collabsUpdated.count > 0) updates.push(`${collabsUpdated.count} collaborator record(s)`);

    // Trip collaborators invited by the pending user
    const invitesUpdated = await prisma.tripCollaborator.updateMany({
      where: { invitedBy: pending.id },
      data: { invitedBy: realUser.id },
    });
    if (invitesUpdated.count > 0) updates.push(`${invitesUpdated.count} invite(s)`);

    // Saved places
    const placesUpdated = await prisma.savedPlace.updateMany({
      where: { userId: pending.id },
      data: { userId: realUser.id },
    });
    if (placesUpdated.count > 0) updates.push(`${placesUpdated.count} saved place(s)`);

    // Shortlists
    const shortlistsUpdated = await prisma.shortlist.updateMany({
      where: { userId: pending.id },
      data: { userId: realUser.id },
    });
    if (shortlistsUpdated.count > 0) updates.push(`${shortlistsUpdated.count} shortlist(s)`);

    // Share links
    const shareLinksUpdated = await prisma.shareLink.updateMany({
      where: { userId: pending.id },
      data: { userId: realUser.id },
    });
    if (shareLinksUpdated.count > 0) updates.push(`${shareLinksUpdated.count} share link(s)`);

    // Nylas grants
    const nylasUpdated = await prisma.nylasGrant.updateMany({
      where: { userId: pending.id },
      data: { userId: realUser.id },
    });
    if (nylasUpdated.count > 0) updates.push(`${nylasUpdated.count} nylas grant(s)`);

    // Slot notes
    const slotNotesUpdated = await prisma.slotNote.updateMany({
      where: { userId: pending.id },
      data: { userId: realUser.id },
    });
    if (slotNotesUpdated.count > 0) updates.push(`${slotNotesUpdated.count} slot note(s)`);

    // Trip activity
    const activityUpdated = await prisma.tripActivity.updateMany({
      where: { userId: pending.id },
      data: { userId: realUser.id },
    });
    if (activityUpdated.count > 0) updates.push(`${activityUpdated.count} activity record(s)`);

    if (updates.length > 0) {
      console.log(`  → Migrated: ${updates.join(', ')}`);
    } else {
      console.log(`  → No relationships to migrate`);
    }

    // Delete the pending user record
    await prisma.user.delete({ where: { id: pending.id } });
    console.log(`  → Deleted pending user record\n`);
  }

  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
