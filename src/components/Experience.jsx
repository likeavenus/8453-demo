import { Center, Text3D } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";

const FONT_URL = `${import.meta.env.BASE_URL}fonts/Roboto_Bold.json`;

const digits = [
  { value: "8", position: [-1.2, 3.35, 0.05], color: "#22c8ff" },
  { value: "4", position: [-0.4, 3.62, 0], color: "#9b65ff" },
  { value: "5", position: [0.4, 3.62, 0], color: "#ff3b83" },
  { value: "3", position: [1.2, 3.35, 0.05], color: "#ff7755" },
];

const smoothstep = (value) => value * value * (3 - 2 * value);

export const Experience = ({ audioBus, introStarted }) => {
  const camera = useThree((state) => state.camera);
  const groups = useRef([]);
  const materials = useRef([]);
  const introStartedAt = useRef(null);

  useFrame((state) => {
    if (introStarted && introStartedAt.current === null) {
      introStartedAt.current = state.clock.elapsedTime;
    }

    const introAge =
      introStartedAt.current === null
        ? 0
        : state.clock.elapsedTime - introStartedAt.current;

    groups.current.forEach((group, index) => {
      if (!group) return;

      const digit = digits[index];
      const revealProgress = Math.min(
        Math.max((introAge - index * 0.11) / 0.72, 0),
        1
      );
      const reveal = smoothstep(revealProgress);
      const direction = index % 2 === 0 ? 1 : -1;
      const float = Math.sin(state.clock.elapsedTime * 0.78 + index * 0.9) * 0.045;
      const kickLift = audioBus.kick * (0.1 + index * 0.012);
      const scale =
        0.68 * reveal * (1 + audioBus.kick * 0.12 + audioBus.body * 0.025);

      group.position.set(
        digit.position[0],
        digit.position[1] - (1 - reveal) * 0.22 + float + kickLift,
        digit.position[2]
      );
      group.quaternion.copy(camera.quaternion);
      group.rotateZ(
        direction * 0.025 +
          Math.sin(state.clock.elapsedTime * 0.52 + index) * 0.018 +
          direction * audioBus.kick * 0.055
      );
      group.scale.setScalar(scale);

      const material = materials.current[index];
      if (material) {
        material.opacity = reveal;
        material.emissiveIntensity =
          0.16 + audioBus.kick * 0.68 + audioBus.body * 0.12;
      }
    });
  });

  return digits.map((digit, index) => (
    <group
      key={digit.value}
      ref={(group) => {
        groups.current[index] = group;
      }}
      position={digit.position}
      scale={0}
    >
      <Center>
        <Text3D
          castShadow
          font={FONT_URL}
          bevelEnabled
          bevelSize={0.025}
          bevelThickness={0.035}
          bevelSegments={3}
        >
          {digit.value}
          <meshStandardMaterial
            ref={(material) => {
              materials.current[index] = material;
            }}
            color={digit.color}
            emissive={digit.color}
            emissiveIntensity={0.16}
            metalness={0.56}
            roughness={0.26}
            transparent
            opacity={0}
          />
        </Text3D>
      </Center>
    </group>
  ));
};
