import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Autorise l'accès en mode dev via un tunnel ngrok
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.app", "*.ngrok.io"],
};

export default nextConfig;
