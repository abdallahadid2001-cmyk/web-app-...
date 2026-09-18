import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/owner/categories")({
  head: () => ({
    meta: [
      { title: "التصنيفات — نظام نقطة البيع" },
      { name: "description", content: "إدارة تصنيفات المنتجات للمالك." },
      { property: "og:title", content: "التصنيفات — نظام نقطة البيع" },
      { property: "og:description", content: "إدارة تصنيفات المنتجات للمالك." },
    ],
  }),
  component: CategoriesPage,
});

type Category = { id: string; name: string; active: boolean };

function CategoriesPage() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, active")
        .order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  const counts = useQuery({
    queryKey: ["category-product-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("category_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of data as { category_id: string | null }[]) {
        if (row.category_id) map[row.category_id] = (map[row.category_id] ?? 0) + 1;
      }
      return map;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const add = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("categories").insert({ name });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewName("");
      invalidate();
      toast.success("تمت إضافة التصنيف");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (vals: { id: string; name?: string; active?: boolean }) => {
      const { id, ...rest } = vals;
      const { error } = await supabase.from("categories").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingId(null);
      invalidate();
      toast.success("تم الحفظ");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="التصنيفات">
      <Link to="/owner" className="mb-4 inline-block text-sm text-primary">
        ← رجوع
      </Link>

      <form
        className="mb-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim()) add.mutate(newName.trim());
        }}
      >
        <Input
          className="h-12 text-base"
          placeholder="اسم التصنيف الجديد"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button type="submit" className="h-12 px-6" disabled={add.isPending}>
          إضافة
        </Button>
      </form>

      {categories.isLoading ? (
        <p className="text-muted-foreground">جارٍ التحميل…</p>
      ) : categories.data?.length === 0 ? (
        <p className="text-muted-foreground">لا توجد تصنيفات بعد.</p>
      ) : (
        <ul className="space-y-3">
          {categories.data?.map((c) => {
            const used = counts.data?.[c.id] ?? 0;
            return (
              <li
                key={c.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                {editingId === c.id ? (
                  <div className="flex gap-2">
                    <Input
                      className="h-12 text-base"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <Button
                      className="h-12"
                      onClick={() =>
                        editName.trim() &&
                        update.mutate({ id: c.id, name: editName.trim() })
                      }
                    >
                      حفظ
                    </Button>
                    <Button
                      variant="outline"
                      className="h-12"
                      onClick={() => setEditingId(null)}
                    >
                      إلغاء
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {used} منتج {c.active ? "" : "— معطّل"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="h-11"
                        onClick={() => {
                          setEditingId(c.id);
                          setEditName(c.name);
                        }}
                      >
                        تعديل
                      </Button>
                      <Button
                        variant={c.active ? "outline" : "default"}
                        className="h-11"
                        onClick={() => update.mutate({ id: c.id, active: !c.active })}
                      >
                        {c.active ? "تعطيل" : "تفعيل"}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-6 text-xs text-muted-foreground">
        لا يمكن حذف التصنيفات؛ التعطيل يخفيها من الاختيار دون التأثير على المنتجات
        المرتبطة بها.
      </p>
    </AppShell>
  );
}
