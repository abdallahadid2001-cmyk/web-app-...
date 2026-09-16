import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/seller")({
  head: () => ({
    meta: [
      { title: "صفحة البائع — نظام نقطة البيع" },
      { name: "description", content: "صفحة البائع لإدارة الوردية والبيع." },
      { property: "og:title", content: "صفحة البائع — نظام نقطة البيع" },
      { property: "og:description", content: "صفحة البائع لإدارة الوردية والبيع." },
    ],
  }),
  component: SellerPage,
});

function SellerPage() {
  const { user, role } = Route.useRouteContext();

  return (
    <AppShell title="صفحة البائع" subtitle={user.email ?? ""}>
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-base text-foreground">
          مرحبًا، أنت مسجّل الدخول بصلاحية{" "}
          <span className="font-bold">{role === "seller" ? "بائع" : "غير محددة"}</span>.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          في المرحلة التالية ستتمكن من بدء الوردية والبيع وإنهاء الوردية من هنا.
        </p>
      </div>
    </AppShell>
  );
}
