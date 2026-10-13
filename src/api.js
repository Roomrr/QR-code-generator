export const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export async function api(path, options = {}) {
  const res = await fetch(`${apiBase}/api${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (res.status === 204) return null;
  const content = await res.json().catch(() => ({
    error: "The API is unreachable. Check your server configuration.",
  }));
  if (!res.ok) {
    const error = new Error(content.error || "Request failed.");
    error.status = res.status;
    error.code = content.code;
    throw error;
  }
  return content;
}
export function saveJSON(data, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
