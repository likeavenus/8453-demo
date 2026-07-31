import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  MeshReflectorMaterial,
  OrbitControls,
  SpotLight,
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
import { CreatorLinks } from "./components/CreatorLinks/CreatorLinks";
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

const mobileBeamVertexShader = /* glsl */ `
  varying vec2 vBeamUv;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;

  void main() {
    vBeamUv = uv;
    vViewNormal = normalize(normalMatrix * normal);

    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const mobileBeamFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying vec2 vBeamUv;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;

  void main() {
    vec3 viewDirection = normalize(-vViewPosition);
    float facing = abs(dot(normalize(vViewNormal), viewDirection));
    float softVolume = 0.06 + facing * facing * 0.94;

    float sourceFade = smoothstep(0.0, 0.055, vBeamUv.y);
    float endFade = 1.0 - smoothstep(0.72, 1.0, vBeamUv.y);
    float distanceFade = 1.0 - vBeamUv.y * 0.66;

    float grain = fract(
      52.9829189 *
      fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))
    );
    float alpha =
      uOpacity *
      sourceFade *
      endFade *
      distanceFade *
      softVolume *
      mix(0.965, 1.0, grain);

    if (alpha < 0.001) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

function MovingSpot({
  audioBus,
  fixture = 0,
  phase = 0,
  intensity = 8,
  lowPower = false,
  ...props
}) {
  const light = useRef(null);
  const beamMaterial = useRef(null);
  const mobileBeam = useRef(null);
  const previousBeat = useRef(-1);
  const beatTarget = useMemo(() => new THREE.Vector3(), []);
  const desiredTarget = useMemo(() => new THREE.Vector3(), []);
  const beamSource = useMemo(() => new THREE.Vector3(), []);
  const beamEnd = useMemo(() => new THREE.Vector3(), []);
  const beamDirection = useMemo(() => new THREE.Vector3(), []);
  const beamAxis = useMemo(() => new THREE.Vector3(0, -1, 0), []);
  const mobileBeamUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(props.color || "white") },
      uOpacity: { value: 0 },
    }),
    [props.color]
  );

  useFrame((state, delta) => {
    if (!light.current) return;

    const time = state.clock.getElapsedTime();
    const beatNumber = audioBus.hatHitCount + audioBus.clapHitCount;

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
      audioBus.highFlux,
      audioBus.hat,
      audioBus.clap * 0.68
    );
    const chaseLevel = isPrimary ? 1 : isNeighbor ? 0.16 : 0;
    const shimmer = 0.5 + 0.5 * Math.sin(time * 2.15 + phase * 1.7);
    const desiredIntensity = audioBus.isPlaying
      ? chaseLevel *
          (intensity * 0.34 +
            pulse * 22 +
            audioBus.high * 11 +
            audioBus.presence * 1.25) +
        audioBus.highFlux * (fixture % 2 === 0 ? 6.5 : 4.5) +
        (isClapAccent ? audioBus.clap * 11 : 0) +
        (isPrimary ? shimmer * (0.7 + audioBus.high * 1.4) : 0.04)
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

    const desiredOpacity = audioBus.isPlaying
      ? 0.018 +
        chaseLevel * 0.105 +
        pulse * (isPrimary ? 0.25 : 0.06) +
        audioBus.high * (isPrimary ? 0.075 : 0.015) +
        (isClapAccent ? audioBus.clap * 0.13 : 0)
      : 0;

    if (beamMaterial.current) {
      beamMaterial.current.uniforms.opacity.value = THREE.MathUtils.damp(
        beamMaterial.current.uniforms.opacity.value,
        desiredOpacity,
        desiredOpacity > beamMaterial.current.uniforms.opacity.value ? 18 : 9,
        delta
      );
    }

    if (mobileBeam.current) {
      light.current.getWorldPosition(beamSource);
      light.current.target.getWorldPosition(beamEnd);
      beamDirection.copy(beamEnd).sub(beamSource);
      const beamLength = Math.max(beamDirection.length(), 0.01);
      const beamRadius = Math.min(2.15, beamLength * 0.3);
      const mobileOpacity = Math.min(
        0.26,
        desiredOpacity * 1.08 + (audioBus.isPlaying ? 0.006 : 0)
      );

      mobileBeam.current.position
        .copy(beamSource)
        .addScaledVector(beamDirection, 0.5);
      mobileBeam.current.quaternion.setFromUnitVectors(
        beamAxis,
        beamDirection.normalize()
      );
      mobileBeam.current.scale.set(beamRadius, beamLength, beamRadius);
      const opacityUniform =
        mobileBeam.current.material.uniforms.uOpacity;
      opacityUniform.value = THREE.MathUtils.damp(
        opacityUniform.value,
        mobileOpacity,
        mobileOpacity > opacityUniform.value ? 18 : 9,
        delta
      );
      mobileBeam.current.visible = opacityUniform.value > 0.002;
    }
  });

  return (
    <>
      <SpotLight
        ref={light}
        castShadow={!lowPower && fixture === 2}
        volumetric={!lowPower && (fixture % 2 === 0 || fixture === 5)}
        penumbra={0.82}
        distance={11.5}
        angle={0.34}
        attenuation={4.2}
        anglePower={5.2}
        opacity={0}
        shadow-bias={-0.00015}
        {...props}
      />
      {lowPower && (
        <mesh
          ref={mobileBeam}
          frustumCulled={false}
          renderOrder={2}
          raycast={() => null}
        >
          <cylinderGeometry args={[0.025, 1, 1, 32, 1, true]} />
          <shaderMaterial
            uniforms={mobileBeamUniforms}
            vertexShader={mobileBeamVertexShader}
            fragmentShader={mobileBeamFragmentShader}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            forceSinglePass
          />
        </mesh>
      )}
    </>
  );
}

function ClubWash({ audioBus }) {
  const cyan = useRef(null);
  const magenta = useRef(null);
  const violet = useRef(null);

  useFrame(() => {
    if (cyan.current) {
      cyan.current.intensity =
        1.8 + audioBus.lowMid * 3.6 + audioBus.lowMidFlux * 1.4;
    }
    if (magenta.current) {
      magenta.current.intensity =
        1.7 + audioBus.presence * 3.1 + audioBus.clap * 2.2;
    }
    if (violet.current) {
      violet.current.intensity =
        1.4 + audioBus.high * 2.4 + audioBus.hat * 2.8;
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

function DanceFloor({ audioBus, lowPower = false }) {
  const rings = useRef([]);

  useFrame((state, delta) => {
    rings.current.forEach((material, index) => {
      if (!material) return;

      const ripple = Math.max(
        0,
        audioBus.sub - index * 0.055 + audioBus.kick * 0.28
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
    <group position={[0, -0.978, 0]}>
      <mesh position-y={-0.01} receiveShadow={!lowPower}>
        <cylinderGeometry args={[3.55, 3.55, 0.035, lowPower ? 48 : 72]} />
        <meshStandardMaterial
          color="#0c0d15"
          metalness={0.76}
          roughness={0.38}
        />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <mesh
          key={`floor-spoke-${index}`}
          position={[0, 0.014, 0]}
          rotation-y={(index * Math.PI) / 6}
        >
          <boxGeometry args={[0.028, 0.012, 6.35]} />
          <meshStandardMaterial
            color={index % 2 === 0 ? "#113d52" : "#4b1739"}
            emissive={index % 2 === 0 ? "#0ba6e8" : "#f01d7e"}
            emissiveIntensity={0.28}
            metalness={0.5}
            roughness={0.42}
          />
        </mesh>
      ))}
      {[0, 1, 2, 3, 4].map((index) => {
        const innerRadius = 0.85 + index * 0.62;

        return (
          <mesh key={innerRadius} rotation-x={-Math.PI / 2} position-y={0.022}>
            <ringGeometry
              args={[innerRadius, innerRadius + 0.055, lowPower ? 64 : 96]}
            />
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

function RotatingDanceStage({ audioBus, lowPower, onDancersReady }) {
  const stage = useRef(null);
  const angularSpeed = useRef(0);

  useFrame((_, delta) => {
    if (!stage.current) return;

    const sustainedEnergy =
      audioBus.sub * 0.16 +
      audioBus.bass * 0.25 +
      audioBus.lowMid * 0.2 +
      audioBus.presence * 0.17 +
      audioBus.high * 0.08 +
      audioBus.body * 0.14;
    const audibleDrive =
      THREE.MathUtils.smoothstep(sustainedEnergy, 0.055, 0.48) *
      THREE.MathUtils.smoothstep(audioBus.loudness || 0, 0.035, 0.22);
    const targetSpeed =
      audioBus.isPlaying && audibleDrive > 0.02
        ? 0.01 + audibleDrive * 0.026
        : 0;

    angularSpeed.current = THREE.MathUtils.damp(
      angularSpeed.current,
      targetSpeed,
      targetSpeed > angularSpeed.current ? 0.75 : 1.8,
      delta
    );
    stage.current.rotation.y += angularSpeed.current * Math.min(delta, 0.1);
  });

  return (
    <group ref={stage}>
      <DanceCrowd audioBus={audioBus} lowPower={lowPower} />
      <DanceFloor audioBus={audioBus} lowPower={lowPower} />
      <ReadySignal onReady={onDancersReady} />
    </group>
  );
}

function ReactivePostprocessing({ audioBus, lowPower = false }) {
  const bloom = useRef(null);

  useFrame(() => {
    if (bloom.current) {
      bloom.current.intensity =
        0.22 + audioBus.high * 0.12 + audioBus.hat * 0.2;
    }
  });

  if (lowPower) return null;

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

function ClubFloor({ lowPower = false }) {
  return (
    <mesh receiveShadow={!lowPower} position={[0, -1, 0]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[50, 50]} />
      {lowPower ? (
        <meshStandardMaterial
          color="#090910"
          metalness={0.82}
          roughness={0.32}
        />
      ) : (
        <MeshReflectorMaterial
          color="#090910"
          resolution={256}
          mirror={0.4}
          mixStrength={0.68}
          mixContrast={1.06}
          blur={[144, 48]}
          mixBlur={1.05}
          metalness={0.72}
          roughness={0.54}
          depthScale={0.26}
          minDepthThreshold={0.34}
          maxDepthThreshold={1.18}
          depthToBlurRatioBias={0.4}
          reflectorOffset={0.015}
        />
      )}
    </mesh>
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
  lowPower,
}) {
  return (
    <>
      <AudioVisualizer
        path={trackPath}
        audioBus={audioBus}
        onReady={onAudioReady}
        shouldPlay={shouldPlay}
        showStatus={showAudioStatus}
      />
      <ClubArchitecture audioBus={audioBus} lowPower={lowPower} />
      <Suspense fallback={null}>
        <TV
          audioBus={audioBus}
          position={[0, 4.1, -4.04]}
          rotation={[0, 0, 0]}
          scale={1}
          screenSize={[5.2, 2.1]}
          shouldPlay={shouldPlay}
          lowPower={lowPower}
        />
      </Suspense>
      <group position={[0, 0, 0.8]}>
        <ClubSmoke audioBus={audioBus} lowPower={lowPower} />
        <Suspense fallback={null}>
          <RotatingDanceStage
            audioBus={audioBus}
            lowPower={lowPower}
            onDancersReady={onDancersReady}
          />
        </Suspense>

        <Suspense fallback={null}>
          <Experience
            audioBus={audioBus}
            introStarted={introStarted}
            trackName={trackName}
          />
        </Suspense>
      </group>
      <ClubFloor lowPower={lowPower} />

      <ambientLight intensity={0.035} />
      <ClubWash audioBus={audioBus} />
      {concertLights.map((light, fixture) => (
        <MovingSpot
          key={`${light.color}-${fixture}`}
          audioBus={audioBus}
          color={light.color}
          position={light.position}
          phase={light.phase}
          fixture={fixture}
          intensity={fixture === 2 || fixture === 5 ? 7 : 8}
          lowPower={lowPower}
        />
      ))}
      <ReactivePostprocessing audioBus={audioBus} lowPower={lowPower} />
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
      target={[0, 0.75, 0.35]}
      args={[camera, gl.domElement]}
    />
  );
}

const formatTrackTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
};

function TrackTimeline({ audioBus }) {
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const scrubbing = useRef(false);

  useEffect(() => {
    const updateTimeline = () => {
      const nextDuration = audioBus.duration || 0;
      setDuration((current) =>
        Math.abs(current - nextDuration) > 0.01 ? nextDuration : current
      );

      if (!scrubbing.current) {
        const nextPosition = audioBus.position || 0;
        setPosition((current) =>
          Math.abs(current - nextPosition) > 0.04 ? nextPosition : current
        );
      }
    };

    updateTimeline();
    const interval = window.setInterval(updateTimeline, 80);
    return () => window.clearInterval(interval);
  }, [audioBus]);

  const commitSeek = (value) => {
    const nextPosition = Number(value);
    if (!Number.isFinite(nextPosition)) return;

    const committedPosition = audioBus.seek?.(nextPosition) ?? nextPosition;
    setPosition(committedPosition);
  };

  const handleChange = (event) => {
    const nextPosition = Number(event.currentTarget.value);
    setPosition(nextPosition);

    if (!scrubbing.current) commitSeek(nextPosition);
  };

  const finishScrubbing = (event) => {
    if (!scrubbing.current) return;
    scrubbing.current = false;
    commitSeek(event.currentTarget.value);
  };

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <div className="music-dock__timeline">
      <span className="music-dock__time">{formatTrackTime(position)}</span>
      <input
        className="music-dock__seek"
        type="range"
        min="0"
        max={duration || 1}
        step="0.01"
        value={Math.min(position, duration || 0)}
        disabled={!duration}
        aria-label="Seek through track"
        aria-valuetext={`${formatTrackTime(position)} of ${formatTrackTime(
          duration
        )}`}
        style={{ "--seek-progress": `${progress}%` }}
        onPointerDown={(event) => {
          scrubbing.current = true;
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerUp={finishScrubbing}
        onPointerCancel={finishScrubbing}
        onBlur={finishScrubbing}
        onChange={handleChange}
      />
      <span className="music-dock__time music-dock__time--duration">
        {formatTrackTime(duration)}
      </span>
    </div>
  );
}

function App() {
  const [renderProfile] = useState(() => {
    const compactViewport = window.matchMedia("(max-width: 820px)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const cpuCores = navigator.hardwareConcurrency || 8;
    const deviceMemory = navigator.deviceMemory || 8;
    const lowPower =
      compactViewport || coarsePointer || cpuCores <= 4 || deviceMemory <= 4;

    return {
      lowPower,
      dpr: lowPower ? [0.75, 1] : [1, 1.25],
    };
  });
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
  const [tempoBpm, setTempoBpm] = useState(null);
  const { progress } = useProgress();
  const audioBus = useRef(createAudioBus()).current;
  const tempoOptions = useMemo(() => {
    if (!audioInfo?.bpm) return [];

    const options = [audioInfo.bpm];
    if (audioInfo.bpm >= 100) options.push(Math.round(audioInfo.bpm / 2));
    if (audioInfo.bpm <= 110) options.push(Math.round(audioInfo.bpm * 2));
    return [...new Set(options)].filter((bpm) => bpm >= 45 && bpm <= 220);
  }, [audioInfo]);
  const currentTempoIndex = Math.max(0, tempoOptions.indexOf(tempoBpm));
  const nextTempo =
    tempoOptions.length > 1
      ? tempoOptions[(currentTempoIndex + 1) % tempoOptions.length]
      : null;
  const tempoSwitchLabel = nextTempo
    ? nextTempo < tempoBpm
      ? `½ ${nextTempo}`
      : `×2 ${nextTempo}`
    : null;
  const loadProgress = Math.round(Math.min(Math.max(progress, 0), 100));
  const assetsReady =
    sceneReady && dancersReady && audioReady && loadProgress >= 100;
  const introStarted = isStarted && assetsReady;
  const loadingLabel = assetsReady
    ? "SCENE READY"
    : loadProgress >= 100
      ? "ANALYZING AUDIO"
      : `LOADING SCENE · ${loadProgress}%`;
  const tempoStatus = tempoBpm
    ? `${tempoBpm} BPM`
    : null;
  const trackStatus = !musicPlaying
    ? "PAUSED · IDLE MODE"
    : audioInfo?.error
      ? "ANALYSIS FAILED"
      : tempoStatus
        ? tempoStatus
        : audioInfo
          ? "TEMPO UNAVAILABLE"
          : "ANALYZING TEMPO";

  const handleSceneReady = useCallback(() => setSceneReady(true), []);
  const handleDancersReady = useCallback(() => setDancersReady(true), []);
  const handleAudioReady = useCallback((analysis) => {
    setAudioInfo(analysis || { error: true });
    setTempoBpm(analysis?.bpm || null);
    setAudioReady(true);
  }, []);

  const handleTrackUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setAudioInfo(null);
    setTempoBpm(null);
    setMusicPlaying(true);
    setTrack({ path: file, name: file.name });
  }, []);

  const handleStart = () => {
    setMusicPlaying(true);
    setStarted(true);
  };

  const handleTempoToggle = () => {
    if (!nextTempo) return;
    audioBus.bpm = nextTempo;
    audioBus.visualBpm = nextTempo;
    setTempoBpm(nextTempo);
  };

  return (
    <div className={`stage-shell ${isStarted ? "" : "stage-shell--preview"}`}>
      <Canvas
        shadows={!renderProfile.lowPower}
        dpr={renderProfile.dpr}
        camera={{ position: [0, 1.55, 7.4], fov: 48, near: 0.1, far: 50 }}
        gl={{
          antialias: !renderProfile.lowPower,
          powerPreference: renderProfile.lowPower ? "low-power" : "default",
        }}
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
          lowPower={renderProfile.lowPower}
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
            <span className="music-dock__meta-row">
              <span className="music-dock__meta">{trackStatus}</span>
              {nextTempo && (
                <button
                  className="music-dock__tempo-switch"
                  type="button"
                  onClick={handleTempoToggle}
                  title={`Use ${nextTempo < tempoBpm ? "half-time" : "double-time"}: ${nextTempo} BPM`}
                  aria-label={`Use ${nextTempo < tempoBpm ? "half-time" : "double-time"}: ${nextTempo} BPM`}
                >
                  {tempoSwitchLabel}
                </button>
              )}
            </span>
          </div>
          <label className="music-dock__upload">
            LOAD TRACK
            <input type="file" accept="audio/*" onChange={handleTrackUpload} />
          </label>
          <TrackTimeline audioBus={audioBus} />
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
      <CreatorLinks />
    </div>
  );
}

export default App;
