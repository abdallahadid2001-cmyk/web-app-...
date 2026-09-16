import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — نظام نقطة البيع" },
      {
        name: "description",
        content: "سجّل دخولك لإدارة المبيعات والمخزون والورديات في محلك.",
      },
      { property: "og:title", content: "تسجيل الدخول — نظام نقطة البيع" },
      {
        property: "og:description",
        content: "سجّل دخولك لإدارة المبيعات والمخزون والورديات في محلك.",
      },
    ],
  }),
  component: LoginPage,
});

async function routeByRole(navigate: (opts: { to: string; replace?: boolean }) => void) {
  const { data } = await supabase.rpc("current_user_role");
  navigate({ to: data === "owner" ? "/owner" : "/seller", replace: true });
}

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void routeByRole(navigate);
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError("بيانات الدخول غير صحيحة");
      setLoading(false);
      return;
    }
    await routeByRole(navigate);
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-sm">
        <h1 className="text-center text-2xl font-bold text-foreground">نظام نقطة البيع</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          سجّل الدخول للمتابعة
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-base">البريد الإلكتروني</Label>
            <Input
              id="email"
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-14 text-base"
              placeholder="owner@test.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-base">كلمة المرور</Label>
            <Input
              id="password"
              type="password"
              required
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-14 text-base"
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={loading} className="h-14 w-full text-lg">
            {loading ? "جارٍ الدخول..." : "دخول"}
          </Button>
        </form>
      </div>
    </main>
  );
}
