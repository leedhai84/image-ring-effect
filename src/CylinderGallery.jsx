import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

// ── CONFIG (CYLINDER STACKED LOOK) ───────────────────────────────────────────
const RING_RADIUS = '42vmin';
const RING_TILT_DEG = 82;       // Flat look for cylinder effect
const PERSP = 2400;
const CARD_W = 70;              // Portrait width
const CARD_H = 110;             // Portrait height
const TOTAL_IMAGES = 80;        // Increased to 80 images as requested
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
    const [hoveredIndex, setHoveredIndex] = useState(null);

    // UNIFORM DISTRIBUTION (Evenly spaced around the ring)
    const allImages = useMemo(() => {
        const imgs = [];
        const gap = 360 / TOTAL_IMAGES;
        for (let i = 0; i < TOTAL_IMAGES; i++) {
            const angleDeg = i * gap;
            // Map each image to a category for the central preview seed
            const catIndex = Math.floor((i / TOTAL_IMAGES) * N_CATS);
            imgs.push({
                key: `img-${i}`,
                angleDeg,
                cat: CATS[catIndex],
                index: i
            });
        }
        return imgs;
    }, []);

    useEffect(() => {
        let id;
        const sync = () => {
            const spin = spinSpring.get();
            const radiusPx = (parseFloat(RING_RADIUS) * Math.min(window.innerWidth, window.innerHeight)) / 100;

            let maxZ = -Infinity;
            let currentFocalImg = null;

            // Find which actual image is closest to the front (max Z)
            allImages.forEach((img) => {
                const p = computeTransform(img.angleDeg, spin);
                if (p.z > maxZ) {
                    maxZ = p.z;
                    currentFocalImg = img;
                }
            });

            // Determine which image to show and which category is active
            const displayImg = hoveredIndex !== null ? allImages[hoveredIndex] : currentFocalImg;
            const front = CATS.findIndex(c => c.name === displayImg.cat.name);

            if (front !== activeCat) setActive(front);

            // Direct DOM update for the focal center image to achieve "stop-motion" instant swaps
            const focalWrapEl = document.getElementById('focal-wrap');
            const focalImgEl = document.getElementById('focal-image');
            const captionEl = document.getElementById('focal-caption');
            
            if (focalWrapEl) {
                // Show if hovered OR if dragging (to maintain frame-by-frame feel)
                if (hoveredIndex === null && !isDragging) {
                    focalWrapEl.style.opacity = '0';
                    focalWrapEl.style.visibility = 'hidden';
                } else {
                    focalWrapEl.style.opacity = '1';
                    focalWrapEl.style.visibility = 'visible';
                    
                    const activeImg = hoveredIndex !== null ? allImages[hoveredIndex] : currentFocalImg;
                    if (activeImg) {
                        const newSrc = `https://picsum.photos/seed/${activeImg.cat.seed + activeImg.index}/800/450`;
                        const newCaption = activeImg.cat.name;

                        if (focalImgEl && focalImgEl.getAttribute('src') !== newSrc) {
                            focalImgEl.setAttribute('src', newSrc);
                        }
                        if (captionEl && captionEl.innerText !== newCaption) {
                            captionEl.innerText = newCaption;
                        }
                    }
                }
            }

            if (containerRef.current) {
                const els = Array.from(containerRef.current.children);
                allImages.forEach((img, i) => {
                    const el = els[i];
                    if (!el) return;
                    const p = computeTransform(img.angleDeg, spin);

                    if (p.z < -radiusPx * 2.5) { // Relax burial threshold to avoid gaps
                        el.style.display = 'none';
                    } else {
                        el.style.display = 'block';
                        el.style.transform = p.transform;
                        el.style.zIndex = Math.round(p.z + 1000);
                        el.style.opacity = p.depthOpacity;
                    }

                    // Apply active focus styling to the specific ring item being hovered
                    if (hoveredIndex === i) {
                        el.style.zIndex = "2000"; // Bring to top
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
    }, [spinSpring, allImages, activeCat, hoveredIndex]);

    const onDragStart = useCallback(() => { setDragging(true); }, []);
    const onDrag = useCallback((e, info) => {
        // Lấy tọa độ Y của chuột/tay từ sự kiện
        const clientY = e.clientY || (e.touches && e.touches[0].clientY) || info.point.y;
        const screenMidY = window.innerHeight / 2;
        
        // Nếu kéo ở nửa dưới màn hình (y > screenMidY), đảo ngược hướng xoay delta.x
        // Điều này tạo cảm giác tự nhiên khi xoay một vòng tròn 3D
        const multiplier = clientY > screenMidY ? -1 : 1;
        
        spinRef.current += info.delta.x * DRAG_FACTOR * multiplier;
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
                    {allImages.map((img, idx) => (
                        <div
                            key={img.key}
                            className={`ring-item ${hoveredIndex === idx ? 'ring-item-hovered' : ''}`}
                            onMouseEnter={() => setHoveredIndex(idx)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            style={{ width: CARD_W + 8, height: CARD_H + 8 }}
                        >
                            <img
                                src={`https://picsum.photos/seed/${img.cat.seed + img.index}/200/300`}
                                alt=""
                                draggable={false}
                                className="ring-img"
                                style={{ width: CARD_W, height: CARD_H }}
                            />
                        </div>
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
                    <div id="focal-wrap" className="feature-wrap" style={{ opacity: 0, visibility: 'hidden', transition: 'opacity 0.2s, visibility 0.2s' }}>
                        <div className="feature-img-box">
                            <img 
                                id="focal-image"
                                src="" 
                                alt="" 
                            />
                        </div>
                    </div>
                </div>
            </motion.div>

            <div className="hint-footer">Drag to explore</div>
        </div>
    );
}
