import { AppearanceEditor } from '@/components/admin/AppearanceEditor';
import { getSiteAppearance } from '@/server/site-appearance';
import { s3Configured } from '@/server/storage/s3';

export default async function AdminAppearancePage() {
	return <AppearanceEditor initialAppearance={await getSiteAppearance()} s3Available={s3Configured()} />;
}
