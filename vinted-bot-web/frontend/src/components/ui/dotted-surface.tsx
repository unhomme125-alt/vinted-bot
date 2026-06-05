'use client';
import { cn } from '@/lib/utils';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// NB: le composant d'origine lisait le thème via `next-themes`. En Vite on
// expose une prop `theme` (défaut 'dark'). `accent` = teinte turquoise Vinted
// (0..1) appliquée aux particules proches du centre (= sous le logo), pour que
// le logo paraisse être la source du paysage de points.
type DottedSurfaceProps = Omit<React.ComponentProps<'div'>, 'ref'> & {
	theme?: 'light' | 'dark';
	accent?: [number, number, number];
};

export function DottedSurface({
	className,
	theme = 'dark',
	accent = [0.13, 0.78, 0.83],
	...props
}: DottedSurfaceProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const sceneRef = useRef<{
		renderer: THREE.WebGLRenderer;
		animationId: number;
	} | null>(null);

	useEffect(() => {
		if (!containerRef.current) return;

		const SEPARATION = 150;
		const AMOUNTX = 40;
		const AMOUNTY = 60;
		const CLUSTER = 1800; // particules de densité au centre (sous le logo)

		const scene = new THREE.Scene();
		// Brouillard sombre : les points lointains se fondent dans le noir (profondeur).
		scene.fog = new THREE.Fog(0x05090b, 1400, 5200);

		const camera = new THREE.PerspectiveCamera(
			60,
			window.innerWidth / window.innerHeight,
			1,
			10000,
		);
		camera.position.set(0, 355, 1220);

		const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setClearColor(0x000000, 0);
		containerRef.current.appendChild(renderer.domElement);

		const baseGray = theme === 'dark' ? 0.82 : 0.12;
		const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

		// ── Grille principale (le paysage) ──────────────────────────────
		const gridPositions: number[] = [];
		const gridColors: number[] = [];
		for (let ix = 0; ix < AMOUNTX; ix++) {
			for (let iy = 0; iy < AMOUNTY; iy++) {
				const x = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
				const z = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;
				gridPositions.push(x, 0, z);
				// Reflet turquoise plus marqué près du centre.
				const r = Math.hypot(x, z);
				const h = Math.exp(-r / 1100);
				gridColors.push(
					lerp(baseGray, accent[0], h),
					lerp(baseGray, accent[1], h),
					lerp(baseGray, accent[2], h),
				);
			}
		}
		const gridBase = Float32Array.from(gridPositions);
		const gridGeo = new THREE.BufferGeometry();
		gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3));
		gridGeo.setAttribute('color', new THREE.Float32BufferAttribute(gridColors, 3));
		const gridMat = new THREE.PointsMaterial({
			size: 7,
			vertexColors: true,
			transparent: true,
			opacity: 0.85,
			sizeAttenuation: true,
			depthWrite: false,
		});
		const gridPoints = new THREE.Points(gridGeo, gridMat);
		scene.add(gridPoints);

		// ── Amas central : densité + lueur turquoise sous le logo ───────
		const clusterPositions: number[] = [];
		const clusterColors: number[] = [];
		for (let j = 0; j < CLUSTER; j++) {
			const a = Math.random() * Math.PI * 2;
			// puissance > 1 => concentration vers le centre (densité plus forte).
			const rad = Math.pow(Math.random(), 1.8) * 1700;
			const x = Math.cos(a) * rad;
			const z = Math.sin(a) * rad;
			clusterPositions.push(x, 0, z);
			const b = Math.min(1.25, 0.45 + 0.75 * Math.exp(-rad / 950));
			clusterColors.push(accent[0] * b, accent[1] * b, accent[2] * b);
		}
		const clusterBase = Float32Array.from(clusterPositions);
		const clusterGeo = new THREE.BufferGeometry();
		clusterGeo.setAttribute('position', new THREE.Float32BufferAttribute(clusterPositions, 3));
		clusterGeo.setAttribute('color', new THREE.Float32BufferAttribute(clusterColors, 3));
		const clusterMat = new THREE.PointsMaterial({
			size: 9,
			vertexColors: true,
			transparent: true,
			opacity: 0.9,
			sizeAttenuation: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending, // glow turquoise au centre
		});
		const clusterPoints = new THREE.Points(clusterGeo, clusterMat);
		scene.add(clusterPoints);

		let count = 0;
		let animationId = 0;

		// Onde circulaire (ripple) émanant du logo + attraction vers le centre.
		const ripple = (r: number, t: number) =>
			Math.sin(r * 0.012 - t * 2.2) * 22 * Math.exp(-r / 2600);
		const pull = (r: number, t: number) =>
			0.12 * Math.exp(-r / 750) * (0.85 + 0.15 * Math.sin(t * 0.6));

		const animate = () => {
			animationId = requestAnimationFrame(animate);

			// Grille
			const gp = gridGeo.attributes.position.array as Float32Array;
			let i = 0;
			for (let ix = 0; ix < AMOUNTX; ix++) {
				for (let iy = 0; iy < AMOUNTY; iy++) {
					const k = i * 3;
					const bx = gridBase[k];
					const bz = gridBase[k + 2];
					const r = Math.hypot(bx, bz);
					const p = pull(r, count);
					gp[k] = bx * (1 - p);
					gp[k + 1] =
						Math.sin((ix + count) * 0.3) * 50 +
						Math.sin((iy + count) * 0.5) * 50 +
						ripple(r, count);
					gp[k + 2] = bz * (1 - p);
					i++;
				}
			}
			gridGeo.attributes.position.needsUpdate = true;

			// Amas central
			const cp = clusterGeo.attributes.position.array as Float32Array;
			for (let j = 0; j < CLUSTER; j++) {
				const k = j * 3;
				const bx = clusterBase[k];
				const bz = clusterBase[k + 2];
				const r = Math.hypot(bx, bz);
				const p = pull(r, count);
				cp[k] = bx * (1 - p);
				cp[k + 1] =
					Math.sin(bx * 0.0016 + count) * 22 +
					Math.sin(bz * 0.0016 + count * 1.2) * 22 +
					ripple(r, count) +
					6;
				cp[k + 2] = bz * (1 - p);
			}
			clusterGeo.attributes.position.needsUpdate = true;

			renderer.render(scene, camera);
			count += 0.1;
		};

		const handleResize = () => {
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(window.innerWidth, window.innerHeight);
		};
		window.addEventListener('resize', handleResize);

		animate();
		sceneRef.current = { renderer, animationId };

		return () => {
			window.removeEventListener('resize', handleResize);
			cancelAnimationFrame(animationId);
			scene.traverse((object) => {
				if (object instanceof THREE.Points) {
					object.geometry.dispose();
					if (Array.isArray(object.material)) {
						object.material.forEach((m) => m.dispose());
					} else {
						object.material.dispose();
					}
				}
			});
			renderer.dispose();
			if (containerRef.current && renderer.domElement) {
				containerRef.current.removeChild(renderer.domElement);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [theme, accent[0], accent[1], accent[2]]);

	return (
		<div
			ref={containerRef}
			className={cn('pointer-events-none fixed inset-0 -z-1', className)}
			{...props}
		/>
	);
}
