import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { platformLetters } from '../app/utils/threeHelpers';

// Strip 8-digit hex alpha (#RRGGBBAA → #RRGGBB)
function safeHex(hex: string, fallback = '#6366f1'): string {
  if (!hex) return fallback;
  const h = hex.trim();
  if (h.startsWith('#') && h.length === 9) return h.slice(0, 7);
  return h;
}

// Build a canvas texture for the label — avoids drei/Text font network fetch
function makeLabel(text: string, price: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 128);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 52);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '24px sans-serif';
  ctx.fillText(`₹${price}`, 128, 96);
  return new THREE.CanvasTexture(canvas);
}

interface SubCardProps {
  position: [number, number, number];
  platform: string;
  price: number;
  colorFrom: string;
  colorTo: string;
  index: number;
  onClick?: () => void;
}

function SubCard({ position, platform, price, colorFrom, colorTo, index, onClick }: SubCardProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const color1 = useMemo(() => {
    try { return new THREE.Color(safeHex(colorFrom)); } catch { return new THREE.Color('#6366f1'); }
  }, [colorFrom]);

  const labelTexture = useMemo(() => {
    const letter = platformLetters[platform] ?? (platform?.[0] ?? '?');
    return makeLabel(letter, price);
  }, [platform, price]);

  const labelMaterial = useMemo(() =>
    new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true, depthWrite: false }),
  [labelTexture]);

  const labelGeometry = useMemo(() => new THREE.PlaneGeometry(2.0, 1.0), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    meshRef.current.rotation.y = Math.sin(t * 0.5 + index) * 0.3;
    meshRef.current.rotation.x = Math.sin(t * 0.3 + index * 0.5) * 0.1;
    meshRef.current.position.y = position[1] + Math.sin(t * 0.8 + index * 1.2) * 0.3;
  });

  return (
    <group position={position} onClick={onClick}>
      {/* Card body */}
      <RoundedBox ref={meshRef} args={[2.2, 1.4, 0.08]} radius={0.1} smoothness={4}>
        <meshStandardMaterial
          color={color1}
          emissive={color1}
          emissiveIntensity={0.3}
          metalness={0.8}
          roughness={0.2}
          transparent
          opacity={0.9}
        />
      </RoundedBox>
      {/* Canvas-texture label — no font fetch needed */}
      <mesh geometry={labelGeometry} material={labelMaterial} position={[0, 0, 0.06]} />
    </group>
  );
}

interface FloatingSubsProps {
  products: Array<{
    _id: string;
    platform: string;
    price: number;
    gradientFrom: string;
    gradientTo: string;
  }>;
  onSelect?: (id: string) => void;
}

export default function FloatingSubs({ products, onSelect }: FloatingSubsProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) groupRef.current.rotation.y = state.clock.elapsedTime * 0.08;
  });

  const positions = useMemo(() => {
    const count = Math.min(products.length, 12);
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const r = 4.5;
      return [Math.cos(angle) * r, Math.sin(i * 0.8) * 1.5, Math.sin(angle) * r] as [number, number, number];
    });
  }, [products.length]);

  return (
    <group ref={groupRef}>
      {products.slice(0, 12).map((p, i) => (
        <SubCard
          key={p._id}
          position={positions[i]}
          platform={p.platform ?? ''}
          price={p.price}
          colorFrom={p.gradientFrom}
          colorTo={p.gradientTo}
          index={i}
          onClick={() => onSelect?.(p._id)}
        />
      ))}
    </group>
  );
}
