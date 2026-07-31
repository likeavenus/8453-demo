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
  twerk: characterUrl("Dancing Twerk.fbx"),
  idle: characterUrl("Idle.fbx"),
  happyIdle: characterUrl("Happy Idle.fbx"),
};

const supportingDanceAnimations = ["dance", "hipHop", "samba", "silly"];
const randomSupportingDance = () =>
  supportingDanceAnimations[
    Math.floor(Math.random() * supportingDanceAnimations.length)
  ];

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
  {
    model: "female",
    animation: "twerk",
    position: [-2.75, -0.96, 0.08],
    rotation: 0.34,
    tint: "#ff9bc9",
    speed: 1.02,
    offset: 0.66,
  },
  {
    model: "male",
    animation: randomSupportingDance(),
    position: [2.78, -0.96, 0.02],
    rotation: -0.32,
    tint: "#92e8ff",
    speed: 0.99,
    offset: 0.18,
  },
];

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

const getBeatAlignedRate = (clipDuration, bpm, preferredRate) => {
  if (!bpm || !clipDuration) return preferredRate;

  const idealBeatCount = (clipDuration * bpm) / (60 * preferredRate);
  const alignedBeatCount = Math.max(1, Math.floor(idealBeatCount * 2) / 2);
  return (clipDuration * bpm) / (60 * alignedBeatCount);
};

