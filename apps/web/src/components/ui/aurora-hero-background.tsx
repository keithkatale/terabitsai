"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  useMotionTemplate,
  useMotionValue,
  motion,
  animate,
} from "framer-motion";

const COLORS_TOP = ["#13FFAA", "#1E67C6", "#CE84CF", "#DD335C"];

function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const stars: { x: number; y: number; z: number; size: number; twinkle: number }[] = [];
    const numStars = 2000;

    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: Math.random() * canvas.width - canvas.width / 2,
        y: Math.random() * canvas.height - canvas.height / 2,
        z: Math.random() * 1000,
        size: Math.random() * 1.5 + 0.5,
        twinkle: Math.random() * Math.PI * 2,
      });
    }

    let animationFrame: number;

    const animate = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      for (const star of stars) {
        star.z -= 0.2;
        star.twinkle += 0.02;
        
        if (star.z <= 0) {
          star.z = 1000;
          star.x = Math.random() * canvas.width - centerX;
          star.y = Math.random() * canvas.height - centerY;
        }

        const scale = 400 / star.z;
        const x = star.x * scale + centerX;
        const y = star.y * scale + centerY;

        if (x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height) {
          const baseOpacity = Math.min(1, (1000 - star.z) / 600);
          const twinkleOpacity = 0.5 + 0.5 * Math.sin(star.twinkle);
          const opacity = baseOpacity * twinkleOpacity;
          const size = star.size * scale * 0.4;

          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.3, size), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.9})`;
          ctx.fill();
        }
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      style={{ background: "transparent" }}
    />
  );
}

export function AuroraHeroBackground({ className }: { className?: string }) {
  const color = useMotionValue(COLORS_TOP[0]);

  useEffect(() => {
    const controls = animate(color, COLORS_TOP, {
      ease: "easeInOut",
      duration: 10,
      repeat: Infinity,
      repeatType: "mirror",
    });

    return () => controls.stop();
  }, [color]);

  const backgroundImage = useMotionTemplate`radial-gradient(125% 125% at 50% 0%, #020617 50%, ${color})`;

  return (
    <motion.div 
      className={cn("absolute inset-0 overflow-hidden", className)}
      style={{ backgroundImage }}
    >
      <StarField />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070707] via-transparent to-transparent" />
    </motion.div>
  );
}

export default AuroraHeroBackground;
