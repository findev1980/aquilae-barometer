import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

// Module-level cache so the admin status cannot be manipulated per-component
let _adminStatus: boolean | null = null;
let _checkedUserId: string | null = null;
const _listeners = new Set<() => void>();

function notify() { _listeners.forEach((l) => l()); }
function subscribe(cb: () => void) { _listeners.add(cb); return () => { _listeners.delete(cb); }; }
function getSnapshot() { return _adminStatus; }

async function verifyAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { _adminStatus = false; _checkedUserId = null; notify(); return; }
  if (_checkedUserId === user.id && _adminStatus !== null) return; // already checked

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  _adminStatus = !!data;
  _checkedUserId = user.id;
  notify();
}

// Re-check on auth state change
supabase.auth.onAuthStateChange(() => {
  _adminStatus = null;
  _checkedUserId = null;
  notify();
  verifyAdmin();
});

// Initial check
verifyAdmin();

/**
 * Returns the server-verified admin status.
 * The value is stored in a module-level cache that cannot be
 * manipulated via React DevTools component state.
 */
export function useIsAdmin(): boolean | null {
  const status = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Trigger a re-verify if not yet checked (e.g. on first mount)
  useEffect(() => {
    if (status === null) verifyAdmin();
  }, [status]);

  return status;
}
