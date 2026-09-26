export class DomainError extends Error {
	constructor(
		message: string,
		public status = 400
	) {
		super(message);
		this.name = 'DomainError';
	}
}

export function toErrorResponse(error: unknown): { error: string; status: number } {
	if (error instanceof DomainError) {
		return { error: error.message, status: error.status };
	}
	if (error instanceof Error) {
		return { error: error.message, status: 400 };
	}
	return { error: 'Ошибка', status: 500 };
}
