ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS group_name TEXT,
  ADD COLUMN IF NOT EXISTS variant_label TEXT,
  ADD COLUMN IF NOT EXISTS pack_quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS pack_cost NUMERIC,
  ADD COLUMN IF NOT EXISTS sold_count NUMERIC NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.shortage_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL DEFAULT '',
  note TEXT,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.shortage_requests TO authenticated;
GRANT ALL ON public.shortage_requests TO service_role;

ALTER TABLE public.shortage_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shortage_insert_self" ON public.shortage_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "shortage_select" ON public.shortage_requests
  FOR SELECT TO authenticated USING (private.is_owner() OR user_id = auth.uid());
CREATE POLICY "shortage_owner_update" ON public.shortage_requests
  FOR UPDATE TO authenticated USING (private.is_owner()) WITH CHECK (private.is_owner());

CREATE TRIGGER update_shortage_requests_updated_at
  BEFORE UPDATE ON public.shortage_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.complete_sale(_items jsonb, _payment_method payment_method)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _shift UUID;
  _sale UUID;
  _item JSONB;
  _pid UUID; _qty NUMERIC; _price NUMERIC; _cost NUMERIC; _stock NUMERIC;
  _total NUMERIC := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  SELECT id INTO _shift FROM public.shifts WHERE seller_id = _uid AND status = 'open' FOR UPDATE;
  IF _shift IS NULL THEN RAISE EXCEPTION 'لا توجد وردية مفتوحة'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'السلة فارغة'; END IF;

  INSERT INTO public.sales (shift_id, seller_id, total, payment_method, sale_type)
  VALUES (_shift, _uid, 0, COALESCE(_payment_method,'cash'), 'sale') RETURNING id INTO _sale;

  PERFORM set_config('app.stock_movement','on',true);

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _pid := (_item->>'product_id')::UUID;
    _qty := (_item->>'quantity')::NUMERIC;
    IF _qty IS NULL OR _qty <= 0 THEN RAISE EXCEPTION 'كمية غير صالحة'; END IF;
    SELECT selling_price, cost_price, stock_quantity INTO _price, _cost, _stock
      FROM public.products WHERE id = _pid AND active FOR UPDATE;
    IF _price IS NULL THEN RAISE EXCEPTION 'منتج غير موجود'; END IF;
    IF _stock < _qty THEN RAISE EXCEPTION 'الكمية غير متوفرة في المخزون'; END IF;

    UPDATE public.products
      SET stock_quantity = stock_quantity - _qty,
          sold_count = sold_count + _qty
      WHERE id = _pid;
    INSERT INTO public.sale_items (sale_id, product_id, quantity, unit_price, unit_cost, line_total)
    VALUES (_sale, _pid, _qty, _price, _cost, _price * _qty);
    INSERT INTO public.stock_movements (product_id, quantity, movement_type, reference_type, reference_id, user_id)
    VALUES (_pid, -_qty, 'sale_out', 'sale', _sale, _uid);
    _total := _total + (_price * _qty);
  END LOOP;

  PERFORM set_config('app.stock_movement','off',true);

  UPDATE public.sales SET total = _total WHERE id = _sale;
  INSERT INTO public.audit_log (user_id, action, entity, entity_id, details)
  VALUES (_uid, 'sale', 'sales', _sale, jsonb_build_object('total', _total, 'payment_method', COALESCE(_payment_method,'cash')));
  RETURN _sale;
END; $function$;