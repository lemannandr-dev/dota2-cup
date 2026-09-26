import { prisma } from '@/lib/prisma';
import { DEFAULT_SITE_APPEARANCE, SITE_APPEARANCE_ID, type SiteAppearance } from '@/lib/site-appearance';

function plainAppearance(value: SiteAppearance): SiteAppearance {
	return {
		id: value.id,
		appLogoUrl: value.appLogoUrl,
		dotaLogoUrl: value.dotaLogoUrl,
		mobileBackdropUrl: value.mobileBackdropUrl,
		homeCoverUrl: value.homeCoverUrl,
		motionEnabled: value.motionEnabled,
		backdropOpacity: value.backdropOpacity,
		backdropPositionY: value.backdropPositionY
	};
}

export async function getSiteAppearance(): Promise<SiteAppearance> {
	try {
		const current = await prisma.siteAppearance.findUnique({ where: { id: SITE_APPEARANCE_ID } });
		return current ? plainAppearance(current) : { ...DEFAULT_SITE_APPEARANCE };
	} catch {
		return { ...DEFAULT_SITE_APPEARANCE };
	}
}

export async function saveSiteAppearance(data: Partial<Omit<SiteAppearance, 'id'>>, updatedById: string) {
	return prisma.$transaction(async (tx) => {
	const saved = await tx.siteAppearance.upsert({
		where: { id: SITE_APPEARANCE_ID },
		create: {
			...DEFAULT_SITE_APPEARANCE,
			...data,
			id: SITE_APPEARANCE_ID,
			updatedById
		},
		update: { ...data, updatedById }
	});
	await tx.auditLog.create({ data: {
		actorId: updatedById, action: 'SITE_APPEARANCE_UPDATED', entity: 'SiteAppearance',
		entityId: SITE_APPEARANCE_ID, payload: data
	} });
	return plainAppearance(saved);
	});
}

export async function resetSiteAppearance(updatedById: string) {
	return prisma.$transaction(async (tx) => {
	const saved = await tx.siteAppearance.upsert({
		where: { id: SITE_APPEARANCE_ID },
		create: { ...DEFAULT_SITE_APPEARANCE, updatedById },
		update: { ...DEFAULT_SITE_APPEARANCE, updatedById }
	});
	await tx.auditLog.create({ data: {
		actorId: updatedById, action: 'SITE_APPEARANCE_RESET', entity: 'SiteAppearance', entityId: SITE_APPEARANCE_ID
	} });
	return plainAppearance(saved);
	});
}
