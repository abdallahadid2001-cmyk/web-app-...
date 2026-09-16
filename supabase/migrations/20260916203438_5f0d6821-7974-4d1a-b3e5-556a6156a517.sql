-- move role helpers out of the exposed API schema
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE ALL ON FUNCTION private.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(UUID, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_owner()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.has_role(auth.uid(), 'owner');
$$;
REVOKE ALL ON FUNCTION private.is_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_owner() TO authenticated, service_role;

-- repoint policies to the private helper
DROP POLICY profiles_select_self_or_owner ON public.profiles;
DROP POLICY profiles_owner_update ON public.profiles;
DROP POLICY user_roles_select ON public.user_roles;
DROP POLICY categories_owner_write ON public.categories;
DROP POLICY products_owner_insert ON public.products;
DROP POLICY products_owner_update ON public.products;
DROP POLICY products_owner_delete ON public.products;
DROP POLICY shifts_select ON public.shifts;
DROP POLICY shifts_update_owner ON public.shifts;
DROP POLICY sales_select ON public.sales;
DROP POLICY sale_items_select ON public.sale_items;
DROP POLICY stock_movements_select ON public.stock_movements;
DROP POLICY audit_select ON public.audit_log;

CREATE POLICY profiles_select_self_or_owner ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR private.is_owner());
CREATE POLICY profiles_owner_update ON public.profiles FOR UPDATE TO authenticated
  USING (private.is_owner()) WITH CHECK (private.is_owner());
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_owner());
CREATE POLICY categories_owner_write ON public.categories FOR ALL TO authenticated
  USING (private.is_owner()) WITH CHECK (private.is_owner());
CREATE POLICY products_owner_insert ON public.products FOR INSERT TO authenticated WITH CHECK (private.is_owner());
CREATE POLICY products_owner_update ON public.products FOR UPDATE TO authenticated
  USING (private.is_owner()) WITH CHECK (private.is_owner());
CREATE POLICY products_owner_delete ON public.products FOR DELETE TO authenticated USING (private.is_owner());
CREATE POLICY shifts_select ON public.shifts FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR private.is_owner());
CREATE POLICY shifts_update_owner ON public.shifts FOR UPDATE TO authenticated
  USING (private.is_owner()) WITH CHECK (private.is_owner());
CREATE POLICY sales_select ON public.sales FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR private.is_owner());
CREATE POLICY sale_items_select ON public.sale_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND (s.seller_id = auth.uid() OR private.is_owner())));
CREATE POLICY stock_movements_select ON public.stock_movements FOR SELECT TO authenticated
  USING (private.is_owner() OR user_id = auth.uid());
CREATE POLICY audit_select ON public.audit_log FOR SELECT TO authenticated
  USING (private.is_owner() OR user_id = auth.uid());

-- record_stock_movement uses private helper now
CREATE OR REPLACE FUNCTION public.record_stock_movement(
  _product_id UUID, _quantity NUMERIC, _movement_type public.movement_type, _note TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid(); _id UUID;
BEGIN
  IF NOT private.has_role(_uid,'owner') THEN RAISE EXCEPTION 'غير مصرح'; END IF;
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

-- drop now-unused public helpers
DROP FUNCTION IF EXISTS public.is_owner();
DROP FUNCTION IF EXISTS public.has_role(UUID, public.app_role);

-- internal trigger functions: not callable from clients
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_product_stock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_new_product_stock() FROM PUBLIC, anon, authenticated;

-- app RPCs: signed-in users only
REVOKE ALL ON FUNCTION public.start_shift(NUMERIC) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_shift(NUMERIC) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_sale(JSONB, public.payment_method) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_stock_movement(UUID, NUMERIC, public.movement_type, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_shift(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_shift(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_sale(JSONB, public.payment_method) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_stock_movement(UUID, NUMERIC, public.movement_type, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;