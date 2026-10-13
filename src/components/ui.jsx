import React, { useEffect, useRef } from "react";
import { Check, Info } from "lucide-react";
import { createQR, verifyQR } from "../qr";
export const date = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export const numbers = (value) => new Intl.NumberFormat().format(value);
export function IconButton({ label, children, ...props }) {
  return (
    <button className="icon-button" title={label} aria-label={label} {...props}>
      {children}
    </button>
  );
}

export function QRPreview({ url, design, className = "", onState }) {
  const ref = useRef(null);
  const callback = useRef(onState);
  callback.current = onState;
  useEffect(() => {
    let alive = true;
    let qr;
    const el = ref.current;
    el.replaceChildren();
    callback.current?.({ status: "checking" });
    try {
      qr = createQR(url, design);
      qr.append(el);
      if (!callback.current)
        return () => {
          alive = false;
        };
      const timer = setTimeout(async () => {
        try {
          const verified = await verifyQR(qr, url);
          if (alive)
            callback.current?.({
              status: verified ? "valid" : "invalid",
              message: verified
                ? "Preview decoded successfully"
                : "This design could not be decoded. Simplify the pattern or logo.",
            });
        } catch (e) {
          if (alive)
            callback.current?.({ status: "invalid", message: e.message });
        }
      }, 250);
      return () => {
        alive = false;
        clearTimeout(timer);
      };
    } catch (e) {
      callback.current?.({
        status: "invalid",
        message: e.issues?.map((i) => i.message).join(" ") || e.message,
      });
    }
    return () => {
      alive = false;
    };
  }, [url, JSON.stringify(design)]);
  return <div className={`qr-preview ${className}`} ref={ref} />;
}

export function Toast({ toast }) {
  return (
    <div role="status" className={`toast ${toast.error ? "toast-error" : ""}`}>
      {toast.error ? <Info size={18} /> : <Check size={18} />} {toast.message}
    </div>
  );
}

export function Stat({ label, value, icon: Icon, detail }) {
  return (
    <div className="stat">
      <div>
        <span>{label}</span>
        <span className="stat-icon">
          <Icon size={19} />
        </span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
