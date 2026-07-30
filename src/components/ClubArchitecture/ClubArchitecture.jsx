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

const subtractBrushes = (base, cutters) => {
  const evaluator = new Evaluator();
  evaluator.useGroups = false;

  let result = base;

  cutters.forEach((cutter) => {
    const previous = result;
    result = evaluator.evaluate(previous, cutter, SUBTRACTION);
    result.updateMatrixWorld(true);

    if (previous.geometry !== result.geometry) previous.geometry.dispose();
    cutter.geometry.dispose();
  });

  result.geometry.computeVertexNormals();
  result.geometry.computeBoundingBox();
  result.geometry.computeBoundingSphere();
  return result.geometry;
};

const createClubWall = () => {
  return subtractBrushes(createBrush(new THREE.BoxGeometry(12, 5.2, 0.56)), [
    createBrush(
      new THREE.CylinderGeometry(1.72, 1.72, 1.2, 72),
      [0, 0.18, 0],
      [Math.PI / 2, 0, 0]
    ),
    createBrush(new THREE.BoxGeometry(2.15, 2.95, 1.2), [-3.75, 0.05, 0]),
    createBrush(new THREE.BoxGeometry(2.15, 2.95, 1.2), [3.75, 0.05, 0]),
    createBrush(new THREE.BoxGeometry(6.5, 0.16, 1.2), [0, 2.08, 0]),
  ]);
};

const createSpeakerCabinet = () =>
  subtractBrushes(createBrush(new THREE.BoxGeometry(1.18, 3.35, 0.72)), [
    createBrush(
      new THREE.CylinderGeometry(0.48, 0.48, 1, 48),
      [0, 0.72, 0],
      [Math.PI / 2, 0, 0]
    ),
    createBrush(
      new THREE.CylinderGeometry(0.37, 0.37, 1, 48),
      [0, -0.31, 0],
      [Math.PI / 2, 0, 0]
    ),
    createBrush(new THREE.BoxGeometry(0.72, 0.22, 1), [0, -1.23, 0]),
  ]);

const createSideWall = () =>
  subtractBrushes(createBrush(new THREE.BoxGeometry(0.38, 3.65, 5.8)), [
    ...[-1.75, 0, 1.75].map((z) =>
      createBrush(
        new THREE.CylinderGeometry(0.72, 0.72, 0.9, 56),
        [0, 0.38, z],
        [0, 0, Math.PI / 2]
      )
    ),
    ...[-1.75, 0, 1.75].map((z) =>
      createBrush(new THREE.BoxGeometry(0.9, 0.18, 0.96), [0, -1.28, z])
    ),
  ]);

const bars = Array.from({ length: 8 }, (_, index) => index);
const speakerDrivers = [
  { y: 0.72, radius: 0.435 },
  { y: -0.31, radius: 0.325 },
];
const sideOpenings = [-1.75, 0, 1.75];
const ceilingRibs = [-2.7, -0.55, 1.6];
const cabinetBolts = [
  [-0.48, 1.48],
  [0.48, 1.48],
  [-0.48, -1.48],
  [0.48, -1.48],
];
const fixtureMounts = [
  [-4.1, 4.2, 2.7],
  [-2.35, 4.65, -2.7],
  [0, 4.85, 2.8],
  [2.35, 4.65, -2.7],
  [4.1, 4.2, 2.7],
  [0, 5.1, -3.8],
];

