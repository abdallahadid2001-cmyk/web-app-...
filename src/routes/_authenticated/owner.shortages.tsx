import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/owner/shortages")({
  head: () => ({
    meta: [
      { title: "الطلبات الناقصة — نظام نقطة البيع" },
      { name: "description", content: "الأصناف التي طلبها الزبائن ولم تكن متوفرة." },
      { property: "og:title", content: "الطلبات الناقصة — نظام نقطة البيع" },
      { property: "og:description", content: "الأصناف التي طلبها الزبائن ولم تكن متوفرة." },
    ],
  }),
  component: ShortagesPage,
});

type Shortage = {
  id: string;
  product_name: string;
  note: string | null;
  resolved: boolean;
  created_at: string;
};

function ShortagesPage() {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["shortages"],
    queryFn: async (): Promise<Shortage[]> => {
      const { data, error } = await supabase
        .from("shortage_requests")
        .select("id, product_name, note, resolved, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Shortage[];
    },
  });

  const resolve = useMutation({
    mutationFn: async (s: Shortage) => {
      const { error } = await supabase
        .from("shortage_requests")
        .update({ resolved: !s.resolved })
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shortages"] });
      toast.success("تم التحديث");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = list.data ?? [];
  const counts = new Map<string, number>();
  for (const r of rows.filter((r) => !r.resolved)) {
    const key = r.product_name.trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return (
    <AppShell title="الطلبات الناقصة">
      <Link to="/owner" className="mb-4 inline-block text-sm text-primary">
        ← رجوع
      </Link>

      {counts.size > 0 && (
        <div className="mb-5 rounded-xl border border-border bg-muted p-4 text-sm">
          <p className="font-bold text-foreground">الأكثر طلبًا وغير متوفر</p>
          <p className="mt-1">
            {[...counts.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([n, c]) => `${n} (${c})`)
              .join("، ")}
          </p>
        </div>
      )}

      {list.isLoading ? (
        <p className="text-muted-foreground">جارٍ التحميل…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">لا توجد طلبات ناقصة.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-foreground">
                    {r.product_name}
                    {r.resolved && (
                      <span className="mr-2 text-xs text-muted-foreground">(تمت المعالجة)</span>
                    )}
                  </p>
                  {r.note && <p className="text-sm text-muted-foreground">{r.note}</p>}
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("ar-EG")}
                  </p>
                </div>
                <Button variant="outline" className="h-11" onClick={() => resolve.mutate(r)}>
                  {r.resolved ? "إعادة فتح" : "تمت المعالجة"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
