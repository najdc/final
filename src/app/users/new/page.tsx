/**
 * صفحة إضافة مستخدم جديد
 * للمدير (CEO) فقط
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Layout/Navbar';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { UserRole, Department } from '@/types/shared';
import toast from 'react-hot-toast';

const ROLE_OPTIONS = [
  { value: UserRole.SALES, label: 'موظف مبيعات', department: Department.SALES },
  { value: UserRole.SALES_HEAD, label: 'مدير المبيعات', department: Department.SALES, isHead: true },
  { value: UserRole.DESIGN, label: 'مصمم', department: Department.DESIGN },
  { value: UserRole.DESIGN_HEAD, label: 'مدير التصميم', department: Department.DESIGN, isHead: true },
  { value: UserRole.PRINTING, label: 'موظف طباعة', department: Department.PRINTING },
  { value: UserRole.PRINTING_HEAD, label: 'مدير الطباعة', department: Department.PRINTING, isHead: true },
  { value: UserRole.ACCOUNTING, label: 'محاسب', department: Department.ACCOUNTING },
  { value: UserRole.ACCOUNTING_HEAD, label: 'مدير الحسابات', department: Department.ACCOUNTING, isHead: true },
  { value: UserRole.DISPATCH, label: 'موظف إرسال', department: Department.DISPATCH },
  { value: UserRole.DISPATCH_HEAD, label: 'مدير الإرسال', department: Department.DISPATCH, isHead: true },
];

export default function NewUserPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);

  // بيانات المستخدم
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  // التحقق من الصلاحيات
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-najd-blue"></div>
      </div>
    );
  }

  if (!user || user.role !== 'ceo') {
    router.push('/dashboard');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // التحقق من البيانات
    if (!displayName || !email || !password || !selectedRole) {
      toast.error('يرجى تعبئة جميع الحقول المطلوبة');
      return;
    }

    if (password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('كلمات المرور غير متطابقة');
      return;
    }

    const roleOption = ROLE_OPTIONS.find(r => r.value === selectedRole);
    if (!roleOption) {
      toast.error('الدور المختار غير صحيح');
      return;
    }

    try {
      setLoading(true);

      // إنشاء المستخدم في Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      // حفظ بيانات المستخدم في Firestore
      await setDoc(doc(db, 'users', newUser.uid), {
        uid: newUser.uid,
        email: email,
        displayName: displayName,
        phoneNumber: phoneNumber || null,
        role: roleOption.value,
        department: roleOption.department,
        isHead: roleOption.isHead || false,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        photoURL: null,
      });

      toast.success(`تم إضافة المستخدم ${displayName} بنجاح`);
      router.push('/users');
      
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      // رسائل خطأ مفصلة
      if (error.code === 'auth/email-already-in-use') {
        toast.error('هذا البريد الإلكتروني مستخدم بالفعل');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('البريد الإلكتروني غير صحيح');
      } else if (error.code === 'auth/weak-password') {
        toast.error('كلمة المرور ضعيفة');
      } else {
        toast.error('حدث خطأ أثناء إنشاء المستخدم');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8" dir="rtl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            <button
              onClick={() => router.back()}
              className="self-start p-2 hover:bg-gray-200 rounded-lg transition"
            >
              ← رجوع
            </button>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">إضافة مستخدم جديد</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">إنشاء حساب موظف جديد في النظام</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <form onSubmit={handleSubmit}>
            {/* المعلومات الأساسية */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                👤 المعلومات الأساسية
              </h2>
              
              <div className="space-y-4">
                {/* الاسم الكامل */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الاسم الكامل <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    placeholder="مثال: أحمد محمد العلي"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-najd-blue focus:border-transparent"
                  />
                </div>

                {/* البريد الإلكتروني */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    البريد الإلكتروني <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="example@najd.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-najd-blue focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    سيستخدم للدخول إلى النظام
                  </p>
                </div>

                {/* رقم الهاتف */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    رقم الهاتف
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="05xxxxxxxx"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-najd-blue focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* الدور والصلاحيات */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                🎯 الدور والصلاحيات
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الدور <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-najd-blue focus:border-transparent"
                >
                  <option value="">اختر الدور...</option>
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                      {option.isHead ? ' 👑' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  سيحدد الدور القسم والصلاحيات تلقائياً
                </p>
              </div>
            </div>

            {/* كلمة المرور */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                🔒 كلمة المرور
              </h2>
              
              <div className="space-y-4">
                {/* كلمة المرور */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    كلمة المرور <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="6 أحرف على الأقل"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-najd-blue focus:border-transparent"
                  />
                </div>

                {/* تأكيد كلمة المرور */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    تأكيد كلمة المرور <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="أعد كتابة كلمة المرور"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-najd-blue focus:border-transparent"
                  />
                  {password && confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">
                      ⚠️ كلمات المرور غير متطابقة
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ملخص */}
            {selectedRole && (
              <div className="mb-8 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <h3 className="font-bold text-blue-900 mb-2">ملخص المستخدم الجديد:</h3>
                <div className="space-y-1 text-sm text-blue-800">
                  <p>👤 الاسم: <span className="font-semibold">{displayName || '-'}</span></p>
                  <p>📧 البريد: <span className="font-semibold">{email || '-'}</span></p>
                  <p>📱 الهاتف: <span className="font-semibold">{phoneNumber || '-'}</span></p>
                  <p>🎯 الدور: <span className="font-semibold">
                    {ROLE_OPTIONS.find(r => r.value === selectedRole)?.label}
                  </span></p>
                  <p>🏢 القسم: <span className="font-semibold">
                    {getDepartmentLabel(ROLE_OPTIONS.find(r => r.value === selectedRole)?.department)}
                  </span></p>
                  {ROLE_OPTIONS.find(r => r.value === selectedRole)?.isHead && (
                    <p className="font-bold text-yellow-700">👑 رئيس قسم</p>
                  )}
                </div>
              </div>
            )}

            {/* الأزرار */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                type="submit"
                disabled={loading || !displayName || !email || !password || !selectedRole || password !== confirmPassword}
                className="flex-1 bg-najd-blue text-white px-6 py-3 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm sm:text-base"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    جاري الإنشاء...
                  </span>
                ) : (
                  '✓ إنشاء المستخدم'
                )}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                disabled={loading}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 text-sm sm:text-base"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>

        {/* ملاحظات مهمة */}
        <div className="mt-6 bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
          <h3 className="font-bold text-yellow-900 mb-2 flex items-center gap-2">
            ⚠️ ملاحظات مهمة
          </h3>
          <ul className="text-sm text-yellow-800 space-y-1 mr-4">
            <li>• تأكد من صحة البريد الإلكتروني قبل الإنشاء</li>
            <li>• كلمة المرور يجب أن تكون قوية (6 أحرف على الأقل)</li>
            <li>• سيتم تفعيل المستخدم تلقائياً</li>
            <li>• يمكن للمستخدم تغيير كلمة المرور لاحقاً</li>
            <li>• الدور والقسم يحددان الصلاحيات داخل النظام</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

function getDepartmentLabel(dept?: string): string {
  const labels: Record<string, string> = {
    management: 'الإدارة',
    sales: 'المبيعات',
    design: 'التصميم',
    printing: 'الطباعة',
    accounting: 'الحسابات',
    dispatch: 'الإرسال',
  };
  return dept ? labels[dept] || dept : '-';
}

