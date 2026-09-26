import { prisma } from '../lib/prisma';
import { STAND_ADMIN_ID } from '../lib/stand-admin';

async function main() {
	const user = await prisma.user.update({
		where: { id: STAND_ADMIN_ID },
		data: { role: 'ADMIN' },
		select: { id: true, displayName: true, role: true, steamId: true }
	});
	const demoted = await prisma.user.updateMany({
		where: { role: 'ADMIN', id: { not: STAND_ADMIN_ID } },
		data: { role: 'ORGANIZER' }
	});
	await prisma.auditLog.create({
		data: {
			actorId: STAND_ADMIN_ID,
			action: 'STAND_ADMIN_GRANTED',
			entity: 'User',
			entityId: STAND_ADMIN_ID,
			payload: { demoted: demoted.count }
		}
	});
	console.log(JSON.stringify({ user, demoted: demoted.count }, null, 2));
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
