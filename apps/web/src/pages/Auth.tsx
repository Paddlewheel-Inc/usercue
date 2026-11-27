import { type FormEvent, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Captcha, type CaptchaHandle, useCaptcha } from "../components/Captcha";
import { OAuthButtons } from "../components/OAuthButtons";
import { Logo } from "../components/PublicLayout";
import { ThemeToggle } from "../components/ThemeToggle";
import { ErrorText } from "../components/ui";
import { useAuth, useAuthMethods } from "../lib/queries";

export function AuthPage({ mode }: { mode: "login" | "setup" | "signin" }) {
  const { login, setup } = useAuth();
  const { data: methods, isFetched } = useAuthMethods();
  const [, navigate] = useLocation();
  const oauthError = new URLSearchParams(useSearch()).get("error");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<CaptchaHandle>(null);

  const isSetup = mode === "setup";
  const isSignin = mode === "signin";
  const captchaAction = isSetup ? "setup" : "login";
  const { enabled: captchaEnabled } = useCaptcha(captchaAction);
  const mutation = isSetup ? setup : login;
  const showOAuth = !isSetup && Boolean(methods?.providers.length);
  const forceOAuth = isFetched && methods?.passwordLogin === false;
  const showPassword = isSetup || (!isSignin && isFetched && !forceOAuth);

  function resetCaptcha() {
    captchaRef.current?.reset();
    setCaptchaToken(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const token = captchaEnabled ? (captchaToken ?? undefined) : undefined;
    if (isSetup) {
      setup.mutate({ name, email, password, captchaToken: token }, { onError: resetCaptcha });
    } else {
      login.mutate(
        { email, password, captchaToken: token },
        {
          onSuccess: () => navigate("/admin"),
          onError: resetCaptcha,
        },
      );
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <form onSubmit={submit} className="flex w-full max-w-sm animate-in flex-col gap-3">
        <div className="mb-4 flex flex-col items-center gap-3 text-center">
          <Logo wordmark={false} />
          <div>
            <h1 className="text-base font-semibold tracking-tight">
              {isSetup
                ? "Create your workspace"
                : isSignin || forceOAuth
                  ? "Sign in"
                  : "Workspace login"}
            </h1>
            <p className="mt-1 text-muted">
              {isSetup
                ? "This account will own the workspace."
                : isSignin || forceOAuth
                  ? isSignin
                    ? "Use a connected account to post and comment."
                    : "Use a connected account."
                  : "Welcome back."}
            </p>
          </div>
        </div>

        {oauthError && <p className="text-center text-xs text-rose-500">{oauthError}</p>}

        {captchaEnabled && (
          <Captcha
            ref={captchaRef}
            action={captchaAction}
            className="self-center"
            onVerify={setCaptchaToken}
          />
        )}

        {showOAuth && (
          <>
            <OAuthButtons
              next={isSignin ? "board" : "admin"}
              captchaToken={captchaEnabled ? captchaToken : undefined}
            />
            {showPassword && (
              <div className="flex items-center gap-3 text-[11px] tracking-[0.12em] text-faint uppercase">
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>
            )}
          </>
        )}

        {!showOAuth && forceOAuth && !isSignin && (
          <p className="text-center text-[12px] text-muted">No sign-in methods are turned on.</p>
        )}

        {isSignin && !forceOAuth && (
          <p className="mt-2 text-center text-[12px] text-muted">
            {showOAuth ? (
              <>
                Staff?{" "}
                <Link href="/login" className="text-fg underline-offset-2 hover:underline">
                  Workspace login
                </Link>
              </>
            ) : (
              <>
                Sign-in isn&apos;t configured yet.{" "}
                <Link href="/login" className="text-fg underline-offset-2 hover:underline">
                  Staff can log in here
                </Link>
                .
              </>
            )}
          </p>
        )}

        {isSignin && forceOAuth && !showOAuth && (
          <p className="mt-2 text-center text-[12px] text-muted">
            Sign-in isn&apos;t configured yet.
          </p>
        )}

        {showPassword && (
          <>
            {isSetup && (
              <input
                className="input h-9"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            )}
            <input
              className="input h-9"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <input
              className="input h-9"
              type="password"
              placeholder="Password (min. 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSetup ? "new-password" : "current-password"}
              minLength={8}
              required
            />
            <ErrorText error={mutation.error} />
            <button
              type="submit"
              className="btn-primary mt-1 h-9"
              disabled={mutation.isPending || (captchaEnabled && !captchaToken)}
            >
              {isSetup ? "Create workspace" : "Continue"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