function Dancer({ audioBus, dancer, index }) {
  const sourceModel = useLoader(FBXLoader, models[dancer.model]);
  const sourceAnimation = useLoader(FBXLoader, animations[dancer.animation]);
  const sourceIdle = useLoader(FBXLoader, animations.idle);
  const sourceHappyIdle = useLoader(FBXLoader, animations.happyIdle);
  const group = useRef(null);
  const actions = useRef(null);
  const activeMode = useRef(null);
  const activeAction = useRef(null);
  const idleVariant = useRef(Math.random() < 0.5 ? 0 : 1);
  const smoothedDanceRate = useRef(1);
  const lastSeekVersion = useRef(audioBus.seekVersion);

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

  const danceClip = useMemo(
    () => makeInPlace(sourceAnimation.animations[0]),
    [sourceAnimation]
  );
  const idleClips = useMemo(
    () => [
      makeInPlace(sourceIdle.animations[0]),
      makeInPlace(sourceHappyIdle.animations[0]),
    ],
    [sourceHappyIdle, sourceIdle]
  );
  const mixer = useMemo(() => new THREE.AnimationMixer(character), [character]);

  useEffect(() => {
    const danceAction = mixer.clipAction(danceClip);
    const idleActions = idleClips.map((idleClip) => mixer.clipAction(idleClip));
    const chosenIdleAction = idleActions[idleVariant.current];
    const chosenIdleClip = idleClips[idleVariant.current];

    [danceAction, ...idleActions].forEach((action) => {
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.enabled = true;
    });

    const startsDancing = audioBus.isPlaying;
    const initialAction = startsDancing ? danceAction : chosenIdleAction;
    initialAction.reset();
    initialAction.time = startsDancing
      ? danceClip.duration * dancer.offset
      : chosenIdleClip.duration * ((dancer.offset + index * 0.17) % 1);
    initialAction.fadeIn(0.45);
    initialAction.play();

    actions.current = {
      dance: danceAction,
      danceClip,
      idle: chosenIdleAction,
      idleClip: chosenIdleClip,
    };
    activeMode.current = startsDancing ? "dance" : "idle";
    activeAction.current = initialAction;

    return () => {
      actions.current = null;
      activeAction.current = null;
      activeMode.current = null;
      mixer.stopAllAction();
      mixer.uncacheRoot(character);
    };
  }, [
    audioBus,
    character,
    danceClip,
    dancer.offset,
    idleClips,
    index,
    mixer,
  ]);

  useFrame((state, delta) => {
    const dancerActions = actions.current;
    if (!dancerActions) return;

    const nextMode = audioBus.isPlaying ? "dance" : "idle";
    const bpmRatio = THREE.MathUtils.clamp((audioBus.bpm || 110) / 100, 0.72, 1.55);
    const tempoResponse = Math.pow(bpmRatio, 0.72);
    const preferredDanceRate = dancer.speed * 1.18 * tempoResponse;
    const danceRate = getBeatAlignedRate(
      dancerActions.danceClip.duration,
      audioBus.bpm,
      preferredDanceRate
    );
    const sustainedEnergy =
      (audioBus.bass +
        audioBus.lowMid +
        audioBus.presence +
        audioBus.high) /
      4;
    const trackDrive = audioBus.isPlaying
      ? sustainedEnergy * 0.16 + audioBus.body * 0.08
      : 0;
    const percussionDrive = audioBus.isPlaying
      ? audioBus.kick * 0.16 +
        audioBus.clap * 0.075 +
        audioBus.hat * 0.045
      : 0;
    const targetDanceRate = THREE.MathUtils.clamp(
      danceRate * (1 + trackDrive + percussionDrive),
      0.82,
      1.85
    );

    smoothedDanceRate.current = THREE.MathUtils.damp(
      smoothedDanceRate.current,
      targetDanceRate,
      targetDanceRate > smoothedDanceRate.current ? 16 : 7,
      delta
    );

    dancerActions.dance.setEffectiveTimeScale(
      smoothedDanceRate.current
    );
    dancerActions.idle.setEffectiveTimeScale(0.88 + index * 0.018);

    if (lastSeekVersion.current !== audioBus.seekVersion) {
      dancerActions.dance.time =
        (audioBus.position * danceRate +
          dancerActions.danceClip.duration * dancer.offset) %
        dancerActions.danceClip.duration;
      lastSeekVersion.current = audioBus.seekVersion;
    }

    if (nextMode !== activeMode.current) {
      const previousAction = activeAction.current;
      const nextAction = dancerActions[nextMode];

      nextAction.enabled = true;
      nextAction.setEffectiveWeight(1);
      nextAction.reset();
      nextAction.time =
        nextMode === "dance"
          ? (audioBus.position * danceRate +
              dancerActions.danceClip.duration * dancer.offset) %
            dancerActions.danceClip.duration
          : dancerActions.idleClip.duration *
            ((dancer.offset + index * 0.17) % 1);
      nextAction.play();

      if (previousAction) {
        nextAction.crossFadeFrom(previousAction, 0.55, false);
      } else {
        nextAction.fadeIn(0.55);
      }

      activeMode.current = nextMode;
      activeAction.current = nextAction;
    }

    mixer.timeScale = 1;
    mixer.update(Math.min(delta, 0.1));

    if (group.current) {
      const targetScale =
        1 + audioBus.body * 0.008 + audioBus.kick * 0.012;
      const smoothedScale = THREE.MathUtils.damp(
        group.current.scale.x,
        targetScale,
        targetScale > group.current.scale.x ? 15 : 8,
        delta
      );
      group.current.scale.setScalar(smoothedScale);

      const beatPhase =
        audioBus.position * ((audioBus.bpm || 120) / 60) * Math.PI * 2;
      const danceFloat = audioBus.isPlaying
        ? Math.sin(beatPhase + index * 0.82) *
            (0.005 + audioBus.body * 0.006) +
          audioBus.kick * (0.022 + (index % 3) * 0.003)
        : 0;
      group.current.position.y = THREE.MathUtils.damp(
        group.current.position.y,
        dancer.position[1] + danceFloat,
        danceFloat > 0 ? 14 : 8,
        delta
      );

      const clapDirection = index % 2 === 0 ? 1 : -1;
      const targetTilt = audioBus.isPlaying
        ? clapDirection *
          (audioBus.clap * 0.018 + audioBus.beat * 0.006)
        : 0;
      group.current.rotation.z = THREE.MathUtils.damp(
        group.current.rotation.z,
        targetTilt,
        targetTilt !== 0 ? 15 : 7,
        delta
      );
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

export function DanceCrowd({ audioBus, lowPower = false }) {
  const visibleCrowd = lowPower
    ? crowd.filter((_, index) => [0, 1, 2, 7, 8].includes(index))
    : crowd;

  return (
    <group>
      {visibleCrowd.map((dancer) => {
        const index = crowd.indexOf(dancer);

        return (
          <Dancer
            key={`${dancer.model}-${dancer.animation}-${index}`}
            audioBus={audioBus}
            dancer={dancer}
            index={index}
          />
        );
      })}
    </group>
  );
}
