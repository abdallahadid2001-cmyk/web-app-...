import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/seller/pos")({
  head: () => ({
    meta: [
      { title: "شاشة البيع — نظام نقطة البيع" },
      { name: "description", content: "بيع سريع بالمنتجات والفئات السعرية وإتمام الفاتورة." },
      { property: "og:title", content: "شاشة البيع — نظام نقطة البيع" },
      {
        property: "og:description",
        content: "بيع سريع بالمنتجات والفئات السعرية وإتمام الفاتورة.",
      },
    ],
  }),
  component: PosPage,
});

type Category = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  barcode: string | null;
  category_id: string | null;
  selling_price: number;
  stock_quantity: number;
  group_name: string | null;
  variant_label: string | null;
  sold_count: number;
};
type CartLine = { id: string; name: string; price: number; qty: number; stock: number };

const money = (n: number) => Number(n).toFixed(2);
const variantName = (p: Product) => p.variant_label?.trim() || p.name;

function PosPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [groupOpen, setGroupOpen] = useState<string | null>(null);
  const [shortageOpen, setShortageOpen] = useState(false);
  const [shortageName, setShortageName] = useState("");
  const [shortageProductId, setShortageProductId] = useState<string | null>(null);
  const [shortageNote, setShortageNote] = useState("");

  const shift = useQuery({
    queryKey: ["open-shift"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, opening_cash")
        .eq("status", "open")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  const products = useQuery({
    queryKey: ["pos-products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, barcode, category_id, selling_price, stock_quantity, group_name, variant_label, sold_count",
        )
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (products.data ?? []).filter((p) => {
      const matchTerm =
        !term ||
        p.name.toLowerCase().includes(term) ||
        (p.group_name ?? "").toLowerCase().includes(term) ||
        (p.barcode ?? "").toLowerCase().includes(term);
      const matchCat = categoryFilter === "all" || p.category_id === categoryFilter;
      return matchTerm && matchCat;
    });
  }, [products.data, search, categoryFilter]);

  // tiles: grouped price variants collapse into one tile
  const tiles = useMemo(() => {
    const groups = new Map<string, Product[]>();
    const singles: Product[] = [];
    for (const p of filtered) {
      const g = p.group_name?.trim();
      if (g) {
        const list = groups.get(g) ?? [];
        list.push(p);
        groups.set(g, list);
      } else {
        singles.push(p);
      }
    }
    const grouped = [...groups.entries()].map(([name, items]) => ({
      kind: "group" as const,
      name,
      items: [...items].sort((a, b) => Number(b.sold_count) - Number(a.sold_count)),
    }));
    return [
      ...grouped,
      ...singles.map((p) => ({ kind: "single" as const, name: p.name, items: [p] })),
    ];
  }, [filtered]);

  const groupItems = useMemo(
    () => tiles.find((t) => t.kind === "group" && t.name === groupOpen)?.items ?? [],
    [tiles, groupOpen],
  );

  function addToCart(p: Product) {
    if (Number(p.stock_quantity) <= 0) {
      toast.error("الصنف غير متوفر");
      setShortageProductId(p.id);
      setShortageName(p.name);
      setShortageOpen(true);
      return;
    }
    setCart((prev) => {
      const line = prev.find((l) => l.id === p.id);
      if (!line) {
        return [
          ...prev,
          {
            id: p.id,
            name: variantName(p),
            price: Number(p.selling_price),
            qty: 1,
            stock: Number(p.stock_quantity),
          },
        ];
      }
      if (line.qty + 1 > line.stock) {
        toast.error(`المتاح في المخزون ${line.stock} فقط`);
        return prev;
      }
      return prev.map((l) => (l.id === p.id ? { ...l, qty: l.qty + 1 } : l));
    });
    setGroupOpen(null);
  }

  function changeQty(id: string, delta: number) {
    setCart((prev) =>
      prev.flatMap((l) => {
        if (l.id !== id) return [l];
        const next = l.qty + delta;
        if (next <= 0) return [];
        if (next > l.stock) {
          toast.error(`المتاح في المخزون ${l.stock} فقط`);
          return [l];
        }
        return [{ ...l, qty: next }];
      }),
    );
  }

  const total = cart.reduce((t, l) => t + l.price * l.qty, 0);

  const complete = useMutation({
    mutationFn: async (method: "cash" | "card" | "other") => {
      const { error } = await supabase.rpc("complete_sale", {
        _items: cart.map((l) => ({ product_id: l.id, quantity: l.qty })),
        _payment_method: method,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setCart([]);
      toast.success("تم إتمام البيع");
      await qc.invalidateQueries({ queryKey: ["pos-products"] });
      await qc.invalidateQueries({ queryKey: ["shift-sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const shortage = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shortage_requests").insert({
        product_id: shortageProductId,
        product_name: shortageName.trim(),
        note: shortageNote.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setShortageOpen(false);
      setShortageName("");
      setShortageNote("");
      setShortageProductId(null);
      toast.success("تم تسجيل الطلب الناقص");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (shift.isLoading) {
    return <p className="p-6 text-muted-foreground">جارٍ التحميل…</p>;
  }

  if (!shift.data) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-lg font-bold text-foreground">لا توجد وردية مفتوحة</p>
        <p className="mt-2 text-sm text-muted-foreground">ابدأ الوردية أولًا لتتمكن من البيع.</p>
        <Button className="mt-5 h-14 w-full text-lg" onClick={() => navigate({ to: "/seller" })}>
          الذهاب للوردية
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-64">
      <header className="sticky top-0 z-10 border-b border-border bg-card px-3 py-3">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <Link to="/seller" className="text-sm text-primary">
            ← الوردية
          </Link>
          <Input
            className="h-12 flex-1 text-base"
            placeholder="بحث سريع"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button
            variant="outline"
            className="h-12"
            onClick={() => {
              setShortageProductId(null);
              setShortageName("");
              setShortageOpen(true);
            }}
          >
            طلب ناقص
          </Button>
        </div>
        <div className="mx-auto mt-2 flex max-w-5xl gap-2 overflow-x-auto pb-1">
          <Button
            variant={categoryFilter === "all" ? "default" : "outline"}
            className="h-10 shrink-0"
            onClick={() => setCategoryFilter("all")}
          >
            الكل
          </Button>
          {categories.data?.map((c) => (
            <Button
              key={c.id}
              variant={categoryFilter === c.id ? "default" : "outline"}
              className="h-10 shrink-0"
              onClick={() => setCategoryFilter(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 py-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tiles.map((t) => {
            const single = t.kind === "single" ? t.items[0]! : null;
            const outOfStock = single ? Number(single.stock_quantity) <= 0 : t.items.every((i) => Number(i.stock_quantity) <= 0);
            return (
              <button
                key={`${t.kind}-${t.name}`}
                type="button"
                onClick={() => (single ? addToCart(single) : setGroupOpen(t.name))}
                className={`flex min-h-24 flex-col justify-between rounded-2xl border p-3 text-right ${
                  outOfStock
                    ? "border-destructive/40 bg-destructive/10"
                    : "border-border bg-card"
                }`}
              >
                <span className="text-base font-bold text-foreground">{t.name}</span>
                {single ? (
                  <span className="text-sm text-muted-foreground">
                    {money(single.selling_price)} — رصيد {Number(single.stock_quantity)}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {t.items.length} فئات سعرية
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {tiles.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">لا توجد منتجات مطابقة.</p>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card">
        <div className="mx-auto max-w-5xl px-3 py-3">
          <div className="max-h-44 space-y-2 overflow-y-auto">
            {cart.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">السلة فارغة</p>
            ) : (
              cart.map((l) => (
                <div key={l.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 font-bold text-foreground">{l.name}</span>
                  <span className="text-muted-foreground">{money(l.price)}</span>
                  <Button
                    variant="outline"
                    className="h-9 w-9 p-0 text-lg"
                    onClick={() => changeQty(l.id, -1)}
                  >
                    −
                  </Button>
                  <span className="w-8 text-center font-bold">{l.qty}</span>
                  <Button
                    variant="outline"
                    className="h-9 w-9 p-0 text-lg"
                    onClick={() => changeQty(l.id, 1)}
                  >
                    +
                  </Button>
                  <span className="w-16 text-left font-bold">{money(l.price * l.qty)}</span>
                  <Button
                    variant="ghost"
                    className="h-9 px-2 text-destructive"
                    onClick={() => setCart((prev) => prev.filter((x) => x.id !== l.id))}
                  >
                    حذف
                  </Button>
                </div>
              ))
            )}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <span className="text-base font-bold text-foreground">الإجمالي</span>
            <span className="text-2xl font-bold text-foreground">{money(total)}</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(
              [
                ["cash", "كاش"],
                ["card", "بطاقة"],
                ["other", "أخرى"],
              ] as const
            ).map(([m, label]) => (
              <Button
                key={m}
                className="h-14 text-base"
                disabled={cart.length === 0 || complete.isPending}
                onClick={() => complete.mutate(m)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={groupOpen !== null} onOpenChange={(o) => !o && setGroupOpen(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{groupOpen} — اختر الفئة السعرية</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {groupItems.map((p) => {
              const outOfStock = Number(p.stock_quantity) <= 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  className={`flex w-full items-center justify-between rounded-xl border p-4 text-right ${
                    outOfStock ? "border-destructive/40 bg-destructive/10" : "border-border bg-card"
                  }`}
                >
                  <span className="text-base font-bold text-foreground">{variantName(p)}</span>
                  <span className="text-sm text-muted-foreground">
                    {money(p.selling_price)} — رصيد {Number(p.stock_quantity)}
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shortageOpen} onOpenChange={setShortageOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تسجيل طلب ناقص</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!shortageName.trim()) {
                toast.error("اكتب اسم الصنف المطلوب");
                return;
              }
              shortage.mutate();
            }}
          >
            <div>
              <Label>اسم الصنف المطلوب</Label>
              <Input
                className="mt-1 h-12 text-base"
                value={shortageName}
                onChange={(e) => setShortageName(e.target.value)}
              />
            </div>
            <div>
              <Label>ملاحظة (اختياري)</Label>
              <Input
                className="mt-1 h-12 text-base"
                value={shortageNote}
                onChange={(e) => setShortageNote(e.target.value)}
              />
            </div>
            <Button type="submit" className="h-12 w-full text-base" disabled={shortage.isPending}>
              تسجيل
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
