/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_RECAPTCHA_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