export function ClubArchitecture({ audioBus, lowPower = false }) {
  const wallGeometry = useMemo(createClubWall, []);
  const speakerGeometry = useMemo(createSpeakerCabinet, []);
  const sideWallGeometry = useMemo(createSideWall, []);
  const portal = useRef(null);
  const portalCore = useRef(null);
  const lightBars = useRef([]);
  const speakerCones = useRef([]);
  const speakerRings = useRef([]);
  const sideRings = useRef([]);
  const ceilingBars = useRef([]);
  const ventLights = useRef([]);

  useEffect(
    () => () => {
      wallGeometry.dispose();
      speakerGeometry.dispose();
      sideWallGeometry.dispose();
    },
    [sideWallGeometry, speakerGeometry, wallGeometry]
  );

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

    speakerCones.current.forEach((cone, index) => {
      if (!cone) return;

      const lowEnd = Math.max(audioBus.bass * 0.7, audioBus.kick);
      const response = 1 + lowEnd * (index % 2 === 0 ? 0.07 : 0.045);
      cone.scale.setScalar(response);
      cone.position.z = 0.374 + lowEnd * 0.018;
      cone.material.emissiveIntensity = 0.035 + lowEnd * 0.18;
    });

    speakerRings.current.forEach((material, index) => {
      if (!material) return;
      material.emissiveIntensity =
        0.06 + audioBus.kick * 0.34 + audioBus.body * (0.08 + index * 0.01);
    });

    sideRings.current.forEach((material, index) => {
      if (!material) return;

      const chaseIndex = audioBus.beatCount % sideRings.current.length;
      const isActive = index === chaseIndex;
      const idleWave =
        0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 0.62 + index * 1.37);
      material.emissiveIntensity =
        0.08 +
        (audioBus.isPlaying ? idleWave * 0.12 : 0.02) +
        (isActive ? audioBus.beat * 0.72 : audioBus.clap * 0.08);
    });

    ceilingBars.current.forEach((material, index) => {
      if (!material) return;
      const isActive = index === audioBus.beatCount % ceilingRibs.length;
      material.emissiveIntensity =
        0.08 + audioBus.body * 0.1 + (isActive ? audioBus.beat * 0.42 : 0);
    });

    ventLights.current.forEach((material, index) => {
      if (!material) return;
      const alternatingAccent = (audioBus.beatCount + index) % 3 === 0;
      material.emissiveIntensity =
        0.04 +
        audioBus.bass * 0.1 +
        (alternatingAccent ? audioBus.clap * 0.3 : 0);
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

      {[-1, 1].map((side, sideIndex) => (
        <group key={`speaker-${side}`} position={[side * 5.08, 0.66, -3.83]}>
          <mesh geometry={speakerGeometry} castShadow receiveShadow>
            <meshStandardMaterial
              color="#101016"
              metalness={0.72}
              roughness={0.38}
            />
          </mesh>

          {speakerDrivers.map((driver, driverIndex) => {
            const refIndex = sideIndex * speakerDrivers.length + driverIndex;

            return (
              <group key={driver.y} position={[0, driver.y, 0]}>
                <mesh
                  ref={(mesh) => {
                    speakerCones.current[refIndex] = mesh;
                  }}
                  position={[0, 0, 0.374]}
                >
                  <circleGeometry args={[driver.radius, 48]} />
                  <meshStandardMaterial
                    color="#090a0f"
                    emissive={side < 0 ? "#163a52" : "#4a1734"}
                    emissiveIntensity={0.035}
                    metalness={0.28}
                    roughness={0.7}
                  />
                </mesh>
                <mesh position={[0, 0, 0.39]}>
                  <circleGeometry args={[driver.radius * 0.31, 40]} />
                  <meshStandardMaterial
                    color="#20212b"
                    metalness={0.55}
                    roughness={0.38}
                  />
                </mesh>
                <mesh position={[0, 0, 0.397]}>
                  <torusGeometry args={[driver.radius, 0.035, 12, 48]} />
                  <meshStandardMaterial
                    ref={(material) => {
                      speakerRings.current[refIndex] = material;
                    }}
                    color={side < 0 ? "#2bc9ff" : "#ff2f79"}
                    emissive={side < 0 ? "#2bc9ff" : "#ff2f79"}
                    emissiveIntensity={0.06}
                    metalness={0.5}
                    roughness={0.32}
                    toneMapped={false}
                  />
                </mesh>
              </group>
            );
          })}

          <mesh position={[0, -1.23, 0.39]}>
            <boxGeometry args={[0.66, 0.1, 0.025]} />
            <meshBasicMaterial color="#020207" />
          </mesh>

          {!lowPower && cabinetBolts.map(([x, y]) => (
            <mesh key={`${x}-${y}`} position={[x, y, 0.375]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.032, 0.032, 0.035, 12]} />
              <meshStandardMaterial
                color="#838494"
                metalness={0.95}
                roughness={0.22}
              />
            </mesh>
          ))}

          <mesh position={[0, -1.52, 0.378]}>
            <boxGeometry args={[0.42, 0.055, 0.025]} />
            <meshStandardMaterial
              color={side < 0 ? "#2bc9ff" : "#ff2f79"}
              emissive={side < 0 ? "#2bc9ff" : "#ff2f79"}
              emissiveIntensity={0.1}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {[-1, 1].map((side, sideIndex) => (
        <group key={`side-wall-${side}`}>
          <mesh
            geometry={sideWallGeometry}
            position={[side * 5.78, 0.82, -0.35]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color="#12121a"
              metalness={0.68}
              roughness={0.4}
            />
          </mesh>

          {sideOpenings.map((z, openingIndex) => {
            const refIndex = sideIndex * sideOpenings.length + openingIndex;
            const color =
              (openingIndex + sideIndex) % 2 === 0 ? "#26c9ff" : "#ff317c";

            return (
              <group
                key={z}
                position={[side * 5.57, 1.2, -0.35 + z]}
                rotation={[0, Math.PI / 2, 0]}
              >
                <mesh position={[0, 0, side * 0.012]}>
                  <circleGeometry args={[0.665, 48]} />
                  <meshBasicMaterial
                    color="#080812"
                    transparent
                    opacity={0.72}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                  />
                </mesh>
                <mesh>
                  <torusGeometry args={[0.76, 0.035, 12, 56]} />
                  <meshStandardMaterial
                    ref={(material) => {
                      sideRings.current[refIndex] = material;
                    }}
                    color={color}
                    emissive={color}
                    emissiveIntensity={0.08}
                    metalness={0.48}
                    roughness={0.3}
                    toneMapped={false}
                  />
                </mesh>
              </group>
            );
          })}

          {sideOpenings.map((z, openingIndex) => {
            const refIndex = sideIndex * sideOpenings.length + openingIndex;
            const color =
              (openingIndex + sideIndex) % 2 === 0 ? "#26c9ff" : "#ff317c";

            return (
              <group
                key={`vent-${z}`}
                position={[side * 5.57, -0.46, -0.35 + z]}
              >
                {(lowPower ? [0] : [-0.27, 0, 0.27]).map((offset) => (
                  <mesh key={offset} position={[0, 0, offset]}>
                    <boxGeometry args={[0.035, 0.065, 0.19]} />
                    <meshStandardMaterial
                      ref={(material) => {
                        if (offset === 0) ventLights.current[refIndex] = material;
                      }}
                      color={color}
                      emissive={color}
                      emissiveIntensity={0.04}
                      metalness={0.45}
                      roughness={0.3}
                      toneMapped={false}
                    />
                  </mesh>
                ))}
              </group>
            );
          })}
        </group>
      ))}

      {ceilingRibs.map((z, index) => (
        <group key={z} position={[0, 5.52, z]}>
          <mesh castShadow>
            <boxGeometry args={[11.5, 0.13, 0.18]} />
            <meshStandardMaterial
              color="#171720"
              metalness={0.82}
              roughness={0.28}
            />
          </mesh>
          <mesh position={[0, -0.085, 0]}>
            <boxGeometry args={[10.7, 0.025, 0.055]} />
            <meshStandardMaterial
              ref={(material) => {
                ceilingBars.current[index] = material;
              }}
              color={index % 2 === 0 ? "#24566b" : "#682642"}
              emissive={index % 2 === 0 ? "#1c8db4" : "#c32964"}
              emissiveIntensity={0.12}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {[-1, 1].flatMap((side) =>
        ceilingRibs.map((z, index) => (
          <group key={`upper-support-${side}-${z}`}>
            <mesh position={[side * 5.66, 4.08, z]} castShadow>
              <boxGeometry args={[0.16, 2.82, 0.16]} />
              <meshStandardMaterial
                color="#171720"
                metalness={0.84}
                roughness={0.27}
              />
            </mesh>
            <mesh
              position={[side * 5.25, 4.64, z]}
              rotation-z={side * -0.62}
              castShadow
            >
              <boxGeometry args={[1.28, 0.095, 0.105]} />
              <meshStandardMaterial
                color={index % 2 === 0 ? "#202b32" : "#302029"}
                metalness={0.78}
                roughness={0.3}
              />
            </mesh>
          </group>
        ))
      )}

      {fixtureMounts.map(([x, y, z], index) => {
        const cableLength = 5.46 - y;

        return (
          <group key={`fixture-mount-${x}-${z}`}>
            <mesh position={[x, y + cableLength * 0.5, z]}>
              <cylinderGeometry args={[0.012, 0.012, cableLength, 8]} />
              <meshStandardMaterial
                color="#454653"
                metalness={0.92}
                roughness={0.24}
              />
            </mesh>
            <mesh position={[x, y + 0.08, z]} castShadow>
              <cylinderGeometry args={[0.13, 0.18, 0.24, 16]} />
              <meshStandardMaterial
                color="#13131a"
                metalness={0.82}
                roughness={0.3}
              />
            </mesh>
            <mesh position={[x, y - 0.045, z]} rotation-x={Math.PI / 2}>
              <circleGeometry args={[0.105, 20]} />
              <meshStandardMaterial
                color={index % 2 === 0 ? "#79ddff" : "#ff6b9c"}
                emissive={index % 2 === 0 ? "#29bfff" : "#ff2a75"}
                emissiveIntensity={0.16}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}

      <mesh position={[0, 5.48, -1.25]} castShadow>
        <boxGeometry args={[9.4, 0.12, 0.16]} />
        <meshStandardMaterial color="#191922" metalness={0.8} roughness={0.28} />
      </mesh>
      <mesh position={[-4.4, 2.24, -1.25]} castShadow>
        <boxGeometry args={[0.12, 6.48, 0.16]} />
        <meshStandardMaterial color="#191922" metalness={0.8} roughness={0.28} />
      </mesh>
      <mesh position={[4.4, 2.24, -1.25]} castShadow>
        <boxGeometry args={[0.12, 6.48, 0.16]} />
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
