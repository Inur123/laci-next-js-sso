import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Auth",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white antialiased">{children}</div>
  );
}
