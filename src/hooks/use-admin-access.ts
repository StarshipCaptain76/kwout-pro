import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_EMAILS = new Set(["dawie@polka.co.za", "julius@polka.co.za"]);

export function isAdminEmail(email?: string | null) {
  return !!email && ADMIN_EMAILS.has(email.toLowerCase());
}

export function useAdminAccess(): { loading: boolean; isAdmin: boolean; email: string | null } {
  const [state, setState] = useState<{ loading: boolean; isAdmin: boolean; email: string | null }>({
    loading: true,
    isAdmin: false,
    email: null,
  });
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const email = data.user?.email ?? null;
      setState({ loading: false, isAdmin: isAdminEmail(email), email });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const email = session?.user.email ?? null;
      setState({ loading: false, isAdmin: isAdminEmail(email), email });
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return state;
}
