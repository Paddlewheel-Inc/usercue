import { type FormEvent, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Captcha, type CaptchaHandle, useCaptcha } from "../components/Captcha";
import { Logo } from "../components/PublicLayout";
import { ErrorText } from "../components/ui";
import { useAcceptInvite, useInvite } from "../lib/queries";

export function JoinPage() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const { data, isLoading, error } = useInvite(token);
  const accept = useAcceptInvite(token);
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<CaptchaHandle>(null);
  const { enabled: captchaEnabled } = useCaptcha("setup");

  function resetCaptcha() {
    captchaRef.current?.reset();
    setCaptchaToken(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    accept.mutate(
      {
        email: data.email,
        name,
        password,
        captchaToken: captchaEnabled ? (captchaToken ?? undefined) : undefined,
      },
      {
        onSuccess: () => navigate("/admin"),
        onError: resetCaptcha,
      },
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={submit} className="flex w-full max-w-sm animate-in flex-col gap-3">
        <div className="mb-4 flex flex-col items-center gap-3 text-center">
          <Logo />
          <div>
            <h1 className="text-base font-semibold tracking-tight">Join the workspace</h1>
            <p className="mt-1 text-muted">
              {data ? `Create your staff account for ${data.email}.` : "Accept your staff invite."}
            </p>
          </div>
        </div>

        {isLoading && <p className="text-center text-muted">Checking your invite…</p>}
        <ErrorText error={error} />

        {data && (
          <>
            <input className="input h-9" type="email" value={data.email} readOnly />
            <input
              className="input h-9"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
            <input
              className="input h-9"
              type="password"
              placeholder="Password (min. 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            {captchaEnabled && (
              <Captcha
                ref={captchaRef}
                action="setup"
                className="self-center"
                onVerify={setCaptchaToken}
              />
            )}
            <ErrorText error={accept.error} />
            <button
              type="submit"
              className="btn-primary mt-1 h-9"
              disabled={accept.isPending || (captchaEnabled && !captchaToken)}
            >
              Create account
            </button>
          </>
        )}
      </form>
    </div>
  );
}
