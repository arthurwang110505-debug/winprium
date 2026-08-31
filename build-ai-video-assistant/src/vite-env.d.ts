/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGNES_API_KEY?: string;
  readonly VITE_AGNES_BASE_URL?: string;
  readonly VITE_AGNES_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
