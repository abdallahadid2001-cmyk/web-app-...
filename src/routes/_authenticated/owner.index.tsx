import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/owner/")({
  head: () => ({
    meta: [
      { title: "لوحة المالك — نظام نقطة البيع" },
      { name: "description", content: "إدارة المنتجات والتصنيفات والمخزون." },
      { property: "og:title", content: "لوحة المالك — نظام نقطة البيع" },
      { property: "og:description", content: "إدارة المنتجات والتصنيفات والمخزون." },
    ],
  }),
  component: OwnerHome,
});

function OwnerHome() {
  const { user } = Route.useRouteContext();

  return (
    <AppShell title="صفحة المالك" subtitle={user.email ?? ""}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/owner/products"
          className="rounded-2xl border border-border bg-card p-6 text-lg font-bold text-foreground"
        >
          المنتجات والمخزون
          <p className="mt-2 text-sm font-normal text-muted-foreground">
            إضافة وتعديل المنتجات والأسعار وإدخال كميات جديدة.
          </p>
        </Link>
        <Link
          to="/owner/categories"
          className="rounded-2xl border border-border bg-card p-6 text-lg font-bold text-foreground"
        >
          التصنيفات
          <p className="mt-2 text-sm font-normal text-muted-foreground">
            إضافة التصنيفات وتعديل أسمائها وتفعيلها أو تعطيلها.
          </p>
        </Link>
      </div>
    </AppShell>
  );
}
