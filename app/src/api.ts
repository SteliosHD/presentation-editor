// Calls to the local app's server (bin/presentation-viewer.ts). The hosted app has no server.
export const post = async (path: string, body: object = {}) => {
  const res = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { error?: string; folder?: string; file?: string; cancelled?: boolean };
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
};
