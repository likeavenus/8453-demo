import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

const characterUrl = (filename) =>
  `${import.meta.env.BASE_URL}models/characters/${encodeURIComponent(filename)}`;

const models = {
  male: characterUrl("X Bot.fbx"),
  female: characterUrl("Y Bot.fbx"),
};

const animations = {
  dance: characterUrl("Dancing.fbx"),
  hipHop: characterUrl("Hip Hop Dancing.fbx"),
  samba: characterUrl("Samba Dancing.fbx"),
  silly: characterUrl("Silly Dancing.fbx"),
};

const crowd = [
  {
    model: "female",
    animation: "samba",
    position: [-2.35, -0.96, 1.45],
    rotation: -0.18,
    tint: "#ffb6da",
    speed: 0.97,
    offset: 0.12,
  },
  {
    model: "male",
    animation: "hipHop",
    position: [-0.85, -0.96, 1.9],
    rotation: 0.12,
    tint: "#b8ddff",
    speed: 1.03,
    offset: 0.48,
  },
  {
    model: "female",
    animation: "dance",
    position: [0.9, -0.96, 1.75],
    rotation: -0.08,
    tint: "#d9b9ff",
    speed: 1.01,
    offset: 0.7,
  },
  {
    model: "male",
    animation: "silly",
    position: [2.35, -0.96, 1.2],
    rotation: 0.2,
    tint: "#ffd3a6",
    speed: 0.95,
    offset: 0.28,
  },
  {
    model: "male",
    animation: "dance",
    position: [-1.65, -0.96, -0.8],
    rotation: -0.28,
    tint: "#9deee5",
    speed: 0.98,
    offset: 0.84,
  },
  {
    model: "female",
    animation: "hipHop",
    position: [0, -0.96, -1.15],
    rotation: 0.14,
    tint: "#ffb3c4",
    speed: 1.04,
    offset: 0.36,
  },
  {
    model: "male",
    animation: "samba",
    position: [1.75, -0.96, -0.7],
    rotation: 0.3,
    tint: "#c4ccff",
    speed: 1,
    offset: 0.58,
  },
];

export const DANCER_COLLIDERS = crowd.map(({ position }) => position);

const makeInPlace = (sourceClip) => {
  const clip = sourceClip.clone();

  clip.tracks.forEach((track) => {
    if (!/Hips\.position$/i.test(track.name)) return;

    const values = track.values;
    const anchorX = values[0];
    const anchorZ = values[2];

    for (let index = 0; index < values.length; index += 3) {
      values[index] = anchorX;
      values[index + 2] = anchorZ;
    }
  });

  clip.name = `${sourceClip.name || "dance"}-in-place`;
  return clip;
};

function Dancer({ audioBus, dancer, index }) {
  const sourceModel = useLoader(FBXLoader, models[dancer.model]);
  const sourceAnimation = useLoader(FBXLoader, animations[dancer.animation]);
  const group = useRef(null);

  const character = useMemo(() => {
    const cloned = cloneSkeleton(sourceModel);
    const tint = new THREE.Color(dancer.tint);

    cloned.traverse((child) => {
      if (!child.isMesh) return;

      child.castShadow = true;
      child.receiveShadow = true;
      child.frustumCulled = false;

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      const clonedMaterials = materials.map((material) => {
        const clonedMaterial = material.clone();
        if (clonedMaterial.color) clonedMaterial.color.multiply(tint);
        clonedMaterial.roughness = Math.max(
          0.32,
          clonedMaterial.roughness ?? 0.5
        );
        return clonedMaterial;
      });

      child.material = Array.isArray(child.material)
        ? clonedMaterials
        : clonedMaterials[0];
    });

    return cloned;
  }, [dancer.tint, sourceModel]);

  const clip = useMemo(
    () => makeInPlace(sourceAnimation.animations[0]),
    [sourceAnimation]
  );
  const mixer = useMemo(() => new THREE.AnimationMixer(character), [character]);

  useEffect(() => {
    const action = mixer.clipAction(clip);
    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.time = clip.duration * dancer.offset;
    action.fadeIn(0.45);
    action.play();

    return () => {
      action.fadeOut(0.2);
      action.stop();
      mixer.stopAllAction();
      mixer.uncacheRoot(character);
    };
  }, [character, clip, dancer.offset, mixer]);

  useFrame((state, delta) => {
    mixer.timeScale = dancer.speed * (1 + audioBus.body * 0.035);
    mixer.update(Math.min(delta, 0.1));

    if (group.current) {
      const breathingScale = 1 + audioBus.body * 0.007;
      group.current.scale.setScalar(breathingScale);
      group.current.position.y =
        dancer.position[1] +
        Math.sin(state.clock.elapsedTime * 0.7 + index) * 0.008;
    }
  });

  return (
    <group
      ref={group}
      position={dancer.position}
      rotation-y={dancer.rotation}
    >
      <primitive object={character} scale={0.0115} />
    </group>
  );
}

export function DanceCrowd({ audioBus }) {
  return (
    <group>
      {crowd.map((dancer, index) => (
        <Dancer
          key={`${dancer.model}-${dancer.animation}-${index}`}
          audioBus={audioBus}
          dancer={dancer}
          index={index}
        />
      ))}
    </group>
  );
}
