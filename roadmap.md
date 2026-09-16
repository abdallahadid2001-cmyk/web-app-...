# خطة التنفيذ

## المرحلة 1 — Foundation (الحالية)
- [ ] تفعيل تسجيل الدخول بالبريد وكلمة المرور
- [ ] الجداول: profiles, user_roles, categories, products, shifts, sales, sale_items, stock_movements, audit_log
- [ ] صلاحيات RLS حقيقية (Owner / Seller)
- [ ] قواعد: وردية مفتوحة واحدة، لا بيع بدون وردية، لا تغيير مخزون بدون حركة، لا حذف
- [ ] حسابان تجريبيان: owner@test.com / seller@test.com
- [ ] صفحة Login + صفحة Owner بسيطة + صفحة Seller بسيطة

## مراحل لاحقة (لا تُنفذ الآن)
POS كامل، لوحة المالك، المشتريات، المرتجعات، التقارير، سجل العمليات في الواجهة.
