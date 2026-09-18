import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/owner/products")({
  head: () => ({
    meta: [
      { title: "المنتجات والمخزون — نظام نقطة البيع" },
      { name: "description", content: "إدارة المنتجات والأسعار وكميات المخزون." },
      { property: "og:title", content: "المنتجات والمخزون — نظام نقطة البيع" },
      { property: "og:description", content: "إدارة المنتجات والأسعار وكميات المخزون." },
    ],
  }),
  component: ProductsPage,
});

type Category = { id: string; name: string; active: boolean };
type Product = {
  id: string;
  name: string;
  barcode: string | null;
  category_id: string | null;
  selling_price: number;
  cost_price: number;
  stock_quantity: number;
  minimum_stock: number;
  active: boolean;
};

type FormState = {
  id: string | null;
  name: string;
  barcode: string;
  category_id: string;
  selling_price: string;
  cost_price: string;
  minimum_stock: string;
};

const emptyForm: FormState = {
  id: null,
  name: "",
  barcode: "",
  category_id: "",
  selling_price: "",
  cost_price: "",
  minimum_stock: "0",
};

function ProductsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [form, setForm] = useState<FormState | null>(null);
  const [stockFor, setStockFor] = useState<Product | null>(null);
  const [stockQty, setStockQty] = useState("");
  const [stockNote, setStockNote] = useState("");

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

  const products = useQuery({
    queryKey: ["products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, barcode, category_id, selling_price, cost_price, stock_quantity, minimum_stock, active",
        )
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["products"] });

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        name: f.name.trim(),
        barcode: f.barcode.trim() || null,
        category_id: f.category_id || null,
        selling_price: Number(f.selling_price || 0),
        cost_price: Number(f.cost_price || 0),
        minimum_stock: Number(f.minimum_stock || 0),
      };
      if (f.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setForm(null);
      refresh();
      toast.success("تم الحفظ");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (p: Product) => {
      const { error } = await supabase
        .from("products")
        .update({ active: !p.active })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("تم تحديث حالة المنتج");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addStock = useMutation({
    mutationFn: async (vals: { productId: string; qty: number; note: string }) => {
      const { error } = await supabase.rpc("record_stock_movement", {
        _product_id: vals.productId,
        _quantity: vals.qty,
        _movement_type: "purchase_in",
        _note: vals.note || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setStockFor(null);
      setStockQty("");
      setStockNote("");
      refresh();
      toast.success("تمت إضافة الكمية وتسجيل الحركة");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const categoryName = (id: string | null) =>
    categories.data?.find((c) => c.id === id)?.name ?? "بدون تصنيف";

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (products.data ?? []).filter((p) => {
      const matchTerm =
        !term ||
        p.name.toLowerCase().includes(term) ||
        (p.barcode ?? "").toLowerCase().includes(term);
      const matchCat =
        categoryFilter === "all" ||
        (categoryFilter === "none" ? !p.category_id : p.category_id === categoryFilter);
      return matchTerm && matchCat;
    });
  }, [products.data, search, categoryFilter]);

  const out = (products.data ?? []).filter((p) => p.active && p.stock_quantity <= 0);
  const low = (products.data ?? []).filter(
    (p) => p.active && p.stock_quantity > 0 && p.stock_quantity <= p.minimum_stock,
  );

  return (
    <AppShell title="المنتجات والمخزون">
      <Link to="/owner" className="mb-4 inline-block text-sm text-primary">
        ← رجوع
      </Link>

      {(out.length > 0 || low.length > 0) && (
        <div className="mb-5 space-y-2">
          {out.length > 0 && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-foreground">
              <span className="font-bold">نفد المخزون ({out.length}): </span>
              {out.map((p) => p.name).join("، ")}
            </div>
          )}
          {low.length > 0 && (
            <div className="rounded-xl border border-border bg-muted p-4 text-sm text-foreground">
              <span className="font-bold">وصل للحد الأدنى ({low.length}): </span>
              {low.map((p) => `${p.name} (${p.stock_quantity})`).join("، ")}
            </div>
          )}
        </div>
      )}

      <div className="mb-5 space-y-3">
        <Input
          className="h-12 text-base"
          placeholder="بحث بالاسم أو الباركود"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant={categoryFilter === "all" ? "default" : "outline"}
            className="h-11"
            onClick={() => setCategoryFilter("all")}
          >
            الكل
          </Button>
          {categories.data?.map((c) => (
            <Button
              key={c.id}
              variant={categoryFilter === c.id ? "default" : "outline"}
              className="h-11"
              onClick={() => setCategoryFilter(c.id)}
            >
              {c.name}
            </Button>
          ))}
          <Button
            variant={categoryFilter === "none" ? "default" : "outline"}
            className="h-11"
            onClick={() => setCategoryFilter("none")}
          >
            بدون تصنيف
          </Button>
        </div>
        <Button className="h-12 w-full text-base" onClick={() => setForm(emptyForm)}>
          + منتج جديد
        </Button>
      </div>

      {products.isLoading ? (
        <p className="text-muted-foreground">جارٍ التحميل…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">لا توجد منتجات مطابقة.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((p) => (
            <li key={p.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-base font-bold text-foreground">
                    {p.name}
                    {!p.active && (
                      <span className="mr-2 text-xs text-muted-foreground">(معطّل)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {categoryName(p.category_id)}
                    {p.barcode ? ` — ${p.barcode}` : ""}
                  </p>
                </div>
                <div className="text-left text-sm">
                  <p className="font-bold text-foreground">{p.selling_price} بيع</p>
                  <p className="text-muted-foreground">{p.cost_price} تكلفة</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-foreground">
                الرصيد: <span className="font-bold">{p.stock_quantity}</span> — الحد
                الأدنى: {p.minimum_stock}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={() =>
                    setForm({
                      id: p.id,
                      name: p.name,
                      barcode: p.barcode ?? "",
                      category_id: p.category_id ?? "",
                      selling_price: String(p.selling_price),
                      cost_price: String(p.cost_price),
                      minimum_stock: String(p.minimum_stock),
                    })
                  }
                >
                  تعديل
                </Button>
                <Button className="h-11" onClick={() => setStockFor(p)}>
                  إضافة كمية
                </Button>
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={() => toggleActive.mutate(p)}
                >
                  {p.active ? "تعطيل" : "تفعيل"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "تعديل منتج" : "منتج جديد"}</DialogTitle>
          </DialogHeader>
          {form && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.name.trim()) {
                  toast.error("اسم المنتج مطلوب");
                  return;
                }
                save.mutate(form);
              }}
            >
              <div>
                <Label>اسم المنتج</Label>
                <Input
                  className="mt-1 h-12 text-base"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label>الباركود (اختياري)</Label>
                <Input
                  className="mt-1 h-12 text-base"
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                />
              </div>
              <div>
                <Label>التصنيف</Label>
                <select
                  className="mt-1 h-12 w-full rounded-md border border-input bg-background px-3 text-base"
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                >
                  <option value="">بدون تصنيف</option>
                  {categories.data
                    ?.filter((c) => c.active || c.id === form.category_id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>سعر البيع</Label>
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    className="mt-1 h-12 text-base"
                    value={form.selling_price}
                    onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                  />
                </div>
                <div>
                  <Label>سعر التكلفة</Label>
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    className="mt-1 h-12 text-base"
                    value={form.cost_price}
                    onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>الحد الأدنى للمخزون</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  className="mt-1 h-12 text-base"
                  value={form.minimum_stock}
                  onChange={(e) => setForm({ ...form, minimum_stock: e.target.value })}
                />
              </div>
              {!form.id && (
                <p className="text-xs text-muted-foreground">
                  يُنشأ المنتج برصيد صفر؛ أضف الكمية بعد الحفظ من زر «إضافة كمية» لتُسجَّل
                  كحركة مخزون.
                </p>
              )}
              <Button type="submit" className="h-12 w-full text-base" disabled={save.isPending}>
                حفظ
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={stockFor !== null} onOpenChange={(o) => !o && setStockFor(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة كمية — {stockFor?.name}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const qty = Number(stockQty);
              if (!stockFor || !qty || qty <= 0) {
                toast.error("أدخل كمية أكبر من صفر");
                return;
              }
              addStock.mutate({ productId: stockFor.id, qty, note: stockNote.trim() });
            }}
          >
            <div>
              <Label>الكمية المضافة</Label>
              <Input
                type="number"
                inputMode="numeric"
                className="mt-1 h-12 text-base"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
              />
            </div>
            <div>
              <Label>ملاحظة (اختياري)</Label>
              <Input
                className="mt-1 h-12 text-base"
                value={stockNote}
                onChange={(e) => setStockNote(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              تُسجَّل الكمية كحركة مخزون من نوع «توريد» باسمك ووقتها.
            </p>
            <Button
              type="submit"
              className="h-12 w-full text-base"
              disabled={addStock.isPending}
            >
              تأكيد
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
