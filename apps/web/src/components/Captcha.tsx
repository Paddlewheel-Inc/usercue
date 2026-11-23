import ReCAPTCHA from "react-google-recaptcha";

interface CaptchaProps {
  onVerify: (token: string | null) => void;
}

export const isCaptchaEnabled = Boolean(import.meta.env.VITE_RECAPTCHA_SITE_KEY);

export function Captcha({ onVerify }: CaptchaProps) {
  let siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  if (!siteKey) {
    return null;
    //siteKey = "123321";
  }

  return (
    <ReCAPTCHA
      sitekey={siteKey}
      onChange={onVerify}
      onExpired={() => onVerify(null)}
      onErrored={() => onVerify(null)}
    />
  );
}
