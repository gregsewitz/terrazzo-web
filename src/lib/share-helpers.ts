import { prisma } from '@/lib/prisma';

/**
 * Create or return an existing active share link for a resource.
 */
export async function createOrGetShareLink(userId: string, resourceType: string, resourceId: string) {
  // Check for existing active link
  const existing = await prisma.shareLink.findFirst({
    where: { resourceType, resourceId, userId, isActive: true },
  });

  if (existing) {
    return { shareLink: existing, url: `/shared/${existing.token}` };
  }

  // Create new share link
  const shareLink = await prisma.shareLink.create({
    data: { userId, resourceType, resourceId },
  });

  return { shareLink, url: `/shared/${shareLink.token}` };
}

/**
 * Revoke all share links for a resource.
 */
export async function revokeShareLinks(userId: string, resourceType: string, resourceId: string) {
  await prisma.shareLink.updateMany({
    where: { resourceType, resourceId, userId },
    data: { isActive: false },
  });
}

/**
 * Get the current share status for a resource.
 */
export async function getShareStatus(userId: string, resourceType: string, resourceId: string) {
  const shareLink = await prisma.shareLink.findFirst({
    where: { resourceType, resourceId, userId, isActive: true },
  });

  return {
    isShared: !!shareLink,
    shareLink: shareLink || null,
    url: shareLink ? `/shared/${shareLink.token}` : null,
  };
}
