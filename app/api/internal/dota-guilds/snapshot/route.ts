import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { guildSnapshotSchema } from '@/lib/guild-snapshot';
import { bearerMatches } from '@/server/auth/tokens';

function isAuthorized(req: NextRequest): boolean {
	return bearerMatches(req.headers.get('authorization'), process.env.DOTA_GC_INTERNAL_TOKEN);
}

export async function POST(req: NextRequest) {
	if (!isAuthorized(req)) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = guildSnapshotSchema.safeParse(await req.json().catch(() => null));
	if (!body.success) {
		return NextResponse.json({ error: 'Invalid guild snapshot', details: body.error.flatten() }, { status: 400 });
	}

	const input = body.data;
	const capturedAt = input.capturedAt ? new Date(input.capturedAt) : new Date();
	const rawPayload = JSON.parse(JSON.stringify(input.payload)) as Prisma.InputJsonValue;

	const guild = await prisma.$transaction(async (tx) => {
		const nextGuild = await tx.dotaGuild.upsert({
			where: { guildId: input.guildId },
			create: {
				guildId: input.guildId,
				name: input.name,
				tag: input.tag,
				avatarUrl: input.avatarUrl,
				points: input.points,
				leaderboardRank: input.leaderboardRank,
				level: input.level,
				lastSyncedAt: capturedAt
			},
			update: {
				name: input.name,
				tag: input.tag,
				avatarUrl: input.avatarUrl,
				points: input.points,
				leaderboardRank: input.leaderboardRank,
				level: input.level,
				lastSyncedAt: capturedAt
			}
		});

		for (const member of input.members) {
			const user = await tx.user.findUnique({
				where: { steamId: member.steamId },
				select: { id: true }
			});
			await tx.dotaGuildMember.upsert({
				where: { guildId_steamId: { guildId: nextGuild.id, steamId: member.steamId } },
				create: {
					guildId: nextGuild.id,
					steamId: member.steamId,
					displayName: member.displayName,
					role: member.role,
					points: member.points,
					joinedAt: member.joinedAt ? new Date(member.joinedAt) : undefined,
					userId: user?.id
				},
				update: {
					displayName: member.displayName,
					role: member.role,
					points: member.points,
					joinedAt: member.joinedAt ? new Date(member.joinedAt) : undefined,
					userId: user?.id
				}
			});
		}

		await tx.dotaGuildSnapshot.create({
			data: {
				guildId: nextGuild.id,
				points: input.points,
				leaderboardRank: input.leaderboardRank,
				level: input.level,
				payload: rawPayload,
				capturedAt
			}
		});

		return nextGuild;
	});

	return NextResponse.json({ guildId: guild.guildId, storedAt: capturedAt.toISOString() }, { status: 201 });
}