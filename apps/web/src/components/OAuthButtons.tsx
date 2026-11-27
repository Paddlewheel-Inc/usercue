import type { AuthProviderId } from "@usercue/shared";
import { useState } from "react";
import { useAuthMethods } from "../lib/queries";
import { Captcha, useCaptcha } from "./Captcha";
import { Discord, GitHub, Google } from "./icons";

const ICONS = {
  github: GitHub,
  discord: Discord,
  google: Google,
} as const;

const MARKS: Partial<Record<AuthProviderId, string>> = {
  roblox: "/roblox.svg",
  azure: "/azure.svg",
};

export function ProviderIcon({
  id,
  className,
}: {
  id: AuthProviderId | string;
  className?: string;
}) {
  const src = MARKS[id as AuthProviderId];
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`size-3.5 ${id === "roblox" ? "roblox-mark" : ""} ${className ?? ""}`}
      />
    );
  }
  const Icon = ICONS[id as keyof typeof ICONS] ?? GitHub;
  return <Icon className={className} />;
}

export function OAuthButtons({
  next,
  className = "btn-ghost h-9 w-full",
  captchaToken,
}: {
  next: "admin" | "board";
  className?: string;
  captchaToken?: string | null;
}) {
  const { data } = useAuthMethods();
  const { enabled } = useCaptcha("login");
  const [ownToken, setOwnToken] = useState<string | null>(null);
  if (!data?.providers.length) return null;

  const token = captchaToken === undefined ? ownToken : captchaToken;
  const needsCaptcha = enabled && !token;

  return (
    <div className="flex flex-col gap-2">
      {enabled && captchaToken === undefined && <Captcha action="login" onVerify={setOwnToken} />}
      {needsCaptcha && captchaToken === undefined && (
        <p className="text-center text-[11px] text-muted">
          Complete the captcha to continue with a connected account.
        </p>
      )}
      {data.providers.map((provider) => (
        <a
          key={provider.id}
          href={`/api/auth/oauth/${provider.id}?next=${next}${enabled && token ? `&captcha=${encodeURIComponent(token)}` : ""}`}
          aria-disabled={needsCaptcha}
          onClick={(event) => {
            if (needsCaptcha) event.preventDefault();
          }}
          className={`${className} ${needsCaptcha ? "pointer-events-none opacity-50" : ""}`}
        >
          <ProviderIcon id={provider.id} />
          Continue with {provider.label}
        </a>
      ))}
    </div>
  );
}
