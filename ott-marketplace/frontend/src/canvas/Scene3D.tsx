import { Suspense, useRef, useMemo, Component, ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Environment, Float } from '@react-three/drei';
import * as THREE from 'three';
import FloatingSubs from './FloatingSubs';

// Error boundary so a WebGL crash doesn't blank the whole page
class CanvasErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  render() {
    if (this.state.crashed) return (
      <div className="flex items-center justify-center h-full text-white/30 text-sm">
        3D view unavailable
      </div>
    );
    return this.props.children;
  }
}

function CameraRig() {
  const vec = new THREE.Vector3();
  useFrame((state) => {
    state.camera.position.lerp(
      vec.set(state.mouse.x * 2, state.mouse.y * 1, 8),
      0.02
    );
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

function ParticleField() {
  const ref = useRef<THREE.Points>(null);
  const count = 300;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * 30;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.02;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#6366f1" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

interface Scene3DProps {
  products: Array<{
    _id: string;
    platform: string;
    price: number;
    gradientFrom: string;
    gradientTo: string;
  }>;
  onSelect?: (id: string) => void;
  height?: string;
}

export default function Scene3D({ products, onSelect, height = '600px' }: Scene3DProps) {
  // Don't mount the canvas until we have products — avoids crash on empty array
  if (!products || products.length === 0) return <div style={{ height, width: '100%' }} />;

  return (
    <div style={{ height, width: '100%' }}>
      <CanvasErrorBoundary>
        <Canvas
          camera={{ position: [0, 0, 8], fov: 60 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          dpr={[1, 1.5]}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
            });
          }}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.3} />
            <pointLight position={[10, 10, 10]} intensity={1} color="#6366f1" />
            <pointLight position={[-10, -10, -10]} intensity={0.5} color="#a855f7" />
            <spotLight position={[0, 10, 0]} intensity={0.8} color="#3b82f6" angle={0.5} />

            <Stars radius={80} depth={50} count={3000} factor={3} saturation={0} fade speed={1} />
            <ParticleField />

            <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
              <FloatingSubs products={products} onSelect={onSelect} />
            </Float>

            <CameraRig />
            <OrbitControls
              enableZoom={false}
              enablePan={false}
              autoRotate={false}
              maxPolarAngle={Math.PI / 1.5}
              minPolarAngle={Math.PI / 3}
            />
            <Environment preset="night" />
          </Suspense>
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
}
