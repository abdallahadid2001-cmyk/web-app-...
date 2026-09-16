-- ===== Enums =====
CREATE TYPE public.app_role AS ENUM ('owner','seller');
CREATE TYPE public.shift_status AS ENUM ('open','closed');
CREATE TYPE public.payment_method AS ENUM ('cash','card','other');
CREATE TYPE public.sale_type AS ENUM ('sale','refund');
CREATE TYPE public.movement_type AS ENUM ('purchase_in','sale_out','return_in','adjustment','waste');

-- ===== updated_at helper =====
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ===== profiles =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ===== user_roles =====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'owner');
$$;

-- ===== categories =====
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- ===== products =====
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  stock_quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  minimum_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- ===== shifts =====
CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_cash NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (opening_cash >= 0),
  expected_cash NUMERIC(12,2),
  actual_cash NUMERIC(12,2),
  difference NUMERIC(12,2),
  status public.shift_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_open_shift_per_seller ON public.shifts (seller_id) WHERE status = 'open';
GRANT SELECT, INSERT, UPDATE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- ===== sales =====
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  sale_type public.sale_type NOT NULL DEFAULT 'sale',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- ===== sale_items =====
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- ===== stock_movements =====
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity NUMERIC(12,3) NOT NULL,
  movement_type public.movement_type NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- ===== audit_log =====
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ===== updated_at triggers =====
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_shifts_updated BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== new user -> profile =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== guard: stock_quantity changes only via stock movements =====
CREATE OR REPLACE FUNCTION public.guard_product_stock()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity
     AND current_setting('app.stock_movement', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'لا يمكن تعديل الرصيد مباشرة بدون تسجيل حركة مخزون';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_guard_product_stock BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.guard_product_stock();

CREATE OR REPLACE FUNCTION public.guard_new_product_stock()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.stock_quantity <> 0 AND current_setting('app.stock_movement', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'المنتج الجديد يبدأ برصيد صفر؛ استخدم حركة مخزون لإضافة الكمية';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_guard_new_product_stock BEFORE INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.guard_new_product_stock();

-- ===== RLS policies =====
-- profiles
CREATE POLICY profiles_select_self_or_owner ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_owner());
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY profiles_owner_update ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- user_roles (read only; changes via service role / owner RPC)
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner());

-- categories
CREATE POLICY categories_select ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY categories_owner_write ON public.categories FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- products
CREATE POLICY products_select ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY products_owner_insert ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_owner());
CREATE POLICY products_owner_update ON public.products FOR UPDATE TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY products_owner_delete ON public.products FOR DELETE TO authenticated USING (public.is_owner());

-- shifts
CREATE POLICY shifts_select ON public.shifts FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR public.is_owner());
CREATE POLICY shifts_insert_self ON public.shifts FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid() AND status = 'open');
CREATE POLICY shifts_update_owner ON public.shifts FOR UPDATE TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- sales / sale_items / stock_movements: read only from client, writes via RPC
CREATE POLICY sales_select ON public.sales FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR public.is_owner());
CREATE POLICY sale_items_select ON public.sale_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND (s.seller_id = auth.uid() OR public.is_owner())));
CREATE POLICY stock_movements_select ON public.stock_movements FOR SELECT TO authenticated
  USING (public.is_owner() OR user_id = auth.uid());

-- audit_log
CREATE POLICY audit_select ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_owner() OR user_id = auth.uid());
CREATE POLICY audit_insert_self ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ===== RPCs =====
CREATE OR REPLACE FUNCTION public.start_shift(_opening_cash NUMERIC)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid(); _id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF EXISTS (SELECT 1 FROM public.shifts WHERE seller_id = _uid AND status = 'open') THEN
    RAISE EXCEPTION 'لديك وردية مفتوحة بالفعل';
  END IF;
  INSERT INTO public.shifts (seller_id, opening_cash) VALUES (_uid, COALESCE(_opening_cash,0)) RETURNING id INTO _id;
  INSERT INTO public.audit_log (user_id, action, entity, entity_id, details)
  VALUES (_uid, 'start_shift', 'shifts', _id, jsonb_build_object('opening_cash', COALESCE(_opening_cash,0)));
  RETURN _id;
END; $$;
REVOKE ALL ON FUNCTION public.start_shift(NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_shift(NUMERIC) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_sale(_items JSONB, _payment_method public.payment_method)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

    UPDATE public.products SET stock_quantity = stock_quantity - _qty WHERE id = _pid;
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
END; $$;
REVOKE ALL ON FUNCTION public.complete_sale(JSONB, public.payment_method) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_sale(JSONB, public.payment_method) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_shift(_actual_cash NUMERIC)
RETURNS public.shifts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid(); _s public.shifts; _cash_sales NUMERIC; _cash_refunds NUMERIC; _expected NUMERIC;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  SELECT * INTO _s FROM public.shifts WHERE seller_id = _uid AND status = 'open' FOR UPDATE;
  IF _s.id IS NULL THEN RAISE EXCEPTION 'لا توجد وردية مفتوحة'; END IF;

  SELECT COALESCE(SUM(total) FILTER (WHERE sale_type='sale'),0),
         COALESCE(SUM(total) FILTER (WHERE sale_type='refund'),0)
    INTO _cash_sales, _cash_refunds
    FROM public.sales WHERE shift_id = _s.id AND payment_method = 'cash';

  _expected := _s.opening_cash + _cash_sales - _cash_refunds;

  UPDATE public.shifts SET
    status='closed', closed_at=now(),
    expected_cash=_expected,
    actual_cash=COALESCE(_actual_cash,0),
    difference=COALESCE(_actual_cash,0) - _expected
  WHERE id=_s.id RETURNING * INTO _s;

  INSERT INTO public.audit_log (user_id, action, entity, entity_id, details)
  VALUES (_uid, 'close_shift', 'shifts', _s.id,
    jsonb_build_object('expected_cash', _s.expected_cash, 'actual_cash', _s.actual_cash, 'difference', _s.difference));
  RETURN _s;
END; $$;
REVOKE ALL ON FUNCTION public.close_shift(NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_shift(NUMERIC) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_stock_movement(
  _product_id UUID, _quantity NUMERIC, _movement_type public.movement_type, _note TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid(); _id UUID;
BEGIN
  IF NOT public.has_role(_uid,'owner') THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF _quantity = 0 THEN RAISE EXCEPTION 'الكمية لا يمكن أن تكون صفرًا'; END IF;
  PERFORM set_config('app.stock_movement','on',true);
  UPDATE public.products SET stock_quantity = stock_quantity + _quantity WHERE id = _product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'منتج غير موجود'; END IF;
  INSERT INTO public.stock_movements (product_id, quantity, movement_type, reference_type, user_id, note)
  VALUES (_product_id, _quantity, _movement_type, 'manual', _uid, _note) RETURNING id INTO _id;
  PERFORM set_config('app.stock_movement','off',true);
  INSERT INTO public.audit_log (user_id, action, entity, entity_id, details)
  VALUES (_uid, 'stock_movement', 'stock_movements', _id,
    jsonb_build_object('product_id', _product_id, 'quantity', _quantity, 'type', _movement_type));
  RETURN _id;
END; $$;
REVOKE ALL ON FUNCTION public.record_stock_movement(UUID, NUMERIC, public.movement_type, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_stock_movement(UUID, NUMERIC, public.movement_type, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;