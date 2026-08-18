"use client";

import { useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Ya, Lanjutkan",
  cancelText = "Batal",
  variant = "default",
  loading = false,
}: ConfirmModalProps) {
  // Listen for Enter key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && !loading && e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onConfirm]);

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-[400px]">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <AlertTriangle size={24} />
          </div>
          <AlertDialogTitle className="text-center text-xl">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center pt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-center">
          <AlertDialogCancel
            onClick={onClose}
            disabled={loading}
            className="flex-1 hover:bg-slate-100 transition-all duration-200"
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className={cn(
              "flex-1 text-white shadow-md hover:shadow-xl transition-all duration-200",
              variant === "destructive"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-green-600 hover:bg-green-700",
            )}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
