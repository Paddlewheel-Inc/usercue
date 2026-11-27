import type { CaptchaAction } from "@usercue/shared";
import { forwardRef, useImperativeHandle, useRef } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import { useMe } from "../lib/queries";

export interface CaptchaHandle {
  reset: () => void;
}

interface CaptchaProps {
  onVerify: (token: string | null) => void;
  action?: CaptchaAction;
  className?: string;
}

export function useCaptcha(action: CaptchaAction) {
  const { data: me } = useMe();
  const siteKey = me?.captcha?.siteKey?.trim() || import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";
  return {
    siteKey,
    enabled: Boolean(me?.captcha?.actions?.[action] && siteKey),
  };
}

export const Captcha = forwardRef<CaptchaHandle, CaptchaProps>(function Captcha(
  { onVerify, action = "posts", className },
  ref,
) {
  const { siteKey } = useCaptcha(action);
  const widget = useRef<ReCAPTCHA>(null);
  useImperativeHandle(ref, () => ({ reset: () => widget.current?.reset() }), []);
  if (!siteKey) return null;

  return (
    <div className={className}>
      <ReCAPTCHA
        ref={widget}
        sitekey={siteKey}
        onChange={onVerify}
        onExpired={() => onVerify(null)}
        onErrored={() => onVerify(null)}
      />
    </div>
  );
});
