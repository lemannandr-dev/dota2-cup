import { PrismaClient, Role, TransactionType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	console.log('Seeding users and a bonus code (no media/achievements)...');

	for (let i = 0; i < 5; i++) {
		const userIdNum = 10000000000 + i;
		const user = await prisma.user.upsert({
			where: { userId: `id${userIdNum}` },
			update: {},
			create: {
				userId: `id${userIdNum}`,
				displayName: `Player ${i + 1}`,
				username: `player_${i + 1}`,
				role: Role.USER,
				rating: 1000 + i * 10,
				balance: 5000
			}
		});

		const existingTx = await prisma.transaction.findFirst({
			where: { userId: user.id, description: 'Welcome bonus' }
		});
		if (!existingTx) {
			await prisma.transaction.create({
				data: { userId: user.id, type: TransactionType.BONUS, amount: 5000, balance: 5000, description: 'Welcome bonus' }
			});
		}
	}

	const creator = await prisma.user.findFirst();
	if (creator) {
		await prisma.bonusCode.upsert({
			where: { code: 'WELCOME100' },
			update: {},
			create: {
				code: 'WELCOME100',
				amount: 10000,
				description: 'Welcome 100 RUB',
				maxUses: 1000,
				isActive: true,
				createdById: creator.id
			}
		});
	}

	console.log('Seed completed.');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
