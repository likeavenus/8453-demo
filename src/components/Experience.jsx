import {
  Box,
  Center,
  DragControls,
  OrbitControls,
  Plane,
  useMatcapTexture,
} from "@react-three/drei";
import { Perf } from "r3f-perf";
import { Text3D } from "@react-three/drei";
import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import { useControls } from "leva";
import { slideAtom } from "./Overlay/Overlay";

import { CameraHandler } from "./CameraHandler/CameraHandler";

const torusGeometry = new THREE.TorusGeometry(1, 0.6, 16, 32);
const material = new THREE.MeshMatcapMaterial();

export const Experience = () => {
  const donuts = useRef([]);
  const [matCapTexture] = useMatcapTexture("1B1B1B_515151_7E7E7E_6C6C6C", 256);

  useEffect(() => {
    matCapTexture.encoding = THREE.sRGBEncoding;
    matCapTexture.needsUpdate = true;

    material.matcap = matCapTexture;
    material.needsUpdate = true;
  }, []);

  // useFrame((state, delta) => {
  // for (const donut of donuts.current) {
  //   donut.rotation.y += delta * 0.1;
  // }
  // });

  // const { slideDistance } = useControls({
  //   slideDistance: {
  //     value: 1,
  //     min: 0,
  //     max: 10,
  //   },
  // });

  return (
    <>
      {/* <CameraHandler slideDistance={slideDistance} /> */}
      <RigidBody restitution={1}>
        <Text3D
          castShadow
          position={[-0.8, 1, 1]}
          font="./fonts/Roboto_Bold.json"
        >
          8
          <meshMatcapMaterial matcap={matCapTexture} />
        </Text3D>
      </RigidBody>
      <RigidBody restitution={1}>
        <Text3D
          castShadow
          position={[0, 1.3, 2]}
          font="./fonts/Roboto_Bold.json"
        >
          4
          <meshMatcapMaterial matcap={matCapTexture} />
        </Text3D>
      </RigidBody>
      <RigidBody restitution={1}>
        <Text3D
          castShadow
          position={[0.8, 1.5, 2]}
          font="./fonts/Roboto_Bold.json"
        >
          5
          <meshMatcapMaterial matcap={matCapTexture} />
        </Text3D>
      </RigidBody>
      <RigidBody restitution={1}>
        <Text3D
          castShadow
          position={[1.6, 1.7, 2]}
          font="./fonts/Roboto_Bold.json"
        >
          3
          <meshMatcapMaterial matcap={matCapTexture} />
        </Text3D>
      </RigidBody>

      {/* {[...Array(100)].map((value, index) => (
        <mesh
          ref={(element) => (donuts.current[index] = element)}
          key={index}
          position={[
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
          ]}
          scale={0.2 + Math.random() * 0.2}
          rotation={[Math.random() * Math.PI, Math.random() * Math.PI, 0]}
        >
          <torusGeometry />
          <meshMatcapMaterial matcap={matCapTexture} />
        </mesh>
      ))} */}
    </>
  );
};
