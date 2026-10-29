import { normalizeWorkspace } from './library.js?v=5';

export class SyncConflict extends Error {
  constructor() { super('This workspace changed on another device. Choose which version to keep.'); this.name = 'SyncConflict'; }
}
export async function loadClient(config) {
  if (!config.supabaseUrl || !config.supabasePublishableKey) return null;
  if (!globalThis.supabase?.createClient) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('./vendor/supabase-2.118.0.js', import.meta.url).href;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load the sign-in service. Please reload.'));
      document.head.append(script);
    });
  }
  return globalThis.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'gradient.auth.v1' },
  });
}
export async function readCloud(client, userId) {
  const { data, error } = await client.from('gradient_workspaces').select('data,revision,updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? { data: normalizeWorkspace(data.data), revision: data.revision, updatedAt: data.updated_at } : null;
}
export async function writeCloud(client, userId, workspace, revision) {
  const payload = { user_id: userId, data: normalizeWorkspace(workspace), revision: (revision || 0) + 1 };
  const table = client.from('gradient_workspaces');
  const request = revision === null ? table.insert(payload) : table.update(payload).eq('user_id', userId).eq('revision', revision);
  const { data, error } = await request.select('revision,updated_at').maybeSingle();
  if (error?.code === '23505') throw new SyncConflict();
  if (error) throw error;
  if (!data) throw new SyncConflict();
  return { revision: data.revision, updatedAt: data.updated_at };
}
