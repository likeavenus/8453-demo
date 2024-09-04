import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Sphere } from "@react-three/drei";
import React, { useRef, useEffect, useState, useMemo } from "react";
import fragmentShader from "../shaders/sphere/fragment.glsl";
import vertexShader from "../shaders/sphere/vertex.glsl";

import track from "/music/track.mp3";
import gsap from "gsap";

const WIREFRAME_DELTA = 0.015;

export class Visualizer {
  constructor(mesh, frequencyUniformName) {
    this.mesh = mesh;
    this.frequencyUniformName = frequencyUniformName;
    this.listener = new THREE.AudioListener();
    this.mesh.add(this.listener);
    this.mesh.material.uniforms[this.frequencyUniformName] = {
      value: 0,
    };

    this.sound = new THREE.Audio(this.listener);
    this.loader = new THREE.AudioLoader();

    this.analyzer = new THREE.AudioAnalyser(this.sound, 256);
  }

  async load(path) {
    this.loader.load(path, (buffer) => {
      this.sound.setBuffer(buffer);
      this.sound.setLoop(true);
      //   this.sound.setVolume(0.5);
      this.sound.play();
    });
  }

  getFrequency() {
    return this.analyzer.getAverageFrequency();
  }

  update() {
    const freq = Math.max(this.getFrequency() - 100, 0) / 44;
    this.mesh.material.uniforms[this.frequencyUniformName].value = freq;

    const freqUniform = this.mesh.material.uniforms[this.frequencyUniformName];

    gsap.to(freqUniform, {
      duration: 1.5,
      ease: "Slow.easeOut",
      value: freq,
    });

    freqUniform.value = freq;
  }
}

export const AudioVisualizer = ({ path }) => {
  const meshRef = useRef(null); // Ссылка на объект Three.js
  const [visualizer, setVisualizer] = useState(null); // Состояние для Visualizer

  const uniforms = useMemo(() => {
    return {
      uTime: {
        value: 0,
      },
      uAudioFrequency: {
        value: 0.0,
      },
    };
  }, []);

  useEffect(() => {
    (async () => {
      if (meshRef.current && !visualizer) {
        const newVisualizer = new Visualizer(
          meshRef.current,
          "uAudioFrequency"
        );

        await newVisualizer.load(path);
        setVisualizer(newVisualizer);
      }
    })();
  }, [meshRef.current]);

  //   Обновляем визуализацию на каждом кадре
  useFrame((state) => {
    if (visualizer) {
      visualizer.update();

      const time = state.clock.getElapsedTime();

      meshRef.current.material.uniforms.uTime.value = time;

      //   meshRef.current.position.x = Math.sin(time) + 1;
      //   meshRef.current.position.z = Math.cos(time) + 1;

      light.current.intensity =
        meshRef.current.material.uniforms["uAudioFrequency"].value *
        Math.floor(Math.random() * 15);
    }
  });

  const light = useRef();

  return (
    <Sphere
      scale={[0.7, 0.7, 0.7]}
      ref={meshRef}
      args={[1, 64, 64]}
      position={[0, 2, 0]}
    >
      <pointLight castShadow intensity={15} ref={light} color="purple" />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
      <lineSegments
        ref={meshRef}
        scale={[1 + WIREFRAME_DELTA, 1 + WIREFRAME_DELTA, 1 + WIREFRAME_DELTA]}
      >
        <sphereGeometry attach="geometry" />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
        />
      </lineSegments>
    </Sphere>
  );
};
