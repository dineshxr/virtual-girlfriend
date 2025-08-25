import { Loader } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Leva } from "leva";
import { useEffect, useState } from "react";
import { Experience } from "./components/Experience";
import { UI } from "./components/UI";
import ErrorBoundary from "./components/ErrorBoundary";

function App() {
  const [background, setBackground] = useState("Bar"); // Bar | Park | Beach
  const [useCustomHdri, setUseCustomHdri] = useState(true);

  // Load persisted preferences
  useEffect(() => {
    try {
      const savedBg = localStorage.getItem("vg_bg");
      if (savedBg) setBackground(savedBg);
      const savedHdri = localStorage.getItem("vg_hdri");
      setUseCustomHdri(savedHdri === "0" ? false : true); // Default to true unless explicitly disabled
    } catch {}
  }, []);

  // Persist preferences
  useEffect(() => {
    try {
      localStorage.setItem("vg_bg", background);
    } catch {}
  }, [background]);
  useEffect(() => {
    try {
      localStorage.setItem("vg_hdri", useCustomHdri ? "1" : "0");
    } catch {}
  }, [useCustomHdri]);
  return (
    <ErrorBoundary>
      <Loader />
      <Leva hidden />
      <UI background={background} setBackground={setBackground} useCustomHdri={useCustomHdri} setUseCustomHdri={setUseCustomHdri} />
      <ErrorBoundary>
        <Canvas shadows camera={{ position: [0, 0, 1], fov: 30 }}>
          <ErrorBoundary>
            <Experience background={background} useCustomHdri={useCustomHdri} />
          </ErrorBoundary>
        </Canvas>
      </ErrorBoundary>
    </ErrorBoundary>
  );
}

export default App;
