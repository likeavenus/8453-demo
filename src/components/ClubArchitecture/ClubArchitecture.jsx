import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";

const createBrush = (geometry, position = [0, 0, 0], rotation = [0, 0, 0]) => {
  geometry.clearGroups();
  const brush = new Brush(geometry);
  brush.position.set(...position);
  brush.rotation.set(...rotation);
  brush.updateMatrixWorld(true);
  return brush;
};

const createClubWall = () => {
  const evaluator = new Evaluator();
  evaluator.useGroups = false;

  let wall = createBrush(new THREE.BoxGeometry(12, 5.2, 0.56));
  const cutters = [
    createBrush(
      new THREE.CylinderGeometry(1.72, 1.72, 1.2, 72),
      [0, 0.18, 0],
      [Math.PI / 2, 0, 0]
    ),
    createBrush(new THREE.BoxGeometry(2.15, 2.95, 1.2), [-3.75, 0.05, 0]),
    createBrush(new THREE.BoxGeometry(2.15, 2.95, 1.2), [3.75, 0.05, 0]),
    createBrush(new THREE.BoxGeometry(6.5, 0.16, 1.2), [0, 2.08, 0]),
  ];

  cutters.forEach((cutter) => {
    const previous = wall;
    wall = evaluator.evaluate(previous, cutter, SUBTRACTION);
    wall.updateMatrixWorld(true);

    if (previous.geometry !== wall.geometry) previous.geometry.dispose();
    cutter.geometry.dispose();
  });

  wall.geometry.computeVertexNormals();
  wall.geometry.computeBoundingSphere();
  return wall.geometry;
};

const bars = Array.from({ length: 8 }, (_, index) => index);

export function ClubArchitecture({ audioBus }) {
  const wallGeometry = useMemo(createClubWall, []);
  const portal = useRef(null);
  const portalCore = useRef(null);
  const lightBars = useRef([]);

  useEffect(() => () => wallGeometry.dispose(), [wallGeometry]);

  useFrame((state) => {
    if (portal.current) {
      portal.current.emissiveIntensity =
        0.42 + audioBus.body * 0.55 + audioBus.kick * 0.45;
    }

    if (portalCore.current) {
      portalCore.current.opacity =
        0.22 + audioBus.body * 0.12 + audioBus.impact * 0.08;
    }

    lightBars.current.forEach((material, index) => {
      if (!material) return;

      const wave =
        0.5 +
        0.5 * Math.sin(state.clock.elapsedTime * 1.15 + index * 0.72);
      material.emissiveIntensity =
        0.14 +
        (audioBus.isPlaying ? wave * 0.28 : 0.025) +
        audioBus.clap * (0.35 + index * 0.025);
    });
  });

  return (
    <group>
      <mesh
        geometry={wallGeometry}
        position={[0, 1.38, -4.45]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#111119"
          metalness={0.62}
          roughness={0.42}
        />
      </mesh>

      <mesh position={[0, 1.56, -4.62]}>
        <circleGeometry args={[1.66, 72]} />
        <meshBasicMaterial
          ref={portalCore}
          color="#291144"
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 1.56, -4.09]}>
        <torusGeometry args={[1.82, 0.075, 16, 96]} />
        <meshStandardMaterial
          ref={portal}
          color="#6d36a8"
          emissive="#8f3cff"
          emissiveIntensity={0.42}
          metalness={0.35}
          roughness={0.25}
        />
      </mesh>

      <group position={[-3.75, 1.44, -4.1]}>
        {bars.map((index) => (
          <mesh key={index} position={[0, -1.14 + index * 0.325, 0]}>
            <boxGeometry args={[1.72, 0.075, 0.07]} />
            <meshStandardMaterial
              ref={(material) => {
                lightBars.current[index] = material;
              }}
              color={index % 2 === 0 ? "#29bfff" : "#ff2a75"}
              emissive={index % 2 === 0 ? "#29bfff" : "#ff2a75"}
              emissiveIntensity={0.22}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      <mesh position={[0, -0.68, -3.52]} castShadow receiveShadow>
        <boxGeometry args={[5.5, 0.58, 1.35]} />
        <meshStandardMaterial
          color="#15151e"
          metalness={0.72}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, -0.37, -3.15]}>
        <boxGeometry args={[4.65, 0.055, 0.58]} />
        <meshStandardMaterial
          color="#8f42ff"
          emissive="#8f42ff"
          emissiveIntensity={0.28}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[0, 4.08, -1.25]} castShadow>
        <boxGeometry args={[9.4, 0.12, 0.16]} />
        <meshStandardMaterial color="#191922" metalness={0.8} roughness={0.28} />
      </mesh>
      <mesh position={[-4.4, 2.15, -1.25]} castShadow>
        <boxGeometry args={[0.12, 4, 0.16]} />
        <meshStandardMaterial color="#191922" metalness={0.8} roughness={0.28} />
      </mesh>
      <mesh position={[4.4, 2.15, -1.25]} castShadow>
        <boxGeometry args={[0.12, 4, 0.16]} />
        <meshStandardMaterial color="#191922" metalness={0.8} roughness={0.28} />
      </mesh>

      <pointLight
        position={[0, 1.55, -3.75]}
        color="#8f3cff"
        intensity={3.2}
        distance={6}
        decay={2}
      />
    </group>
  );
}
