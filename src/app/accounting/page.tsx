'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Layout/Navbar';
import Link from 'next/link';

interface DashboardStats {
  quotations: {
    total: number;
    pending: number;
    approved: number;
    sent: number;
  };
  invoices: {
    total: number;
    pending: number;
    paid: number;
    overdue: number;
  };
  payments: {
    totalReceived: number;
    pendingAmount: number;
    thisMonth: number;
  };
}

export default function AccountingDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    quotations: { total: 0, pending: 0, approved: 0, sent: 0 },
    invoices: { total: 0, pending: 0, paid: 0, overdue: 0 },
    payments: { totalReceived: 0, pendingAmount: 0, thisMonth: 0 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // تحقق من صلاحيات المستخدم
    if (user && user.department !== 'accounting') {
      router.push('/dashboard');
      return;
    }

    // TODO: جلب البيانات من Firestore
    // هذه بيانات تجريبية للعرض
    setTimeout(() => {
      setStats({
        quotations: { total: 24, pending: 5, approved: 12, sent: 7 },
        invoices: { total: 48, pending: 8, paid: 35, overdue: 5 },
        payments: { totalReceived: 285000, pendingAmount: 45000, thisMonth: 125000 },
      });
      setLoading(false);
    }, 500);
  }, [user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">جاري التحميل...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* العنوان */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            💰 لوحة تحكم قسم الحسابات
          </h1>
          <p className="mt-2 text-gray-600">
            إدارة عروض الأسعار والفواتير والمدفوعات
          </p>
        </div>

        {/* الإحصائيات السريعة */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* إجمالي المدفوعات المستلمة */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">المدفوعات المستلمة</p>
                <p className="text-3xl font-bold mt-2">
                  {stats.payments.totalReceived.toLocaleString()} ر.س
                </p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-full p-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-green-100 text-sm mt-4">
              هذا الشهر: {stats.payments.thisMonth.toLocaleString()} ر.س
            </p>
          </div>

          {/* المبالغ المعلقة */}
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm">مبالغ معلقة</p>
                <p className="text-3xl font-bold mt-2">
                  {stats.payments.pendingAmount.toLocaleString()} ر.س
                </p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-full p-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-yellow-100 text-sm mt-4">
              فواتير معلقة: {stats.invoices.pending}
            </p>
          </div>

          {/* عروض الأسعار */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">عروض الأسعار</p>
                <p className="text-3xl font-bold mt-2">{stats.quotations.total}</p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-full p-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <p className="text-blue-100 text-sm mt-4">
              قيد الانتظار: {stats.quotations.pending}
            </p>
          </div>

          {/* الفواتير */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">الفواتير</p>
                <p className="text-3xl font-bold mt-2">{stats.invoices.total}</p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-full p-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
              </div>
            </div>
            <p className="text-purple-100 text-sm mt-4">
              مدفوعة: {stats.invoices.paid} | متأخرة: {stats.invoices.overdue}
            </p>
          </div>
        </div>

        {/* الإجراءات السريعة */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            ⚡ إجراءات سريعة
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/accounting/quotations/new"
              className="flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white px-6 py-4 rounded-lg transition-colors duration-200"
            >
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              إنشاء عرض سعر جديد
            </Link>
            
            <Link
              href="/accounting/invoices/new"
              className="flex items-center justify-center bg-purple-500 hover:bg-purple-600 text-white px-6 py-4 rounded-lg transition-colors duration-200"
            >
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              إنشاء فاتورة جديدة
            </Link>
            
            <Link
              href="/accounting/quotations"
              className="flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-4 rounded-lg transition-colors duration-200"
            >
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              إدارة عروض الأسعار
            </Link>
            
            <Link
              href="/accounting/invoices"
              className="flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-4 rounded-lg transition-colors duration-200"
            >
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
              إدارة الفواتير
            </Link>
          </div>
        </div>

        {/* القوائم */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* عروض الأسعار الأخيرة */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                📋 عروض الأسعار الأخيرة
              </h2>
              <Link href="/accounting/quotations" className="text-blue-600 hover:text-blue-700 text-sm">
                عرض الكل ←
              </Link>
            </div>
            
            <div className="space-y-3">
              {/* TODO: استبدال هذه البيانات التجريبية ببيانات حقيقية */}
              <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">QT-2025-0024</p>
                    <p className="text-sm text-gray-600">شركة الأمل التجارية</p>
                  </div>
                  <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                    قيد المراجعة
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">المبلغ: 12,500 ر.س</span>
                  <span className="text-gray-500">منذ يومين</span>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">QT-2025-0023</p>
                    <p className="text-sm text-gray-600">مؤسسة النجاح</p>
                  </div>
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                    تمت الموافقة
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">المبلغ: 8,750 ر.س</span>
                  <span className="text-gray-500">منذ 3 أيام</span>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">QT-2025-0022</p>
                    <p className="text-sm text-gray-600">متجر الابتكار</p>
                  </div>
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                    تم الإرسال
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">المبلغ: 15,200 ر.س</span>
                  <span className="text-gray-500">منذ أسبوع</span>
                </div>
              </div>
            </div>
          </div>

          {/* الفواتير المتأخرة والمعلقة */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                ⚠️ فواتير تحتاج متابعة
              </h2>
              <Link href="/accounting/invoices" className="text-blue-600 hover:text-blue-700 text-sm">
                عرض الكل ←
              </Link>
            </div>
            
            <div className="space-y-3">
              {/* TODO: استبدال هذه البيانات التجريبية ببيانات حقيقية */}
              <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">INV-2025-0042</p>
                    <p className="text-sm text-gray-600">شركة التطوير</p>
                  </div>
                  <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                    متأخرة
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700 font-medium">المتبقي: 5,000 ر.س</span>
                  <span className="text-red-600">تأخر 5 أيام</span>
                </div>
              </div>

              <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">INV-2025-0041</p>
                    <p className="text-sm text-gray-600">مكتبة المعرفة</p>
                  </div>
                  <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                    معلقة
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700 font-medium">المتبقي: 8,500 ر.س</span>
                  <span className="text-gray-600">مستحقة غداً</span>
                </div>
              </div>

              <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">INV-2025-0040</p>
                    <p className="text-sm text-gray-600">شركة الإبداع</p>
                  </div>
                  <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">
                    جزئية
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700 font-medium">المتبقي: 3,200 ر.س</span>
                  <span className="text-gray-600">من أصل 10,000</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* التقارير */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            📊 التقارير والإحصائيات
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/accounting/reports/quotations"
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold text-gray-900 mb-2">تقرير عروض الأسعار</h3>
              <p className="text-sm text-gray-600">
                تحليل شامل لعروض الأسعار ومعدلات التحويل
              </p>
            </Link>
            
            <Link
              href="/accounting/reports/invoices"
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold text-gray-900 mb-2">تقرير الفواتير</h3>
              <p className="text-sm text-gray-600">
                حالة الفواتير والمدفوعات والمتأخرات
              </p>
            </Link>
            
            <Link
              href="/accounting/reports/financial"
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold text-gray-900 mb-2">التقرير المالي</h3>
              <p className="text-sm text-gray-600">
                ملخص المبيعات والإيرادات والمستحقات
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


