/**
 * Parses Vertex AI / Google Cloud errors and returns user-friendly messages.
 */
export function parseVertexErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (/SERVICE_DISABLED|has not been used in project.*before or it is disabled/i.test(raw)) {
    const projectMatch = raw.match(/project[=\s]+([a-z0-9-]+)/i);
    const project = projectMatch?.[1] || process.env.GOOGLE_CLOUD_PROJECT || "your-project";
    return `Vertex AI API is not enabled on project "${project}". Enable it at: https://console.cloud.google.com/apis/api/aiplatform.googleapis.com/overview?project=${project} — then wait a few minutes and retry.`;
  }

  if (/PERMISSION_DENIED|403/i.test(raw) && /aiplatform|vertexai/i.test(raw)) {
    return "Vertex AI permission denied. Check that the API is enabled and your credentials have Vertex AI User access.";
  }

  if (/Could not load the default credentials|GOOGLE_APPLICATION_CREDENTIALS/i.test(raw)) {
    return 'Google Cloud credentials not found. Run "gcloud auth application-default login" or set GOOGLE_APPLICATION_CREDENTIALS to a service account key.';
  }

  if (/UNAUTHENTICATED|invalid.*credentials/i.test(raw)) {
    return "Google Cloud authentication failed. Refresh credentials with: gcloud auth application-default login";
  }

  if (/quota|RESOURCE_EXHAUSTED/i.test(raw)) {
    return "Vertex AI quota exceeded. Wait a moment and try again, or check your GCP quota limits.";
  }

  const maxLen = 300;
  return raw.length > maxLen ? raw.slice(0, maxLen) + "…" : raw;
}
