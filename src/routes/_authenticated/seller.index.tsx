import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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

export const Route = createFileRoute("/_authenticated/seller/")({
  head: () => ({
    meta: [
      { title: "الوردية — نظام نقطة البيع" },
      { name: "description", content: "بدء الوردية ومتابعتها وإغلاقها وتسليم النقدية." },
      { property: "og:title", content: "الوردية — نظام نقطة البيع" },
      {
        property: "og:description",
        content: "بدء الوردية ومتابعتها وإغلاقها وتسليم النقدية.",
      },
    ],
  }),
  component: SellerHome,
});

type Shift = {
  id: string;
  opened_at: string;
  opening_cash: number;
  status: "open" | "closed";
};

type SaleRow = { total: number; payment_method: "cash" | "card" | "other"; sale_type: "sale" | "refund" };

const money = (n: number) => `${Number(n).toFixed(2)}`;

export function useOpenShift() {
  return useQuery({
    queryKey: ["open-shift"],
    queryFn: async (): Promise<Shift | null> => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, opened_at, opening_cash, status")
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as Shift) ?? null;
    },
  });
}

function SellerHome() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const shift = useOpenShift();
  const [openingCash, setOpeningCash] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);
  const [actualCash, setActualCash] = useState("");
  const [result, setResult] = useState<{ expected: number; actual: number; diff: number } | null>(
    null,
  );

  const sales = useQuery({
    queryKey: ["shift-sales", shift.data?.id],
    enabled: !!shift.data?.id,
    queryFn: async (): Promise<SaleRow[]> => {
      const { data, error } = await supabase
        .from("sales")
        .select("total, payment_method, sale_type")
        .eq("shift_id", shift.data!.id);
      if (error) throw error;
      return data as SaleRow[];
    },
  });

  const rows = sales.data ?? [];
  const sum = (m: SaleRow["payment_method"]) =>
    rows
      .filter((r) => r.payment_method === m)
      .reduce((t, r) => t + (r.sale_type === "refund" ? -Number(r.total) : Number(r.total)), 0);
  const cash = sum("cash");
  const card = sum("card");
  const other = sum("other");
  const expected = Number(shift.data?.opening_cash ?? 0) + cash;

  const start = useMutation({
    mutationFn: async (amount: number) => {
      const { error } = await supabase.rpc("start_shift", { _opening_cash: amount });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["open-shift"] });
      toast.success("تم بدء الوردية");
      navigate({ to: "/seller/pos" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const close = useMutation({
    mutationFn: async (amount: number) => {
      const { data, error } = await supabase.rpc("close_shift", { _actual_cash: amount });
      if (error) throw error;
      return data as unknown as {
        expected_cash: number;
        actual_cash: number;
        difference: number;
      };
    },
    onSuccess: async (d) => {
      setCloseOpen(false);
      setActualCash("");
      setResult({
        expected: Number(d.expected_cash),
        actual: Number(d.actual_cash),
        diff: Number(d.difference),
      });
      await qc.invalidateQueries({ queryKey: ["open-shift"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="الوردية" subtitle={user.email ?? ""}>
      {shift.isLoading ? (
        <p className="text-muted-foreground">جارٍ التحميل…</p>
      ) : !shift.data ? (
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-base text-foreground">لا توجد وردية مفتوحة حاليًا.</p>
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const amount = Number(openingCash);
              if (Number.isNaN(amount) || amount < 0) {
                toast.error("أدخل مبلغًا صحيحًا");
                return;
              }
              start.mutate(amount);
            }}
          >
            <div>
              <Label className="text-base">النقدية الافتتاحية</Label>
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                className="mt-1 h-14 text-lg"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="0"
              />
            </div>
            <Button type="submit" className="h-14 w-full text-lg" disabled={start.isPending}>
              بدء الوردية
            </Button>
          </form>
          {result && (
            <div className="mt-6 rounded-xl border border-border bg-muted p-4 text-sm">
              <p className="font-bold text-foreground">تم إغلاق الوردية السابقة</p>
              <p className="mt-1">المتوقع: {money(result.expected)}</p>
              <p>الفعلي: {money(result.actual)}</p>
              <p className="mt-1 font-bold">
                {result.diff === 0
                  ? "بدون فرق"
                  : result.diff < 0
                    ? `عجز ${money(Math.abs(result.diff))}`
                    : `زيادة ${money(result.diff)}`}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <Link
            to="/seller/pos"
            className="block rounded-2xl bg-primary p-6 text-center text-xl font-bold text-primary-foreground"
          >
            شاشة البيع
          </Link>

          <div className="rounded-2xl border border-border bg-card p-5 text-base">
            <p className="font-bold text-foreground">ملخص الوردية</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>النقدية الافتتاحية</dt>
                <dd className="font-bold">{money(Number(shift.data.opening_cash))}</dd>
              </div>
              <div className="flex justify-between">
                <dt>مبيعات كاش</dt>
                <dd className="font-bold">{money(cash)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>مبيعات بطاقة</dt>
                <dd>{money(card)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>مبيعات أخرى</dt>
                <dd>{money(other)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base">
                <dt className="font-bold">النقدية المتوقعة</dt>
                <dd className="font-bold">{money(expected)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              البطاقة والطرق الأخرى لا تدخل ضمن النقدية المتوقعة.
            </p>
          </div>

          <Button
            variant="outline"
            className="h-14 w-full text-lg"
            onClick={() => setCloseOpen(true)}
          >
            إغلاق الوردية
          </Button>
        </div>
      )}

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إغلاق الوردية</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 text-sm">
            <p>النقدية الافتتاحية: {money(Number(shift.data?.opening_cash ?? 0))}</p>
            <p>مبيعات كاش: {money(cash)}</p>
            <p>مبيعات بطاقة: {money(card)}</p>
            <p>مبيعات أخرى: {money(other)}</p>
            <p className="font-bold">النقدية المتوقعة: {money(expected)}</p>
          </div>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const amount = Number(actualCash);
              if (Number.isNaN(amount) || amount < 0) {
                toast.error("أدخل المبلغ الفعلي");
                return;
              }
              close.mutate(amount);
            }}
          >
            <div>
              <Label className="text-base">النقدية الفعلية في الصندوق</Label>
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                className="mt-1 h-14 text-lg"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
              />
            </div>
            {actualCash !== "" && !Number.isNaN(Number(actualCash)) && (
              <p className="text-sm font-bold">
                {Number(actualCash) - expected === 0
                  ? "بدون فرق"
                  : Number(actualCash) - expected < 0
                    ? `عجز ${money(expected - Number(actualCash))}`
                    : `زيادة ${money(Number(actualCash) - expected)}`}
              </p>
            )}
            <Button type="submit" className="h-14 w-full text-lg" disabled={close.isPending}>
              تأكيد الإغلاق
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
