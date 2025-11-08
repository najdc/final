# تطبيق نجد للويب 🌐

تطبيق Next.js 14 للإدارة الداخلية لشركة نجد.

## 🚀 البدء

```bash
# تثبيت المكتبات
npm install

# تشغيل التطبيق في وضع التطوير
npm run dev

# بناء التطبيق للإنتاج
npm run build

# تشغيل التطبيق المبني
npm start
```

## 📁 هيكل المشروع

```
src/
├── app/              # صفحات Next.js (App Router)
│   ├── page.tsx      # الصفحة الرئيسية
│   ├── login/        # صفحة تسجيل الدخول
│   ├── dashboard/    # لوحة التحكم
│   ├── orders/       # إدارة الطلبات
│   └── layout.tsx    # Layout رئيسي
├── components/       # مكونات React
│   └── Layout/
├── contexts/         # React Contexts
│   └── AuthContext.tsx
├── hooks/            # Custom Hooks
│   ├── useOrders.ts
│   └── useNotifications.ts
└── lib/              # Utilities
    └── firebase.ts   # Firebase Config
```

## 🎨 التصميم

- **Framework**: Tailwind CSS
- **RTL Support**: كامل
- **Responsive**: تصميم متجاوب لجميع الأجهزة
- **Theme**: ألوان نجد (أزرق وذهبي)

## 🔑 الصفحات الرئيسية

- `/` - الصفحة الرئيسية (تحويل للوحة التحكم)
- `/login` - تسجيل الدخول
- `/dashboard` - لوحة التحكم
- `/orders` - قائمة الطلبات
- `/orders/new` - إنشاء طلب جديد
- `/orders/[id]` - تفاصيل الطلب
- `/notifications` - الإشعارات
- `/users` - إدارة المستخدمين (CEO فقط)

## 🔧 البيئة

ملف `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false
```

## 📦 المكتبات الرئيسية

- `next` - React Framework
- `react` & `react-dom` - UI Library
- `firebase` - Backend Services
- `tailwindcss` - Styling
- `date-fns` - Date Formatting
- `react-hot-toast` - Notifications
- `@najd/shared` - Shared Types & Utils

## 🧪 الاختبار

```bash
npm run lint
npm run type-check
```

# najd_sys
# final
# final
