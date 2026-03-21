import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setIsAdmin(false); return; }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!cancelled) setIsAdmin(!!data);
    }

    check();
    return () => { cancelled = true; };
  }, []);

  return isAdmin;
}
