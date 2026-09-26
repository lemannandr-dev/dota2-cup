'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';
type ToastItem = { id: number; message: string; tone: ToastTone };
type ToastContextValue = { showToast: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
	const [items, setItems] = useState<ToastItem[]>([]);
	const nextId = useRef(0);

	const dismiss = useCallback((id: number) => {
		setItems((current) => current.filter((item) => item.id !== id));
	}, []);

	const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
		const id = ++nextId.current;
		setItems((current) => [...current.slice(-2), { id, message, tone }]);
		window.setTimeout(() => dismiss(id), 3200);
	}, [dismiss]);

	return (
		<ToastContext.Provider value={{ showToast }}>
			{children}
			<div
				aria-live="polite"
				aria-atomic="false"
				className="pointer-events-none fixed inset-x-3 top-[calc(4.5rem+env(safe-area-inset-top))] z-[90] flex flex-col items-center gap-2 md:bottom-6 md:left-auto md:right-6 md:top-auto md:w-[360px]"
			>
				{items.map((item) => {
					const Icon = item.tone === 'success' ? CheckCircle2 : item.tone === 'error' ? AlertCircle : Info;
					const tone = item.tone === 'error' ? 'border-red-400/50 text-red-100' : item.tone === 'info' ? 'border-cyan-300/40 text-cyan-50' : 'border-radiant/50 text-cream';
					return (
						<div
							key={item.id}
							role={item.tone === 'error' ? 'alert' : 'status'}
							className={`pointer-events-auto flex min-h-12 w-full max-w-md items-center gap-3 rounded-lg border bg-panel/95 px-3 py-2 shadow-xl backdrop-blur-md animate-[modalRise_260ms_ease-out] ${tone}`}
						>
							<Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
							<p className="min-w-0 flex-1 text-sm">{item.message}</p>
							<button type="button" onClick={() => dismiss(item.id)} aria-label="Закрыть уведомление" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-white/5 hover:text-cream">
								<X className="h-4 w-4" aria-hidden="true" />
							</button>
						</div>
					);
				})}
			</div>
		</ToastContext.Provider>
	);
}

export function useToast() {
	const value = useContext(ToastContext);
	if (!value) throw new Error('useToast must be used inside ToastProvider');
	return value;
}
