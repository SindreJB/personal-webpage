'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const items = [
	{ href: 'mailto:hello@jantelov.no', label: 'Kontakt', external: true },
	{ href: '/wishlist', label: 'Ønskeliste', external: false },
];

export default function CatalogMenu() {
	const [open, setOpen] = useState(false);
	const wrapRef = useRef<HTMLDivElement>(null);

	// Lukk på klikk utenfor og på Escape — en meny som henger igjen er verre
	// enn ingen meny.
	useEffect(() => {
		if (!open) return;

		function onPointerDown(event: MouseEvent) {
			if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
		}
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') setOpen(false);
		}

		document.addEventListener('mousedown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('mousedown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [open]);

	return (
		<div className="catalog-menu" ref={wrapRef}>
			<button
				type="button"
				className="catalog-menu-button"
				aria-label={open ? 'Lukk meny' : 'Åpne meny'}
				aria-expanded={open}
				aria-haspopup="true"
				onClick={() => setOpen((v) => !v)}
			>
				<span className="catalog-menu-bars" aria-hidden>
					<i />
					<i />
					<i />
				</span>
				<span className="catalog-menu-word">Meny</span>
			</button>

			{open && (
				<nav className="catalog-menu-panel" aria-label="Meny">
					{items.map((item) =>
						item.external ? (
							<a key={item.href} href={item.href} onClick={() => setOpen(false)}>
								{item.label}
							</a>
						) : (
							<Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
								{item.label}
							</Link>
						)
					)}
				</nav>
			)}
		</div>
	);
}
