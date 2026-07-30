import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, SpotLight, useDepthBuffer } from "@react-three/drei";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AudioVisualizer, createAudioBus } from "./components/Visualizer";
import { Experience } from "./components/Experience";
import { DanceCrowd } from "./components/Dancers/Dancers";
import { ClubArchitecture } from "./components/ClubArchitecture/ClubArchitecture";
import { ClubSmoke } from "./components/ClubSmoke/ClubSmoke";
import { TV } from "./components/TV/TV";
import wae from "/music/wae.mp3";

const concertLights = [
  { position: [-4.1, 4.2, 2.7], color: "#20c8ff", phase: 0 },
  { position: [-2.35, 4.65, -2.7], color: "#ff276e", phase: 1.1 },
  { position: [0, 4.85, 2.8], color: "#d9e9ff", phase: 2.2 },
  { position: [2.35, 4.65, -2.7], color: "#984dff", phase: 3.3 },
  { position: [4.1, 4.2, 2.7], color: "#ff6b32", phase: 4.4 },
  { position: [0, 5.1, -3.8], color: "#24e0ca", phase: 5.5 },
];

function MovingSpot({
  audioBus,
  fixture = 0,
  phase = 0,
  intensity = 8,
  ...props
}) {
  const light = useRef(null);
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    if (!light.current) return;

    const time = state.clock.getElapsedTime();
    const sweepX =
      Math.sin(time * (0.3 + fixture * 0.012) + phase) * 2.65 +
      Math.sin(time * 0.71 + phase * 0.5) * 0.45;
    const sweepZ = Math.cos(time * (0.24 + fixture * 0.01) + phase) * 1.85;
    const sweepY = -0.62 + Math.sin(time * 0.42 + phase) * 0.24;
    const step = audioBus.beatCount % concertLights.length;
    const opposite = (step + concertLights.length / 2) % concertLights.length;
    const isPrimary = fixture === step || fixture === opposite;
    const isClapAccent =
      audioBus.clap > 0.24 && fixture === (step + 2) % concertLights.length;
    const gate = isPrimary ? 1 : isClapAccent ? 0.56 : 0;
    const kickLift = audioBus.kick > 0.72 ? audioBus.kick * 4.5 : 0;
    const desiredIntensity =
      gate *
        (intensity * 0.72 + audioBus.body * 5 + audioBus.beat * 18) +
      kickLift;

    light.current.target.position.lerp(
      target.set(sweepX, sweepY, sweepZ),
      1 - Math.exp(-delta * 4.6)
    );
    light.current.target.updateMatrixWorld();
    light.current.intensity = THREE.MathUtils.damp(
      light.current.intensity,
      desiredIntensity,
      isPrimary ? 16 : 8,
      delta
    );
  });

  return (
    <SpotLight
      ref={light}
      castShadow
      penumbra={0.82}
      distance={10}
      angle={0.29}
      attenuation={5}
      anglePower={6}
      opacity={0.17}
      shadow-bias={-0.00015}
      {...props}
    />
  );
}

function ClubWash({ audioBus }) {
  const cyan = useRef(null);
  const magenta = useRef(null);
  const violet = useRef(null);

  useFrame(() => {
    if (cyan.current) {
      cyan.current.intensity =
        2.4 + audioBus.bass * 3.2 + audioBus.body * 2.4;
    }
    if (magenta.current) {
      magenta.current.intensity =
        2.1 + audioBus.mid * 2.8 + audioBus.clap * 2.4;
    }
    if (violet.current) {
      violet.current.intensity =
        1.8 + audioBus.body * 2.2 + audioBus.impact * 1.8;
    }
  });

  return (
    <group>
      <pointLight
        ref={cyan}
        position={[-3.4, 1.15, 1.8]}
        color="#1dbdff"
        distance={7}
        decay={2}
      />
      <pointLight
        ref={magenta}
        position={[3.4, 1.1, 1.4]}
        color="#ff2d78"
        distance={7}
        decay={2}
      />
      <pointLight
        ref={violet}
        position={[0, 2.8, -2.8]}
        color="#8a4dff"
        distance={8}
        decay={2}
      />
    </group>
  );
}

