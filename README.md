# أريد بناء تطبيق Web App سريع لإدارة المبيعات والمخزون والورديات لمحلات التجزئة الصغيرة مثل...

أريد بناء تطبيق Web App سريع لإدارة المبيعات والمخزون والورديات لمحلات التجزئة الصغيرة مثل البقالة والكافيهات الصغيرة ومحلات المأكولات الخفيفة.

1. الهدف الأساسي

النظام مصمم حول 3 أولويات:

سرعة البيع وعدم تعطيل العميل.

تحميل كل بائع مسؤولية ورديته بشكل واضح.

إعطاء المالك رقابة لحظية على النقدية والمخزون والمبيعات وتقليل فرص السرقة أو التلاعب.

لا أريد نظام POS معقدًا مليئًا بالخطوات. يجب أن تكون عملية البيع اليومية أسرع ما يمكن.



2. المستخدمون والصلاحيات

يوجد نوعان أساسيان من المستخدمين:

Owner / Admin

يمتلك صلاحية:

إدارة المنتجات.

إدارة الأسعار.

إدارة المخزون.

تسجيل المشتريات والوارد.

إنشاء وإدارة البائعين.

فتح/إغلاق ومراجعة الورديات.

مشاهدة جميع المبيعات.

مشاهدة تقارير الأرباح.

مراجعة العجز والزيادة.

إجراء تعديلات إدارية موثقة.

مشاهدة سجل العمليات Audit Log.

Seller / Cashier

صلاحياته محدودة بـ:

تسجيل الدخول.

بدء ورديته.

إجراء المبيعات.

مشاهدة المنتجات والأسعار المسموح بها.

تسجيل المرتجعات فقط وفق القواعد المحددة.

إنهاء ورديته.

مشاهدة بيانات ورديته الحالية.

لا يستطيع البائع:

تعديل أسعار المنتجات.

حذف مبيعات قديمة.

تعديل وردية بائع آخر.

تعديل المخزون يدويًا.

حذف سجل العمليات.

تغيير بيانات التقفيل بعد اعتماده.



3. Fast POS

هذه أهم شاشة في التطبيق.

أريد تصميم POS Mobile/Tablet/Desktop سريع جدًا.

الواجهة

استخدم:

Quick Select Grid للمنتجات الأكثر مبيعًا.

بحث سريع عن المنتج.

تصنيفات واضحة.

أزرار كبيرة مناسبة للمس.

Cart واضحة.

إجمالي الفاتورة ظاهر دائمًا.

أمثلة:

مياه.

مشروبات غازية.

عصائر.

شيبسي.

بسكويت.

شوكولاتة.

سندوتشات.

شاي.

قهوة.

أي منتجات يضيفها المالك.

عملية البيع

يجب أن تكون:

اختيار المنتج → تحديد الكمية عند الحاجة → الدفع → إتمام البيع.

قلل عدد النقرات لأقصى درجة ممكنة.

بعد إتمام البيع:

يتم تسجيل Sale.

يتم خصم الكمية من المخزون.

يتم ربط البيع بالـSeller.

يتم ربط البيع بالـShift.

يتم تسجيل وقت العملية.

لا يتم حذف العملية من قاعدة البيانات.



4. طرق الدفع

ابدأ بدعم:

Cash

Card

Other

ويجب تسجيل طريقة الدفع مع كل Sale.

في حالة Cash:
يجب أن يؤثر البيع على النقدية المتوقعة في الصندوق.



5. نظام الورديات

كل عملية بيع يجب أن تكون مرتبطة بـShift محددة.

عند بداية الوردية:

Seller Login
→ Start Shift
→ إدخال Opening Cash

يتم إنشاء:

Shift:

seller_id

opened_at

opening_cash

status = open

ولا يمكن للبائع إنشاء أكثر من وردية مفتوحة في نفس الوقت.



6. مسؤولية البائع

البائع مسؤول عن العمليات التي تمت أثناء ورديته.

لا يستطيع الوصول إلى:

مبيعات ورديات أخرى.

تعديل عمليات قديمة.

إغلاق وردية بائع آخر.

لكن الـOwner يستطيع رؤية ومراجعة جميع الورديات.



7. إغلاق الوردية

عند الضغط على Close Shift يقوم النظام تلقائيًا بحساب:

Opening Cash




+




Cash Sales

Cash Refunds

Expected Cash

ثم يطلب من البائع إدخال:

Actual Cash

ويحسب:

Difference = Actual Cash - Expected Cash

النتيجة تكون:

0 = لا يوجد فرق.

رقم سالب = Shortage.

رقم موجب = Over.

يجب حفظ نتيجة التقفيل بشكل دائم.



8. منع التلاعب في التقفيل

بعد إغلاق الوردية:

لا يستطيع Seller تعديل Actual Cash.

لا يستطيع تعديل Expected Cash.

لا يستطيع تعديل المبيعات السابقة.

لا يستطيع حذف الوردية.

أي تعديل إداري لاحق يجب أن يكون بصلاحية Owner ويتم تسجيله في Audit Log مع:

من قام بالتعديل.

وقت التعديل.

القيمة القديمة.

القيمة الجديدة.

سبب التعديل.



9. إدارة المخزون

كل منتج يجب أن يحتوي على الأقل على:

name

SKU / barcode

category

selling_price

cost_price

