/** Fixed-aspect pulse box for hero/avatar media while loading. */
export function MediaSkeleton({
	className = 'aspect-[7/10] w-full',
	label = 'Загрузка'
}: {
	className?: string;
	label?: string;
}) {
	return (
		<div
			role="status"
			aria-label={label}
			className={`media-skeleton rounded-md border border-line/50 bg-panel2/80 ${className}`}
		/>
	);
}

/** Route-level placeholder: brand text + pulse strips, no images. */
export function RouteSkeleton({ title }: { title: string }) {
	return (
		<main className="mx-auto max-w-shell space-y-6 px-4 py-10 md:px-6 lg:px-10" aria-busy="true">
			<p className="text-sm text-muted">{title}</p>
			<div className="space-y-3" aria-hidden="true">
				<MediaSkeleton className="h-10 w-2/3 max-w-md" />
				<MediaSkeleton className="h-24 w-full" />
				<MediaSkeleton className="h-24 w-full" />
				<MediaSkeleton className="h-40 w-full md:h-48" />
			</div>
		</main>
	);
}
