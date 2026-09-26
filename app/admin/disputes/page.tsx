import { redirect } from 'next/navigation';

/** Споры входят в единый `/admin/inbox` (день матча). */
export default function AdminDisputesRedirectPage() {
	redirect('/admin/inbox?filter=matchday');
}
