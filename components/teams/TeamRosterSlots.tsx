import { RankMedal } from '@/components/dota/RankMedal';
import { SteamAvatar } from '@/components/desk/SteamAvatar';
import { formatOpenDotaMmrCompact, medalCaption } from '@/lib/dota-rank';
import { playerCardHref } from '@/lib/site';
import { partySearchHref, type RosterSlotPlayer } from '@/lib/team-roster';

export function TeamRosterSlots({
	members,
	teamId,
	tournamentId,
	compact = false
}: {
	members: RosterSlotPlayer[];
	teamId?: string | null;
	tournamentId?: string | null;
	compact?: boolean;
}) {
	const slots = Array.from({ length: 5 }, (_, index) => members[index] ?? null);
	const invite = partySearchHref({ teamId, tournamentId, tab: 'players' });
	return (
		<ul className="grid grid-cols-5 gap-1.5">
			{slots.map((member, index) => (
				<li key={member?.id ?? `empty-${index}`} className="min-w-0">
					<span
						aria-hidden="true"
						className={`mb-2 block h-1.5 w-full rounded-full ${member?.hasSteam ? 'bg-aegis' : 'bg-line'}`}
					/>
					{member ? (
						<a href={member.href || playerCardHref(member.id)} className="flex flex-col items-center gap-1 text-center hover:opacity-90">
							<span className="flex items-center justify-center gap-0.5">
								<SteamAvatar url={member.avatarUrl} name={member.displayName} className="h-8 w-8 border border-line" />
								{member.medal && (
									<RankMedal
										tier={member.medal.tier}
										stars={member.medal.stars}
										leaderboard={member.medal.leaderboard}
										size={24}
										showLabel={false}
									/>
								)}
							</span>
							<span className="w-full truncate text-[10px] leading-4 text-cream">{member.displayName}</span>
							<span
								className="w-full truncate text-[10px] leading-4 text-muted"
								title={
									member.mmr
										? `${member.medal ? `${medalCaption(member.medal)} · ` : ''}${member.mmr.source === 'estimate' ? 'оценка OpenDota' : 'MMR OpenDota'} ${member.mmr.value}`
										: undefined
								}
							>
								{member.mmr
									? formatOpenDotaMmrCompact(member.mmr)
									: member.medal
										? medalCaption(member.medal)
										: member.hasSteam
											? 'без MMR'
											: 'нет Steam'}
							</span>
						</a>
					) : (
						<a href={invite} aria-label="пригласить" className="flex flex-col items-center gap-1 text-center hover:opacity-90">
							<span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-aegis/50 text-sm text-aegisSoft">
								+
							</span>
							{compact ? null : <span className="text-[10px] leading-4 text-aegisSoft">пригласить</span>}
						</a>
					)}
				</li>
			))}
		</ul>
	);
}
