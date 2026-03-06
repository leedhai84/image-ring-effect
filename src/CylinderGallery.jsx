import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

// ── CONFIG (CYLINDER STACKED LOOK) ───────────────────────────────────────────
const RING_RADIUS = '42vmin';
const RING_TILT_DEG = 82;       // Flat look for cylinder effect
const PERSP = 2400;
const CARD_W = 70;              // Portrait width
const CARD_H = 110;             // Portrait height
const STACK_COUNT = 40;         // High density stacks for the ribbon effect
const STACK_GAP_DEG = 0.8;      // Tight spacing for stacks
const DRAG_FACTOR = 0.12;
const DECAY = 0.98;

// ── DATA ──────────────────────────────────────────────────────────────────────
const CATS = [
    { name: 'Renovation', n: '19', seed: 10 },
    { name: 'Residential', n: '24', seed: 20 },
    { name: 'Shopping Mall', n: '42', seed: 30 },
    { name: 'Showroom', n: '12', seed: 40 },
    { name: 'Sports', n: '10', seed: 50 },
    { name: 'Store Design', n: '11', seed: 60 },
    { name: 'Transport', n: '31', seed: 70 },
    { name: 'Education', n: '18', seed: 80 },
    { name: 'Mixed Use', n: '31', seed: 90 },
    { name: 'Cultural', n: '23', seed: 100 },
    { name: 'Hospitality', n: '17', seed: 110 },
    { name: 'Leisure', n: '28', seed: 120 },
    { name: 'Office', n: '34', seed: 130 },
    { name: 'Outdoor Retail', n: '33', seed: 140 },
];
const N_CATS = CATS.length;
const SLOT_DEG = 360 / N_CATS;

// ── 3D PROJECTION MATH ────────────────────────────────────────────────────────
const DEG = Math.PI / 180;
const TILT = RING_TILT_DEG * DEG;
const cosTilt = Math.cos(TILT);
const sinTilt = Math.sin(TILT);

