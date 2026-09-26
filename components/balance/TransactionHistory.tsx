import React from 'react';

export default function TransactionHistory({ items }: { items: Array<{ id: string; description: string; amount: number; createdAt: string | Date }> }) {
	return (
		<div className="space-y-2">
			{items.map((t) => (
				<div key={t.id} className="flex justify-between bg-gray-900 border border-gray-800 rounded p-3">
					<div>{t.description}</div>
					<div className={t.amount >= 0 ? 'text-green-400' : 'text-red-400'}>
						{t.amount >= 0 ? '+' : ''}{(t.amount / 100).toFixed(2)} ₽
					</div>
				</div>
			))}
		</div>
	);
}













