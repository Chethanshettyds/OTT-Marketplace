import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { platformLetters } from '../app/utils/threeHelpers';

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
  const glowRef = useRef<THREE.Mesh>(null);

  // Strip alpha from 8-digit hex (#RRGGBBAA → #RRGGBB) so THREE.Color doesn't crash
  const safeColor = (hex: string) => {
    if (!hex) return '#6366f1';
    const h = hex.trim();
    if (h.startsWith('#') && h.length === 9) return h.slice(0, 7);
    return h;
  };

  const color1 = useMemo(() => {
    try { return new THREE.Color(safeColor(colorFrom)); } catch { return new THREE.Color('#6366f1'); }
  }, [colorFrom]);
  const color2 = useMemo(() => {
    try { return new THREE.Color(safeColor(colorTo)); } catch { return new THREE.Color('#8b5cf6'); }
  }, [colorTo]);

  useFrame((state: { clock: { elapsedTime: number } }) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    meshRef.current.rotation.y = Math.sin(t * 0.5 + index) * 0.3;
    meshRef.current.rotation.x = Math.sin(t * 0.3 + index * 0.5) * 0.1;
    meshRef.current.position.y = position[1] + Math.sin(t * 0.8 + index * 1.2) * 0.3;
    if (glowRef.current) {
      const scale = 1 + Math.sin(t * 2 + index) * 0.05;
      glowRef.current.scale.setScalar(scale);
    }
  });

  const letter = platformLetters[platform] || (platform && platform.length > 0 ? platform[0] : '?');

  return (
    <group position={position} onClick={onClick}>
      {/* Glow halo */}
      <mesh ref={glowRef}>
        <planeGeometry args={[2.4, 1.6]} />
        <meshBasicMaterial color={color1} transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>

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

      {/* Platform letter */}
      <Text
        position={[0, 0.1, 0.06]}
        fontSize={0.45}
        color="white"
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        {letter}
      </Text>

      {/* Price */}
      <Text
        position={[0, -0.35, 0.06]}
        fontSize={0.18}
        color="#cccccc"
        anchorX="center"
        anchorY="middle"
      >
        ${price}/mo
      </Text>
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

  useFrame((state: { clock: { elapsedTime: number } }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.08;
  });

  const positions = useMemo(() => {
    const count = Math.min(products.length, 12);
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const radius = 4.5;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = Math.sin(i * 0.8) * 1.5;
      return [x, y, z] as [number, number, number];
    });
  }, [products.length]);

  return (
    <group ref={groupRef}>
      {products.slice(0, 12).map((product, i) => (
        <SubCard
          key={product._id}
          position={positions[i] as [number, number, number]}
          platform={product.platform}
          price={product.price}
          colorFrom={product.gradientFrom}
          colorTo={product.gradientTo}
          index={i}
          onClick={() => onSelect?.(product._id)}
        />
      ))}
    </group>
  );
}
