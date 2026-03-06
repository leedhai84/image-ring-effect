import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

// ── CONFIG ────────────────────────────────────────────────────────────────────
const RING_RADIUS = 880;    // Even wider
const RING_TILT_DEG = 82;     // Flatter
const PERSP = 2200;   // Higher
const CARD_W = 90;
const CARD_H = 160;    // Much taller
const STACK_COUNT = 46;     // More dense
const STACK_GAP_DEG = 0.8;    // Tighter
const DRAG_FACTOR = 0.10;
const DECAY = 0.95;
const AUTO_SPEED = 0.04;

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
const N = CATS.length;
const SLOT_DEG = 360 / N;

// ── 3D PROJECTION MATH ────────────────────────────────────────────────────────
const DEG = Math.PI / 180;
const TILT = RING_TILT_DEG * DEG;
const cosTilt = Math.cos(TILT);
const sinTilt = Math.sin(TILT);

function computeTransform(angleDeg, spinDeg) {
    const phi = (angleDeg + spinDeg) * DEG;
    // Raw cylinder point (upright Y=0)
    const wx = RING_RADIUS * Math.sin(phi);
    const wy = 0;
    const wz = RING_RADIUS * Math.cos(phi);

    // Apply world tilt around X-axis
    const sy = wy * cosTilt - wz * sinTilt;
    const sz = wy * sinTilt + wz * cosTilt;

    // Final Screen Projection
    const sc = PERSP / (PERSP - sz);
    const tx = wx * sc;
    const ty = sy * sc;

    // Local card rotation to face outward + counter-tilt to stay vertical
    const cardRotY = (angleDeg + spinDeg);
    const cardRotX = -RING_TILT_DEG;

    return {
        transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px) rotateX(${cardRotX}deg) rotateY(${cardRotY}deg) scale(${sc * 0.9})`,
        screenX: tx,
        screenY: ty,
        z: sz,
        sc
    };
}

const ALL_IMAGES = [];
for (let si = 0; si < N; si++) {
    const half = ((STACK_COUNT - 1) / 2) * STACK_GAP_DEG;
    for (let ji = 0; ji < STACK_COUNT; ji++) {
        const angleDeg = si * SLOT_DEG - half + ji * STACK_GAP_DEG;
        ALL_IMAGES.push({ key: `${si}-${ji}`, angleDeg, cat: CATS[si], ji });
    }
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function CylinderGallery() {
    const spinMV = useMotionValue(0);
    const spinSpring = useSpring(spinMV, { stiffness: 40, damping: 20, mass: 1 });

    const spinRef = useRef(0);
    const velRef = useRef(0);
    const momentRef = useRef(null);
    const autoRef = useRef(null);

    const [cards, setCards] = useState([]);
    const [slotProjs, setSlotProjs] = useState([]);
    const [activeCat, setActive] = useState(0);
    const [isDragging, setDragging] = useState(false);

    // Frame Loop
    useEffect(() => {
        let id;
        const sync = () => {
            const spin = spinSpring.get();

            // Slot centers for labels
            const sp = CATS.map((_, i) => computeTransform(i * SLOT_DEG, spin));
            setSlotProjs(sp);

            // Find active (closest to front)
            let maxZ = -Infinity, front = 0;
            sp.forEach((p, i) => { if (p.z > maxZ) { maxZ = p.z; front = i; } });
            setActive(front);

            // Batch compute all card positions
            const computed = ALL_IMAGES.map(img => ({
                ...img,
                ...computeTransform(img.angleDeg, spin),
            }));

            // Sort by depth (Painter's Algorithm)
            computed.sort((a, b) => a.z - b.z);
            setCards(computed);

            id = requestAnimationFrame(sync);
        };
        id = requestAnimationFrame(sync);
        return () => cancelAnimationFrame(id);
    }, [spinSpring]);

    // Auto rotation
    useEffect(() => {
        const tick = () => {
            if (!isDragging) {
                spinRef.current += AUTO_SPEED;
                spinMV.set(spinRef.current);
            }
            autoRef.current = requestAnimationFrame(tick);
        };
        autoRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(autoRef.current);
    }, [spinMV, isDragging]);

    const stopMoment = useCallback(() => { cancelAnimationFrame(momentRef.current); }, []);

    const onDragStart = useCallback(() => { stopMoment(); setDragging(true); }, [stopMoment]);

    const onDrag = useCallback((_, info) => {
        spinRef.current += info.delta.x * DRAG_FACTOR;
        spinMV.set(spinRef.current);
        velRef.current = info.velocity.x;
    }, [spinMV]);

    const onDragEnd = useCallback(() => {
        setDragging(false);
        let v = velRef.current * DRAG_FACTOR * 0.4;
        const tick = () => {
            if (Math.abs(v) < 0.02) return;
            spinRef.current += v;
            spinMV.set(spinRef.current);
            v *= DECAY;
            momentRef.current = requestAnimationFrame(tick);
        };
        momentRef.current = requestAnimationFrame(tick);
    }, [spinMV]);

    const cat = CATS[activeCat];

    return (
        <div className="root">
            {/* GLOBAL NAV */}
            <nav className="top-nav">
                <div className="nav-left">
                    <span className="nav-active">Projects</span>
                    <span>Info</span>
                    <span>Contact</span>
                </div>
            </nav>

            {/* 3D INTERACTION STAGE */}
            <motion.div
                className="scene"
                drag="x"
                dragElastic={0}
                onDragStart={onDragStart}
                onDrag={onDrag}
                onDragEnd={onDragEnd}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
                {/* THE RING */}
                <div className="ring-container">
                    {cards.map(card => (
                        <img
                            key={card.key}
                            src={`https://picsum.photos/seed/${card.cat.seed + card.ji}/200/300`}
                            width={CARD_W}
                            height={CARD_H}
                            alt=""
                            draggable={false}
                            className="ring-img"
                            style={{ transform: card.transform, zIndex: Math.round(card.z + 1000) }}
                        />
                    ))}
                </div>

                {/* LABELS FOLLOW THE ELLIPSE */}
                <div className="labels-layer">
                    {CATS.map((c, i) => {
                        const p = slotProjs[i];
                        if (!p) return null;

                        // Adjust label position to be outside the ring arc
                        const hoverScale = (p.z / RING_RADIUS + 1) * 0.5; // (0 to 1 range)
                        const opacity = 0.2 + 0.8 * hoverScale;
                        const isCenter = i === activeCat;

                        return (
                            <div
                                key={i}
                                className={`label ${isCenter ? 'label-active' : ''}`}
                                style={{
                                    transform: `translate(calc(-50% + ${p.screenX * 1.12}px), calc(-50% + ${p.screenY * 1.3}px))`,
                                    opacity: opacity,
                                    transformOrigin: 'center'
                                }}
                            >
                                {c.name}<sup className="sup-index">({c.n})</sup>
                            </div>
                        );
                    })}
                </div>

                {/* CENTER FEATURE (The focal point) */}
                <div className="feature-overlay">
                    <motion.div
                        key={activeCat}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="feature-wrap"
                    >
                        <h1 className="feature-title">Jianling Yuan<br />Shijiazhuang</h1>
                        <div className="feature-img-box">
                            <img src={`https://picsum.photos/seed/${cat.seed + 10}/800/450`} alt="" />
                        </div>
                        <p className="feature-caption">High Rise</p>
                    </motion.div>
                </div>
            </motion.div>

            {/* FOOTER CONTROLS / HINT */}
            <div className="hint-footer">
                Drag to explore
            </div>
        </div>
    );
}
