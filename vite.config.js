import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import glsl from "vite-plugin-glsl";
import gltf from "vite-plugin-gltf";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), glsl(), gltf()],
  assetsInclude: ["**/*.mp3", "**/*.gltf"],
});
