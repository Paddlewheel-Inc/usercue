import { CAPTCHA_ACTION_LABELS, CAPTCHA_ACTIONS, type CaptchaAction } from "@usercue/shared";
import { Checkbox, ErrorText } from "../../components/ui";
import { useSaveSettings, useSettings } from "../../lib/queries";

const HINTS: Record<CaptchaAction, string> = {
  posts: "Before someone shares a suggestion",
  comments: "Before someone leaves a comment or reply",
  login: "Before password sign-in or continuing with a connected account",
  setup: "Before creating the workspace or accepting a staff invitation",
};

function patchFor(action: CaptchaAction, value: boolean) {
  if (action === "posts") return { captchaPosts: value };
  if (action === "comments") return { captchaComments: value };
  if (action === "login") return { captchaLogin: value };
  return { captchaSetup: value };
}

export function CaptchaSettings() {
  const { data, isLoading } = useSettings();
  const save = useSaveSettings();

  if (isLoading || !data) return null;
  const captcha = data.captcha;

  return (
    <div className="flex flex-col gap-9">
      <section className="flex flex-col gap-2">
        <h2 className="text-[13px] font-medium">reCAPTCHA keys</h2>
        <p className="text-[12px] text-muted">
          Add <code>RECAPTCHA_SITE_KEY</code> and <code>RECAPTCHA_SECRET_KEY</code> to your server
          environment and restart. The site key is public; the secret key stays on the server and
          verifies every challenge. Turn on only the actions you want to protect.
        </p>
        {!captcha.configured && (
          <p className="text-[12px] text-amber-500">
            Captchas are off until both keys are set on the server.
          </p>
        )}
        {captcha.configured && (
          <p className="text-[12px] text-muted">Keys detected. Protection is ready to turn on.</p>
        )}
        <ErrorText error={save.error} />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-[13px] font-medium">Protected actions</h2>
          <p className="mt-1 text-[12px] text-muted">
            Someone has to solve a challenge before these actions go through. API keys are not
            challenged.
          </p>
        </div>
        {CAPTCHA_ACTIONS.map((action) => (
          <div key={action} className="flex flex-col gap-1">
            <Checkbox
              checked={captcha.actions[action]}
              disabled={save.isPending || !captcha.configured || captcha.fromEnv[action]}
              onChange={(value) => save.mutate(patchFor(action, value))}
            >
              {CAPTCHA_ACTION_LABELS[action]}
            </Checkbox>
            <p className="pl-7 text-[11px] text-faint">
              {captcha.fromEnv[action]
                ? "Turned on by RECAPTCHA_ACTIONS on the server and cannot be changed here."
                : HINTS[action]}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
