import { Metadata } from "next";
import LoginForm from "@/components/features/auth/login-form";

export const metadata: Metadata = {
  title: "Login",
};

export default function LoginPage() {
  return <LoginForm />;
}
