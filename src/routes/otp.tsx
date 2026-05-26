// Placeholder for OTP — currently redirects since we use email/password
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/otp")({
  component: () => <Navigate to="/login" />,
});
