import { LottieSvg } from "lottie-react";
import { medicalAnimations } from "../animations/medicalAnimations.js";

export default function MedicalLottiePlayer({ variant }) {
  const animationData = medicalAnimations[variant] || medicalAnimations.records;

  return (
    <LottieSvg
      src={animationData}
      loop={false}
      autoplay
      style={{ width: "100%", height: "100%" }}
    />
  );
}
