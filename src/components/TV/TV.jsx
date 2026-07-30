import React, { useEffect, useState } from "react";
import * as THREE from "three";

import { useGLTF } from "@react-three/drei";

import url from "/video/swag.mp4";
import tv from "/models/tv.gltf";

export const TV = ({
  position = [-3.05, 0.12, -1.65],
  rotation = [Math.PI / 14, Math.PI * 1.14, 0],
  scale = 0.72,
}) => {
  const { nodes } = useGLTF(tv);

  const [video] = useState(() => {
    const vid = document.createElement("video");
    vid.src = url;
    vid.crossOrigin = "Anonymous";
    vid.loop = true;
    vid.muted = true;
    return vid;
  });

  useEffect(() => {
    video.play().catch(() => {});

    return () => {
      video.pause();
    };
  }, [video]);

  return (
    <group
      position={position}
      rotation={rotation}
      scale={scale}
    >
      <mesh geometry={nodes.TV.geometry}>
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh rotation={[0, 0, 0]} position={[0, 0, 1.1]}>
        <planeGeometry args={[3.2, 1.9]} />
        <meshStandardMaterial emissive={"white"} side={THREE.DoubleSide}>
          <videoTexture attach="map" args={[video]} />
          <videoTexture attach="emissiveMap" args={[video]} />
        </meshStandardMaterial>
      </mesh>
    </group>
  );
};
