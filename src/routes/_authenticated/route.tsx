import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/" });
    const { data: role } = await supabase.rpc("current_user_role");
    return { user: data.user, role: (role as "owner" | "seller" | null) ?? null };
  },
  component: () => <Outlet />,
});
