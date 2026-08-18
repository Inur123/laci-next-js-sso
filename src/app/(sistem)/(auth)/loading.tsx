import { Spinner } from "@/components/ui/spinner";

export default function AuthLoading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-50">
      <Spinner className="size-10 text-green-600" />
    </div>
  );
}
