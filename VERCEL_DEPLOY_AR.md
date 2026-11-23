# تشغيل NECKPHYSIOAI على Vercel (Frontend + Express API)

## أولًا: تحديث GitHub
استخدمي هذه النسخة بدل الملفات القديمة داخل مجلد مشروعك الحالي (مع الاحتفاظ بأي ملفات `.env` المحلية وعدم رفعها). بعد ذلك:

```powershell
git add api/index.ts vercel.json backend/src/db/pool.ts backend/src/routes/sessions.ts src/game/store.ts VERCEL_DEPLOY_AR.md
git commit -m "Deploy Express API on Vercel Functions"
git push origin main
```

**لو ملفاتك الحالية تحتوي تعديلات أخرى غير موجودة في هذا الـ ZIP، استخدمي الملفات الستة المعدّلة فقط بدل استبدال المشروع كله.**

## ثانيًا: متغيرات البيئة في Vercel
Project > Settings > Environment Variables. ضعي كل قيمة في Production، ثم **Redeploy** من Deployments إن كانت أضيفت بعد آخر نشر.

- `DATABASE_URL`: انسخي اتصال **Supabase Session Pooler** وليس رابط الـ Direct IPv6. تحققي من SSL حسب لوحة Supabase.
- `AUTH_SECRET`: سلسلة عشوائية طويلة وثابتة (مثل 64 رمزًا hex)، تبقى سرية تمامًا.
- `DOCTOR_EMAIL`: الإيميل الذي ستدخل به الدكتورة.
- `DOCTOR_PASSWORD`: كلمة مرور قوية من 12 حرفًا على الأقل.
- `DOCTOR_NAME`: الاسم الظاهر للدكتورة.
- `NODE_ENV`: `production`.
- `GEMINI_API_KEY`: اختياري، **لا تضيفيه** لو لا ترغبين في استدعاءات AI خارجية.
- `GOOGLE_CLIENT_ID`: اختياري لتسجيل الدخول باستخدام Google إذا أعددتِ Google OAuth origins للدومين المنشور.

**لا تكتبي بيانات الأسرار في GitHub أو Screenshots أو رسائل المحادثة.** ولا تستخدمي متغيرات تبدأ بـ `VITE_` للبيانات السرية.

## ثالثًا: الفحص بعد النشر
1. افتحي `https://neckphysioai.vercel.app/api/health`؛ عند نجاح الإعدادات وقاعدة البيانات يفترض أن يعرض `{"ok":true,"database":"up"}`.
2. افتحي نفس رابط الموقع وجربي تسجيل مريض ثم الدخول.
3. جربي حساب الدكتور وظهور المرضى وحفظ الجلسات واستبيان NDI.
4. إذا حدث خطأ اذهبي إلى Project > Logs (أو Function Logs) وشاركي سطر الخطأ **مع حذف أي مفاتيح أو بيانات حساسة**.

## ملاحظات مهمة
- إعدادات هذا المشروع تستهدف حساب **Vercel Hobby** للعرض غير التجاري ضمن الحدود المجانية؛ لا يوجد ضمان عدم تجاوز الحصص.
- وظائف Vercel لا تعمل كسيرفر دائم. عدّلنا إنشاء تقرير الجلسة حتى يكتمل داخل نفس طلب API بدل الاعتماد على طابور في ذاكرة السيرفر. قد يؤدي بطء Gemini أو انقطاع الشبكة إلى فشل تقرير AI مع بقاء الجلسة محفوظة.
- لا يمكن إثبات نجاح النشر أو ربط قاعدة Supabase من الملف وحده؛ يجب اختبار رابط `/api/health` وتسجيل الدخول فعليًا بعد رفع الكود.
