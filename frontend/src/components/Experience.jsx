import {
  CameraControls,
  ContactShadows,
  Environment,
  Text,
} from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";
import { useChat } from "../hooks/useChat";
import { Avatar } from "./Avatar";

const Dots = (props) => {
  const { loading } = useChat();
  const [loadingText, setLoadingText] = useState("");
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setLoadingText((loadingText) => {
          if (loadingText.length > 2) {
            return ".";
          }
          return loadingText + ".";
        });
      }, 800);
      return () => clearInterval(interval);
    } else {
      setLoadingText("");
    }
  }, [loading]);
  if (!loading) return null;

  return (
    <group {...props}>
      <Text fontSize={0.14} anchorX={"left"} anchorY={"bottom"}>
        {loadingText}
        <meshBasicMaterial attach="material" color="black" />
      </Text>
    </group>
  );
};

export const Experience = ({ background = "Bar", useCustomHdri = false }) => {
  const cameraControls = useRef();
  const { cameraZoomed } = useChat();
  // Map our UI labels to drei presets - updated for better avatar matching
  const envPreset =
    background === "Park"
      ? "city"
      : background === "Beach"
      ? "dawn"
      : "night"; // Bar -> night (warmer, more intimate)

  // Optional HDRI files from Poly Haven (1k) - better matched to avatar style
  const filesUrl = (() => {
    if (!useCustomHdri) return null;
    const base = "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k";
    switch (background) {
      case "Park":
        return `${base}/urban_alley_01_1k.hdr`; // Urban setting
      case "Beach":
        return `${base}/golden_bay_1k.hdr`; // Warmer beach
      case "Bar":
      default:
        return `${base}/brown_photostudio_02_1k.hdr`; // Warm studio lighting
    }
  })();

  useEffect(() => {
    cameraControls.current.setLookAt(0, 2, 5, 0, 1.5, 0);
  }, []);

  useEffect(() => {
    if (cameraZoomed) {
      cameraControls.current.setLookAt(0, 1.5, 1.5, 0, 1.5, 0, true);
    } else {
      cameraControls.current.setLookAt(0, 2.2, 5, 0, 1.0, 0, true);
    }
  }, [cameraZoomed]);
  return (
    <>
      <CameraControls ref={cameraControls} />
      {filesUrl ? (
        <Environment files={filesUrl} background blur={0.2} />
      ) : (
        <Environment preset={envPreset} />
      )}
      {/* Wrapping Dots into Suspense to prevent Blink when Troika/Font is loaded */}
      <Suspense>
        <Dots position-y={1.75} position-x={-0.02} />
      </Suspense>
      <Avatar />
      <ContactShadows opacity={0.7} />
    </>
  );
};
