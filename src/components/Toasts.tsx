import type { ToastItem } from "../types";
import { useSettings } from "../settings";
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from "./Icons";

interface ToastsProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

export function Toasts({ toasts, onDismiss }: ToastsProps) {
  const { t } = useSettings();

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const Icon =
          toast.kind === "success"
            ? CheckIcon
            : toast.kind === "error"
              ? AlertIcon
              : InfoIcon;
        return (
          <div
            key={toast.id}
            className={`toast toast--${toast.kind}`}
            role={toast.kind === "error" ? "alert" : "status"}
          >
            <span className="toast-icon">
              <Icon width={17} height={17} />
            </span>
            <span className="toast-message">{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => onDismiss(toast.id)}
              aria-label={t("common.dismiss")}
            >
              <CloseIcon width={14} height={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
