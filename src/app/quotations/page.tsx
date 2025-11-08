'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Layout/Navbar';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/types/shared';
import toast from 'react-hot-toast';
import { format } from 'date-fns/format';
import { ar } from 'date-fns/locale/ar';

const QUOTATION_STATUS_LABELS: Record<string, string> = {
  quotation_draft: 'مسودة',
  quotation_pending_approval: 'في انتظار الموافقة',
  quotation_approved: 'تمت الموافقة',
  quotation_sent: 'تم إرساله للعميل',
  quotation_client_reviewing: 'العميل يراجع',
  quotation_accepted: 'العميل وافق',
  quotation_rejected: 'العميل رفض',
  quotation_negotiating: 'قيد التفاوض',
  quotation_converted: 'تم تحويله لطلب',
  quotation_expired: 'منتهي الصلاحية',
  quotation_cancelled: 'ملغي',
};

const QUOTATION_STATUS_COLORS: Record<string, string> = {
  quotation_draft: '#6B7280',
  quotation_pending_approval: '#F59E0B',
  quotation_approved: '#10B981',
  quotation_sent: '#3B82F6',
  quotation_client_reviewing: '#8B5CF6',
  quotation_accepted: '#059669',
  quotation_rejected: '#EF4444',
  quotation_negotiating: '#F97316',
  quotation_converted: '#06B6D4',
  quotation_expired: '#9CA3AF',
  quotation_cancelled: '#DC2626',
};

export default function QuotationsListPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Only sales and accounting can view this page
    if (user.department !== 'sales' && user.department !== 'accounting' && user.role !== 'ceo') {
      router.push('/dashboard');
      return;
    }

    const fetchQuotations = async () => {
      try {
        let q;
        
        if (user.department === 'sales') {
          // المبيعات يرى عروض الأسعار المعتمدة فقط
          // نجلب الطلبات التي أنشأها ثم نجلب عروض الأسعار المرتبطة
          const ordersQuery = query(
            collection(db, COLLECTIONS.ORDERS),
            where('createdBy', '==', user.uid),
            where('isQuotation', '==', true)
          );
          
          const ordersSnapshot = await getDocs(ordersQuery);
          const orderIds = ordersSnapshot.docs.map(doc => doc.id);
          
          if (orderIds.length === 0) {
            setQuotations([]);
            setLoading(false);
            return;
          }
          
          // جلب جميع عروض الأسعار ثم تصفيتها
          q = query(
            collection(db, 'quotations'),
            orderBy('createdAt', 'desc')
          );
          
          const snapshot = await getDocs(q);
          const allQuotations = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // تصفية عروض الأسعار المرتبطة بطلبات المبيعات فقط
          const filteredQuotations = allQuotations.filter((quot: any) => 
            orderIds.includes(quot.relatedOrderId)
          );
          
          setQuotations(filteredQuotations);
        } else {
          // الحسابات و CEO يرون جميع عروض الأسعار
          q = query(
            collection(db, 'quotations'),
            orderBy('createdAt', 'desc')
          );
          
          const snapshot = await getDocs(q);
          const quotationsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          setQuotations(quotationsData);
        }
      } catch (error) {
        console.error('Error fetching quotations:', error);
        toast.error('فشل تحميل عروض الأسعار');
      } finally {
        setLoading(false);
      }
    };

    fetchQuotations();
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            عروض الأسعار
          </h1>
          <p className="mt-2 text-gray-600">
            {user?.department === 'sales' ? 'عروض الأسعار لطلباتك' : 'جميع عروض الأسعار'}
          </p>
        </div>

        {quotations.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-600">لا توجد عروض أسعار</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">إجمالي عروض الأسعار</p>
                <p className="text-2xl font-bold text-gray-900">{quotations.length}</p>
              </div>
              <div className="bg-yellow-50 rounded-lg shadow p-4">
                <p className="text-sm text-yellow-800">في انتظار الموافقة</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {quotations.filter(q => q.status === 'quotation_pending_approval').length}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg shadow p-4">
                <p className="text-sm text-green-800">تمت الموافقة</p>
                <p className="text-2xl font-bold text-green-600">
                  {quotations.filter(q => q.status === 'quotation_approved' || q.status === 'quotation_sent').length}
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg shadow p-4">
                <p className="text-sm text-blue-800">المبلغ الإجمالي</p>
                <p className="text-2xl font-bold text-blue-600">
                  {quotations.reduce((sum, q) => sum + (q.totalAmount || 0), 0).toFixed(2)} ر.س
                </p>
              </div>
            </div>

            {/* Quotations List */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      رقم عرض السعر
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      العميل
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الطلب المرتبط
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      المبلغ
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الحالة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      التاريخ
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      أعده
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      إجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {quotations.map((quotation) => (
                    <tr 
                      key={quotation.id} 
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">💰</span>
                          <span className="text-sm font-bold text-gray-900">
                            {quotation.quotationNumber}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">{quotation.customerName}</div>
                          <div className="text-gray-500">{quotation.customerPhone}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-blue-600 font-medium">
                          {quotation.relatedOrderNumber}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">
                          {quotation.totalAmount?.toFixed(2)} ر.س
                        </div>
                        {quotation.paymentTerms?.downPaymentPercentage > 0 && (
                          <div className="text-xs text-gray-500">
                            دفعة مقدمة: {quotation.paymentTerms.downPaymentPercentage}%
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full text-white"
                          style={{ backgroundColor: QUOTATION_STATUS_COLORS[quotation.status] }}
                        >
                          {QUOTATION_STATUS_LABELS[quotation.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {quotation.issueDate && format(new Date(quotation.issueDate), 'dd/MM/yyyy', { locale: ar })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{quotation.preparedByName}</div>
                        {quotation.approvedByName && (
                          <div className="text-xs text-green-600">✓ {quotation.approvedByName}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => router.push(`/quotations/${quotation.id}`)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          عرض التفاصيل →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