function computeTransform(angleDeg, spinDeg) {
    const phi = (angleDeg + spinDeg) * DEG;
    const radiusPx = (parseFloat(RING_RADIUS) * Math.min(window.innerWidth, window.innerHeight)) / 100;

    const wx = radiusPx * Math.sin(phi);
    const wy = 0;
    const wz = radiusPx * Math.cos(phi);

    const sy = wy * cosTilt - wz * sinTilt;
    const sz = wy * sinTilt + wz * cosTilt;

    const sc = PERSP / (PERSP - sz);
    const tx = wx * sc;
    const ty = sy * sc;

    const cardRotY = (angleDeg + spinDeg);
    const cardRotX = -RING_TILT_DEG;
    const baseScale = sc * 0.9;

    // Opacity based on depth
    const depthOpacity = Math.max(0.2, (sz / radiusPx + 1) * 0.5);

    return {
        // ROTATION IS BACK: rotateX and rotateY create the cylinder curvature
        transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px) rotateX(${cardRotX}deg) rotateY(${cardRotY}deg) scale(${baseScale})`,
        screenX: tx,
        screenY: ty,
        z: sz,
        depthOpacity
    };
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function CylinderGallery() {
    const spinMV = useMotionValue(0);
    const spinSpring = useSpring(spinMV, { stiffness: 45, damping: 25, mass: 1 });

    const spinRef = useRef(0);
    const containerRef = useRef(null);
    const labelsRef = useRef(null);

    const [activeCat, setActive] = useState(0);
    const [isDragging, setDragging] = useState(false);

    // STACKED DISTRIBUTION (Back to category groups)
    const allImages = useMemo(() => {
        const imgs = [];
        for (let si = 0; si < N_CATS; si++) {
            const half = ((STACK_COUNT - 1) / 2) * STACK_GAP_DEG;
            for (let ji = 0; ji < STACK_COUNT; ji++) {
                const angleDeg = si * SLOT_DEG - half + ji * STACK_GAP_DEG;
                imgs.push({
                    key: `stack-${si}-${ji}`,
                    angleDeg,
                    cat: CATS[si],
                    ji
                });
            }
        }
        return imgs;
    }, []);

    useEffect(() => {
        let id;
        const sync = () => {
            const spin = spinSpring.get();
            const radiusPx = (parseFloat(RING_RADIUS) * Math.min(window.innerWidth, window.innerHeight)) / 100;

            let maxZ = -Infinity, front = 0;
            CATS.forEach((_, i) => {
                const p = computeTransform(i * SLOT_DEG, spin);
                if (p.z > maxZ) { maxZ = p.z; front = i; }
            });
            if (front !== activeCat) setActive(front);

            if (containerRef.current) {
                const els = Array.from(containerRef.current.children);
                allImages.forEach((img, i) => {
                    const el = els[i];
                    if (!el) return;
                    const p = computeTransform(img.angleDeg, spin);

                    if (p.z < -radiusPx * 1.5) {
                        el.style.display = 'none';
                    } else {
                        el.style.display = 'block';
                        el.style.transform = p.transform;
                        el.style.zIndex = Math.round(p.z + 1000);
                        el.style.opacity = p.depthOpacity;
                    }
                });
            }

            if (labelsRef.current) {
                const labelEls = Array.from(labelsRef.current.children);
                CATS.forEach((_, i) => {
                    const el = labelEls[i];
                    if (!el) return;
                    const p = computeTransform(i * SLOT_DEG, spin);
                    const hoverScale = (p.z / radiusPx + 1) * 0.5;
                    const opacity = 0.2 + 0.8 * hoverScale;

                    el.style.transform = `translate(calc(-50% + ${p.screenX * 1.15}px), calc(-50% + ${p.screenY * 1.35}px))`;
                    el.style.opacity = isNaN(opacity) ? 0.2 : opacity;

                    if (i === front) el.classList.add('label-active');
                    else el.classList.remove('label-active');
                });
            }
            id = requestAnimationFrame(sync);
        };
        id = requestAnimationFrame(sync);
        return () => cancelAnimationFrame(id);
    }, [spinSpring, allImages, activeCat]);

    const onDragStart = useCallback(() => { setDragging(true); }, []);
    const onDrag = useCallback((_, info) => {
        spinRef.current += info.delta.x * DRAG_FACTOR;
        spinMV.set(spinRef.current);
    }, [spinMV]);
    const onDragEnd = useCallback(() => { setDragging(false); }, []);

    const activeCatData = CATS[activeCat];

    return (
        <div className="root">
            <nav className="top-nav">
                <div className="nav-left">
                    <span className="nav-active">Projects</span>
                    <span>Info</span>
                    <span>Contact</span>
                </div>
            </nav>

            <motion.div
                className="scene"
                onPanStart={onDragStart}
                onPan={onDrag}
                onPanEnd={onDragEnd}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
                <div className="ring-container" ref={containerRef}>
                    {allImages.map(img => (
                        <img
                            key={img.key}
                            src={`https://picsum.photos/seed/${img.cat.seed + img.ji}/200/300`}
                            alt=""
                            draggable={false}
                            className="ring-img"
                            style={{ width: CARD_W, height: CARD_H }}
                        />
                    ))}
                </div>

                <div className="labels-layer" ref={labelsRef}>
                    {CATS.map((c, i) => (
                        <div key={i} className="label">
                            {c.name}<sup className="sup-index">({c.n})</sup>
                        </div>
                    ))}
                </div>

                <div className="feature-overlay">
                    <motion.div
                        key={activeCat}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="feature-wrap"
                    >
                        <h1 className="feature-title">Tianfu Sihe Sky Park<br />Community</h1>
                        <div className="feature-img-box">
                            <img src={`https://picsum.photos/seed/${activeCatData.seed + 10}/800/450`} alt="" />
                        </div>
                        <p className="feature-caption">{activeCatData.name}</p>
                    </motion.div>
                </div>
            </motion.div>

            <div className="hint-footer">Drag to explore</div>
        </div>
    );
}