stock_quantity

minimum_stock

active

عند بيع منتج:

stock_quantity -= sold_quantity

ويتم إنشاء Stock Movement يسجل:

product

quantity

movement type

reference

user

timestamp

أنواع الحركة:

Purchase / In

Sale / Out

Return

Adjustment

Waste / Damaged

لا أريد تعديل stock_quantity بشكل صامت بدون تسجيل حركة.



10. المشتريات

يستطيع Owner تسجيل دخول بضاعة جديدة.

مثال:

منتج:
Pepsi Can

Quantity:
50

Cost:
15

عند الحفظ:

يزيد المخزون.

يتم تسجيل Stock Movement.

يتم حفظ تكلفة الشراء.

يمكن استخدام التكلفة لحساب الربح.



11. الربح

يجب الفصل بين:

Sales Revenue
و
Cost of Goods Sold
و
Gross Profit

بشكل أساسي:

Gross Profit =
Sales Revenue - Cost of Goods Sold

لا تعتبر المبيعات نفسها أرباحًا.



12. الرقابة على المخزون

يجب أن يستطيع Owner معرفة:

كمية المخزون الحالية.

المنتجات التي قاربت على النفاد.

المنتجات التي نفدت.

حركة كل منتج.

الكمية المباعة.

الكمية المضافة.

المرتجعات.

التعديلات.

الهالك.

يجب أن يكون لكل حركة مصدر واضح.



13. Dashboard للمالك

اعرض Dashboard بسيطة وسريعة تحتوي على:

Today

Total Sales

Cash Sales

Card Sales

Gross Profit

Number of Transactions

Open Shifts

Shortage / Over

Low Stock Products

Sales by Seller

لكل بائع:

Total Sales

Cash Sales

Number of Transactions

Shift Difference

Inventory

Current Stock

Low Stock

Out of Stock



14. التقارير

يجب توفير تقارير على الأقل لـ:

Sales Report

التاريخ

البائع

الوردية

المنتج

الكمية

السعر

طريقة الدفع

الإجمالي

Shift Report

البائع

وقت البداية

وقت النهاية

Opening Cash

Cash Sales

Expected Cash

Actual Cash

Difference

Inventory Report

المنتج

الرصيد الحالي

الوارد

الصادر

المرتجع

التعديلات

Profit Report

Revenue

COGS

Gross Profit



15. Audit Log

أي عملية حساسة يجب تسجيلها.

أمثلة:

Login

Start Shift

Sale

Refund

Close Shift

Product Creation

Price Change

Stock Adjustment

Purchase

Administrative Edit

Audit Log يجب أن يحتوي على:

user

action

entity

entity_id

timestamp

metadata/details

لا يتم حذف الـAudit Log من واجهة المستخدم.



16. قواعد مهمة جدًا

لا تعتمد على إخفاء الأزرار في Frontend فقط لحماية النظام.

الصلاحيات وقواعد الوصول يجب أن يتم فرضها من Backend/Database.

إذا تم استخدام Supabase:

استخدم:

Supabase Auth

PostgreSQL

Row Level Security

Database Functions/RPC عند الحاجة

يجب أن تكون عمليات مثل إتمام البيع وإغلاق الوردية وتحديث المخزون Atomic قدر الإمكان، حتى لا يحدث تضارب أو خصم خاطئ من المخزون.



17. التصميم

التطبيق:

Arabic RTL.

Mobile-first.

مناسب جدًا للـTablet.

يعمل جيدًا على Desktop.

واجهة بسيطة جدًا.

أزرار كبيرة.

أقل عدد ممكن من الخطوات.

لا تستخدم Animations ثقيلة.

لا تجعل الـDashboard أهم من شاشة البيع.

أهم شاشة هي POS.



18. MVP

لا تبدأ ببناء عشرات الخصائص.

ابدأ بالـCore Flow التالي:

Owner Login
→ Products
→ Inventory
→ Create Seller
→ Seller Login
→ Start Shift
→ POS
→ Complete Sale
→ Stock Deduction
→ Close Shift
→ Cash Reconciliation
→ Owner Dashboard

بعد التأكد أن هذا الـFlow يعمل بالكامل، يمكن إضافة الخصائص الثانوية.



19. قبل التنفيذ

قبل كتابة كمية كبيرة من الكود:

افحص المشروع الحالي إن كان هناك كود موجود.

لا تنشئ جداول أو Features مكررة.

لا تستخدم Mock Data كبديل عن Backend حقيقي.

لا تدّعِ أن RLS أو Authentication يعملان إلا إذا تم تنفيذهما فعليًا.

حافظ على Architecture قابلة للتوسع.

اجعل GitHub هو مصدر الكود الأساسي.

لا تربط المشروع بخدمة Cloud مغلقة إذا كان يمكن تجنب ذلك.

لا تضف AI؛ النظام المطلوب Rule-based وليس AI-based.

قبل التنفيذ الفعلي، اعرض لي باختصار:

Architecture المقترحة.

Database Tables.

العلاقات بينها.

أهم Business Rules.

صلاحيات كل Role.

ترتيب تنفيذ الـMVP.

ثم ابدأ التنفيذ على مراحل صغيرة، وبعد كل مرحلة تأكد أن الـFlow السابق لم ينكسر.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1f454296-3d0b-4cf2-9bb0-e59b6625f356).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
