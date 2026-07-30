import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  MeshReflectorMaterial,
  OrbitControls,
  SpotLight,
  useDepthBuffer,
  useProgress,
} from "@react-three/drei";
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
  const beamMaterial = useRef(null);
  const previousBeat = useRef(-1);
  const beatTarget = useMemo(() => new THREE.Vector3(), []);
  const desiredTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    if (!light.current) return;

    const time = state.clock.getElapsedTime();
    const beatNumber = audioBus.beatCount;

    if (beatNumber !== previousBeat.current) {
      const seed = (beatNumber + 1) * (fixture + 2);
      beatTarget.set(
        Math.sin(seed * 12.9898 + phase) * 3.15,
        -0.78 + Math.sin(seed * 4.173) * 0.18,
        Math.cos(seed * 7.233 + phase * 0.7) * 2.35
      );
      previousBeat.current = beatNumber;
    }

    const sweepX =
      Math.sin(time * (0.48 + fixture * 0.018) + phase) * 2.8 +
      Math.sin(time * 0.93 + phase * 0.45) * 0.52;
    const sweepZ =
      Math.cos(time * (0.37 + fixture * 0.014) + phase) * 2.05;
    const sweepY = -0.7 + Math.sin(time * 0.58 + phase) * 0.22;
    const step = beatNumber % concertLights.length;
    const opposite = (step + 3) % concertLights.length;
    const isPrimary = fixture === step || fixture === opposite;
    const isNeighbor =
      fixture === (step + 1) % concertLights.length ||
      fixture === (step + 5) % concertLights.length;
    const isClapAccent =
      audioBus.clap > 0.24 && fixture === (step + 2) % concertLights.length;
    const pulse = Math.max(
      audioBus.beat,
      audioBus.kick * 0.94,
      audioBus.clap * 0.78
    );
    const chaseLevel = isPrimary ? 1 : isNeighbor ? 0.16 : 0;
    const shimmer = 0.5 + 0.5 * Math.sin(time * 2.15 + phase * 1.7);
    const desiredIntensity = audioBus.isPlaying
      ? chaseLevel * (intensity * 0.58 + pulse * 24 + audioBus.body * 4.5) +
        audioBus.kick * (fixture % 2 === 0 ? 8.5 : 5.5) +
        (isClapAccent ? audioBus.clap * 14 : 0) +
        (isPrimary ? shimmer * 1.2 : 0.05)
      : 0;

    desiredTarget.set(
      beatTarget.x * 0.68 + sweepX * 0.32,
      beatTarget.y * 0.72 + sweepY * 0.28,
      beatTarget.z * 0.68 + sweepZ * 0.32
    );

    light.current.target.position.lerp(
      desiredTarget,
      1 - Math.exp(-delta * (6.2 + pulse * 8))
    );
    light.current.target.updateMatrixWorld();
    light.current.intensity = THREE.MathUtils.damp(
      light.current.intensity,
      desiredIntensity,
      desiredIntensity > light.current.intensity ? 22 : 10,
      delta
    );

    if (!beamMaterial.current) {
      light.current.traverse((child) => {
        if (child.material?.uniforms?.opacity) {
          beamMaterial.current = child.material;
        }
      });
    }

    if (beamMaterial.current) {
      const desiredOpacity = audioBus.isPlaying
        ? 0.018 +
          chaseLevel * 0.105 +
          pulse * (isPrimary ? 0.24 : 0.055) +
          (isClapAccent ? audioBus.clap * 0.13 : 0)
        : 0;
      beamMaterial.current.uniforms.opacity.value = THREE.MathUtils.damp(
        beamMaterial.current.uniforms.opacity.value,
        desiredOpacity,
        desiredOpacity > beamMaterial.current.uniforms.opacity.value ? 18 : 9,
        delta
      );
    }
  });

  return (
    <SpotLight
      ref={light}
      castShadow={fixture % 2 === 0}
      penumbra={0.82}
      distance={11.5}
      angle={0.34}
      attenuation={4.2}
      anglePower={5.2}
      opacity={0}
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
  audioBus,
  trackPath,
  trackName,
  shouldPlay,
  showAudioStatus,
  introStarted,
  onAudioReady,
  onDancersReady,
  onSceneReady,
}) {
  const depthBuffer = useDepthBuffer({ frames: Infinity, size: 512 });

  return (
    <>
      <AudioVisualizer
        path={trackPath}
        audioBus={audioBus}
        onReady={onAudioReady}
        shouldPlay={shouldPlay}
        showStatus={showAudioStatus}
      />
      <ClubArchitecture audioBus={audioBus} />
      <Suspense fallback={null}>
        <TV
          position={[3.75, 1.25, -4.08]}
          rotation={[0, 0, 0]}
          scale={0.48}
        />
      </Suspense>
      <ClubSmoke audioBus={audioBus} />
      <Suspense fallback={null}>
        <DanceCrowd audioBus={audioBus} />
        <ReadySignal onReady={onDancersReady} />
      </Suspense>

      <Suspense fallback={null}>
        <Experience
          audioBus={audioBus}
          introStarted={introStarted}
          trackName={trackName}
        />
      </Suspense>
      <mesh receiveShadow position={[0, -1, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[50, 50]} />
        <MeshReflectorMaterial
          color="#090910"
          resolution={512}
          mirror={0.22}
          mixStrength={0.62}
          mixContrast={1.08}
          blur={[320, 96]}
          mixBlur={1.15}
          metalness={0.72}
          roughness={0.56}
          depthScale={0.32}
          minDepthThreshold={0.32}
          maxDepthThreshold={1.25}
          depthToBlurRatioBias={0.38}
          reflectorOffset={0.015}
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
    </>
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
  const [musicPlaying, setMusicPlaying] = useState(() =>
    new URLSearchParams(window.location.search).has("autostart")
  );
  const [track, setTrack] = useState(() => ({
    path: wae,
    name: "wae.mp3",
  }));
  const [audioInfo, setAudioInfo] = useState(null);
  const { progress } = useProgress();
  const audioBus = useRef(createAudioBus()).current;
  const loadProgress = Math.round(Math.min(Math.max(progress, 0), 100));
  const assetsReady =
    sceneReady && dancersReady && audioReady && loadProgress >= 100;
  const introStarted = isStarted && assetsReady;
  const loadingLabel = assetsReady
    ? "SCENE READY"
    : loadProgress >= 100
      ? "ANALYZING AUDIO"
      : `LOADING SCENE · ${loadProgress}%`;
  const trackStatus = !musicPlaying
    ? "PAUSED · IDLE MODE"
    : audioInfo?.error
      ? "ANALYSIS FAILED"
      : audioInfo?.bpm
        ? `${audioInfo.bpm} BPM`
        : audioInfo
          ? "TEMPO UNAVAILABLE"
          : "ANALYZING TEMPO";

  const handleSceneReady = useCallback(() => setSceneReady(true), []);
  const handleDancersReady = useCallback(() => setDancersReady(true), []);
  const handleAudioReady = useCallback((analysis) => {
    setAudioInfo(analysis || { error: true });
    setAudioReady(true);
  }, []);

  const handleTrackUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setAudioInfo(null);
    setMusicPlaying(true);
    setTrack({ path: file, name: file.name });
  }, []);

  const handleStart = () => {
    setMusicPlaying(true);
    setStarted(true);
  };

  return (
    <div className={`stage-shell ${isStarted ? "" : "stage-shell--preview"}`}>
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
          audioBus={audioBus}
          trackPath={track.path}
          trackName={track.name}
          shouldPlay={isStarted && musicPlaying}
          showAudioStatus={isStarted}
          introStarted={introStarted}
          onAudioReady={handleAudioReady}
          onDancersReady={handleDancersReady}
          onSceneReady={handleSceneReady}
        />
      </Canvas>

      {isStarted && (
        <div className="music-dock">
          <button
            className="music-dock__transport"
            type="button"
            onClick={() => setMusicPlaying((playing) => !playing)}
            aria-label={musicPlaying ? "Pause music" : "Play music"}
            title={musicPlaying ? "Pause music" : "Play music"}
          >
            {musicPlaying ? "Ⅱ" : "▶"}
          </button>
          <div className="music-dock__track">
            <span className="music-dock__name" title={track.name}>
              {track.name}
            </span>
            <span className="music-dock__meta">{trackStatus}</span>
          </div>
          <label className="music-dock__upload">
            LOAD TRACK
            <input type="file" accept="audio/*" onChange={handleTrackUpload} />
          </label>
        </div>
      )}

      {isStarted && (
        <div
          className={`scene-curtain ${
            introStarted ? "scene-curtain--open" : ""
          }`}
        >
          <div className="scene-curtain__beam" />
          <p className="scene-curtain__label">ENTERING 8453</p>
        </div>
      )}

      <main className={`landing ${isStarted ? "landing--hidden" : ""}`}>
        <div className="landing__noise" />
        <p className="landing__eyebrow">8453 · AUDIO REACTIVE EXPERIENCE</p>
        <h1 className="landing__title">FEEL THE KICK</h1>
        <div className="landing__loader" aria-live="polite">
          <div className="landing__loader-track">
            <span
              className="landing__loader-progress"
              style={{ width: `${assetsReady ? 100 : loadProgress}%` }}
            />
          </div>
          <span className="landing__loader-label">{loadingLabel}</span>
        </div>
        <button className="start_btn" onClick={handleStart}>
          ENTER STAGE
        </button>
        <p className="landing__hint">sound on · drag to look around</p>
      </main>
    </div>
  );
}

export default App;
