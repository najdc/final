/**
 * صفحة قائمة الفواتير - Accounting Dashboard
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Layout/Navbar';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Invoice, InvoiceStatus } from '@najd/shared';
import { format } from 'date-fns/format';
import { ar } from 'date-fns/locale/ar';

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  invoice_draft: 'مسودة',
  invoice_pending_approval: 'في انتظار الموافقة',
  invoice_approved: 'تمت الموافقة',
  invoice_sent: 'تم إرسالها للعميل',
  invoice_partially_paid: 'مدفوعة جزئياً',
  invoice_fully_paid: 'مدفوعة بالكامل',
  invoice_overdue: 'متأخرة',
  invoice_cancelled: 'ملغاة',
  invoice_refunded: 'مستردة',
};

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  invoice_draft: '#6b7280',
  invoice_pending_approval: '#f59e0b',
  invoice_approved: '#10b981',
  invoice_sent: '#3b82f6',
  invoice_partially_paid: '#8b5cf6',
  invoice_fully_paid: '#10b981',
  invoice_overdue: '#ef4444',
  invoice_cancelled: '#6b7280',
  invoice_refunded: '#f59e0b',
};

export default function InvoicesListPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }

    // التحقق من الصلاحيات
    if (user && user.department !== 'accounting' && user.role !== 'ceo') {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchInvoices();
    }
  }, [user, statusFilter]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      let q = query(
        collection(db, 'invoices'),
        orderBy('createdAt', 'desc')
      );

      if (statusFilter !== 'all') {
        q = query(
          collection(db, 'invoices'),
          where('status', '==', statusFilter),
          orderBy('createdAt', 'desc')
        );
      }

      const snapshot = await getDocs(q);
      const invoicesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Invoice[];

      setInvoices(invoicesData);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-najd-blue"></div>
      </div>
    );
  }

  // تصفية البحث
  const filteredInvoices = invoices.filter(invoice => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      invoice.invoiceNumber.toLowerCase().includes(query) ||
      invoice.customerName.toLowerCase().includes(query) ||
      invoice.customerPhone.includes(query)
    );
  });

  // إحصائيات
  const stats = {
    total: invoices.length,
    draft: invoices.filter(i => i.status === 'invoice_draft').length,
    pending: invoices.filter(i => i.status === 'invoice_pending_approval').length,
    paid: invoices.filter(i => i.status === 'invoice_fully_paid').length,
    overdue: invoices.filter(i => i.status === 'invoice_overdue').length,
    totalAmount: invoices.reduce((sum, i) => sum + i.totalAmount, 0),
    paidAmount: invoices.reduce((sum, i) => sum + i.paidAmount, 0),
    remainingAmount: invoices.reduce((sum, i) => sum + i.remainingAmount, 0),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8" dir="rtl">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">الفواتير</h1>
            <p className="text-gray-600">إدارة جميع الفواتير</p>
          </div>
          <button
            onClick={() => router.push('/accounting/invoices/new')}
            className="bg-najd-blue text-white px-6 py-3 rounded-lg hover:bg-opacity-90 transition flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            <span>إنشاء فاتورة جديدة</span>
          </button>
        </div>

        {/* إحصائيات */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="إجمالي الفواتير"
            value={stats.total}
            icon="📄"
            color="bg-blue-500"
          />
          <StatCard
            title="في الانتظار"
            value={stats.pending}
            icon="⏳"
            color="bg-yellow-500"
          />
          <StatCard
            title="مدفوعة"
            value={stats.paid}
            icon="✅"
            color="bg-green-500"
          />
          <StatCard
            title="متأخرة"
            value={stats.overdue}
            icon="⚠️"
            color="bg-red-500"
          />
        </div>

        {/* إحصائيات مالية */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">إجمالي المبالغ</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.totalAmount.toLocaleString('ar-SA')} ر.س
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">المبالغ المدفوعة</p>
            <p className="text-2xl font-bold text-green-600">
              {stats.paidAmount.toLocaleString('ar-SA')} ر.س
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">المبالغ المستحقة</p>
            <p className="text-2xl font-bold text-red-600">
              {stats.remainingAmount.toLocaleString('ar-SA')} ر.س
            </p>
          </div>
        </div>

        {/* التصفية والبحث */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* البحث */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                البحث
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="رقم الفاتورة، اسم العميل، رقم الهاتف..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-najd-blue"
              />
            </div>

            {/* تصفية الحالة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تصفية حسب الحالة
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | 'all')}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-najd-blue"
              >
                <option value="all">جميع الحالات</option>
                <option value="invoice_draft">مسودة</option>
                <option value="invoice_pending_approval">في انتظار الموافقة</option>
                <option value="invoice_approved">تمت الموافقة</option>
                <option value="invoice_sent">مُرسلة للعميل</option>
                <option value="invoice_partially_paid">مدفوعة جزئياً</option>
                <option value="invoice_fully_paid">مدفوعة بالكامل</option>
                <option value="invoice_overdue">متأخرة</option>
              </select>
            </div>
          </div>
        </div>

        {/* جدول الفواتير */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-najd-blue mx-auto"></div>
              <p className="mt-4 text-gray-600">جاري التحميل...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">لا توجد فواتير</p>
              <button
                onClick={() => router.push('/accounting/invoices/new')}
                className="mt-4 text-najd-blue hover:underline"
              >
                إنشاء فاتورة جديدة
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      رقم الفاتورة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      العميل
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      المبلغ الإجمالي
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      المدفوع
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      المتبقي
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      تاريخ الإصدار
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الحالة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      إجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredInvoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="hover:bg-gray-50 cursor-pointer transition"
                      onClick={() => router.push(`/accounting/invoices/${invoice.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {invoice.invoiceNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{invoice.customerName}</div>
                        <div className="text-sm text-gray-500">{invoice.customerPhone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {invoice.totalAmount.toLocaleString('ar-SA')} ر.س
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-green-600">
                          {invoice.paidAmount.toLocaleString('ar-SA')} ر.س
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-red-600">
                          {invoice.remainingAmount.toLocaleString('ar-SA')} ر.س
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(invoice.issueDate), 'dd MMM yyyy', { locale: ar })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full text-white"
                          style={{ backgroundColor: STATUS_COLORS[invoice.status] }}
                        >
                          {INVOICE_STATUS_LABELS[invoice.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/accounting/invoices/${invoice.id}`);
                          }}
                          className="text-najd-blue hover:text-najd-gold"
                        >
                          عرض
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// مكون بطاقة الإحصائيات
function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`w-12 h-12 ${color} rounded-full flex items-center justify-center text-2xl`}>
          {icon}
        </div>
      </div>
    </div>
  );
}