function DanceFloor({ audioBus }) {
  const rings = useRef([]);

  useFrame((state, delta) => {
    rings.current.forEach((material, index) => {
      if (!material) return;

      const ripple = Math.max(
        0,
        audioBus.body - index * 0.055 + audioBus.impact * 0.22
      );
      material.opacity = 0.035 + ripple * (0.16 - index * 0.014);
      material.color.offsetHSL(
        Math.sin(state.clock.elapsedTime * 0.08 + index) * delta * 0.003,
        0,
        0
      );
    });
  });

  return (
    <group rotation-x={-Math.PI / 2} position={[0, -0.978, 0]}>
      {[0, 1, 2, 3, 4].map((index) => {
        const innerRadius = 0.9 + index * 0.72;

        return (
          <mesh key={innerRadius}>
            <ringGeometry args={[innerRadius, innerRadius + 0.055, 128]} />
            <meshBasicMaterial
              ref={(material) => {
                rings.current[index] = material;
              }}
              color={index % 2 === 0 ? "#1ac8ff" : "#ff246d"}
              transparent
              opacity={0.035}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function ReactivePostprocessing({ audioBus }) {
  const bloom = useRef(null);

  useFrame(() => {
    if (bloom.current) {
      bloom.current.intensity =
        0.24 + audioBus.body * 0.18 + audioBus.beat * 0.25;
    }
  });

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        ref={bloom}
        mipmapBlur
        intensity={0.24}
        luminanceThreshold={0.72}
        luminanceSmoothing={0.28}
      />
      <Noise opacity={0.018} />
      <Vignette eskil={false} offset={0.18} darkness={0.82} />
    </EffectComposer>
  );
}

function ReadySignal({ onReady }) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return null;
}

function SceneThree({
  introStarted,
  onAudioReady,
  onDancersReady,
  onSceneReady,
}) {
  const audioBus = useRef(createAudioBus()).current;
  const depthBuffer = useDepthBuffer({ frames: Infinity, size: 512 });

  return (
    <Suspense fallback={null}>
      <AudioVisualizer
        path={wae}
        audioBus={audioBus}
        onReady={onAudioReady}
      />
      <ClubArchitecture audioBus={audioBus} />
      <TV position={[3.75, 1.25, -4.08]} rotation={[0, 0, 0]} scale={0.48} />
      <ClubSmoke audioBus={audioBus} />
      <Suspense fallback={null}>
        <DanceCrowd audioBus={audioBus} />
        <ReadySignal onReady={onDancersReady} />
      </Suspense>

      <Experience audioBus={audioBus} introStarted={introStarted} />
      <mesh receiveShadow position={[0, -1, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial
          color="#0c0c12"
          metalness={0.38}
          roughness={0.44}
        />
      </mesh>
      <DanceFloor audioBus={audioBus} />

      <ambientLight intensity={0.035} />
      <ClubWash audioBus={audioBus} />
      {concertLights.map((light, fixture) => (
        <MovingSpot
          key={`${light.color}-${fixture}`}
          audioBus={audioBus}
          depthBuffer={depthBuffer}
          color={light.color}
          position={light.position}
          phase={light.phase}
          fixture={fixture}
          intensity={fixture === 2 || fixture === 5 ? 7 : 8}
        />
      ))}
      <ReactivePostprocessing audioBus={audioBus} />
      <ReadySignal onReady={onSceneReady} />
    </Suspense>
  );
}

function Controls() {
  const { gl, camera } = useThree();

  return (
    <OrbitControls
      autoRotate
      autoRotateSpeed={0.24}
      enableDamping
      dampingFactor={0.055}
      target={[0, 0.75, 0]}
      args={[camera, gl.domElement]}
    />
  );
}

function App() {
  const [isStarted, setStarted] = useState(() =>
    new URLSearchParams(window.location.search).has("autostart")
  );
  const [sceneReady, setSceneReady] = useState(false);
  const [dancersReady, setDancersReady] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const introStarted = sceneReady && dancersReady && audioReady;

  const handleSceneReady = useCallback(() => setSceneReady(true), []);
  const handleDancersReady = useCallback(() => setDancersReady(true), []);
  const handleAudioReady = useCallback(() => setAudioReady(true), []);

  const handleStart = () => {
    setSceneReady(false);
    setDancersReady(false);
    setAudioReady(false);
    setStarted(true);
  };

  return isStarted ? (
    <div className="stage-shell">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 1.55, 7.4], fov: 48, near: 0.1, far: 50 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <Controls />
        <color attach="background" args={["#09090d"]} />
        <fog attach="fog" args={["#09090d", 6, 19]} />
        <SceneThree
          introStarted={introStarted}
          onAudioReady={handleAudioReady}
          onDancersReady={handleDancersReady}
          onSceneReady={handleSceneReady}
        />
      </Canvas>
      <div
        className={`scene-curtain ${
          introStarted ? "scene-curtain--open" : ""
        }`}
      >
        <div className="scene-curtain__beam" />
        <p className="scene-curtain__label">ENTERING 8453</p>
      </div>
    </div>
  ) : (
    <main className="landing">
      <div className="landing__noise" />
      <p className="landing__eyebrow">8453 · AUDIO REACTIVE EXPERIENCE</p>
      <h1 className="landing__title">FEEL THE KICK</h1>
      <button className="start_btn" onClick={handleStart}>
        ENTER STAGE
      </button>
      <p className="landing__hint">sound on · drag to look around</p>
    </main>
  );
}

export default App;
