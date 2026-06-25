import { readPostHogPublicEnv } from "@/lib/posthog/config";

export function PostHogConfigScript() {
  const config = readPostHogPublicEnv();
  if (!config) return null;

  const payload = JSON.stringify(config);
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__TERABITS_POSTHOG__=${payload}`,
      }}
    />
  );
}
