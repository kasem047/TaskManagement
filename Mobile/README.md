# TaskManagement Mobile

تطبيق موبايل (Expo + React Native) لنفس نظام إدارة المهام، ويتصل بنفس ASP.NET Core API المستخدم في موقع Angular.

يعمل أولًا في **المتصفح** بدون Android Studio.

## التشغيل

1. شغّل الـ API (يفضّل بروفايل https حتى يبقى `http://localhost:5056` متاحًا).
2. من مجلد `Mobile`:

```bash
npm install
npm run web
```

3. افتح العنوان الذي يظهره Expo، عادة `http://localhost:8081` أو `http://localhost:8082`.

عنوان الـ API الافتراضي موجود في `.env`:

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:5056
```

إذا كان الخادم على منفذ آخر، غيّر القيمة ثم أعد تشغيل `npm run web`.

## ملاحظات

- الموقع Angular يبقى على `http://localhost:4200`.
- التطبيق لا يعيد بناء الباكند؛ الصلاحيات من الـ API.
- Android Studio غير مطلوب للتطوير عبر الويب.
- لاحقًا يمكن تجربة الهاتف عبر Expo Go دون استوديو.
