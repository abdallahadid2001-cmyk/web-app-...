import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/owner")({
  head: () => ({
    meta: [
      { title: "لوحة المالك — نظام نقطة البيع" },
      { name: "description", content: "صفحة المالك لإدارة النظام." },
      { property: "og:title", content: "لوحة المالك — نظام نقطة البيع" },
      { property: "og:description", content: "صفحة المالك لإدارة النظام." },
    ],
  }),
  component: OwnerPage,
});

function OwnerPage() {
  const { user, role } = Route.useRouteContext();

  return (
    <AppShell title="صفحة المالك" subtitle={user.email ?? ""}>
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-base text-foreground">
          مرحبًا، أنت مسجّل الدخول بصلاحية{" "}
          <span className="font-bold">{role === "owner" ? "مالك" : "غير محددة"}</span>.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          تم تجهيز الأساس فقط في هذه المرحلة: الحسابات والأدوار وقاعدة البيانات وقواعد
          الوصول. شاشة البيع والتقارير تأتي في المرحلة التالية.
        </p>
      </div>
    </AppShell>
  );
}
