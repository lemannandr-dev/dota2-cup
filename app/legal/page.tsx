import type { Metadata } from 'next';
import { LegalDesk } from '@/components/legal/LegalDesk';

export const metadata: Metadata = {
	title: 'Правовое',
	description:
		'Aegis Arena — независимая платформа сообщества. Не оферта Valve и не лицензия на Dota 2. Открытые материалы сети остаются под правами своих разработчиков. Steam OpenID, сессия, источники цифр.',
	alternates: { canonical: '/legal' }
};

export default function LegalPage() {
	return <LegalDesk />;
}
