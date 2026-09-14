/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  readonly VITE_CLERK_FRONTEND_API_URL?: string;
  readonly VITE_CLERK_BACKEND_API_URL?: string;
  readonly VITE_CLERK_JWKS_PUBLIC_KEY?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_OPENROUTER_API_KEY?: string;
  readonly VITE_META_APP_ID?: string;
  readonly VITE_INSTAGRAM_ACCESS_TOKEN?: string;
  readonly VITE_INSTAGRAM_USER_ID?: string;
  readonly VITE_CLOUDINARY_URL?: string;
  readonly VITE_CLOUDINARY_CLOUD_NAME?: string;
  readonly VITE_CLOUDINARY_API_KEY?: string;
  readonly VITE_CLOUDINARY_API_SECRET?: string;
  readonly VITE_CLOUDINARY_UPLOAD_PRESET?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
