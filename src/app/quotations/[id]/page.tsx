'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Layout/Navbar';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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

export default function QuotationViewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const [quotation, setQuotation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const fetchQuotation = async () => {
      try {
        const quotationDoc = await getDoc(doc(db, 'quotations', params.id));
        
        if (quotationDoc.exists()) {
          setQuotation({
            id: quotationDoc.id,
            ...quotationDoc.data(),
          });
        } else {
          toast.error('عرض السعر غير موجود');
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Error fetching quotation:', error);
        toast.error('فشل تحميل بيانات عرض السعر');
      } finally {
        setLoading(false);
      }
    };

    fetchQuotation();
  }, [user, params.id, router]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // TODO: تحويل لـ PDF
    toast('ميزة التحميل قيد التطوير. استخدم الطباعة (Ctrl+P) للحفظ كـ PDF', {
      icon: 'ℹ️',
      duration: 4000,
    });
    window.print();
  };

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

  if (!quotation) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto py-12 px-4">
          <p className="text-center text-red-600">عرض السعر غير موجود</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          body {
            background: white;
          }
        }
        .print-only {
          display: none;
        }
      `}</style>

      <div className="min-h-screen bg-gray-50" dir="rtl">
        <div className="no-print">
          <Navbar />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header - No Print */}
          <div className="no-print mb-8">
            <button
              onClick={() => router.back()}
              className="text-blue-600 hover:underline mb-4"
            >
              ← العودة
            </button>
            
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  عرض السعر {quotation.quotationNumber}
                </h1>
                <p className="mt-2 text-gray-600">
                  للطلب: {quotation.relatedOrderNumber}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  طباعة
                </button>
                
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  تحميل PDF
                </button>

                <span
                  className="px-4 py-2 text-sm font-medium rounded-full text-white"
                  style={{ backgroundColor: QUOTATION_STATUS_COLORS[quotation.status] }}
                >
                  {QUOTATION_STATUS_LABELS[quotation.status]}
                </span>
              </div>
            </div>
          </div>

          {/* Printable Content */}
          <div ref={printRef} className="bg-white rounded-lg shadow-lg p-8 md:p-12">
            {/* Company Header */}
            <div className="text-center mb-8 pb-6 border-b-4 border-blue-600">
              <h1 className="text-4xl font-bold text-blue-900 mb-2">شركة نجد</h1>
              <p className="text-gray-600">Najd Company</p>
              <p className="text-sm text-gray-500 mt-2">للطباعة والتصميم والدعاية والإعلان</p>
            </div>

            {/* Document Title */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">عرض سعر</h2>
              <p className="text-xl text-blue-600 font-bold">{quotation.quotationNumber}</p>
            </div>

            {/* Date and Validity */}
            <div className="flex justify-between mb-8 text-sm">
              <div>
                <p className="text-gray-600">تاريخ الإصدار:</p>
                <p className="font-medium">
                  {quotation.issueDate && format(new Date(quotation.issueDate), 'dd MMMM yyyy', { locale: ar })}
                </p>
              </div>
              <div className="text-left">
                <p className="text-gray-600">صالح حتى:</p>
                <p className="font-medium text-red-600">
                  {quotation.validUntil && format(new Date(quotation.validUntil), 'dd MMMM yyyy', { locale: ar })}
                </p>
              </div>
            </div>

            {/* Customer Info */}
            <div className="mb-8 p-6 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-bold text-gray-900 mb-3">معلومات العميل</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">الاسم:</p>
                  <p className="font-medium text-gray-900">{quotation.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">رقم الهاتف:</p>
                  <p className="font-medium text-gray-900">{quotation.customerPhone}</p>
                </div>
                {quotation.customerEmail && (
                  <div>
                    <p className="text-sm text-gray-600">البريد الإلكتروني:</p>
                    <p className="font-medium text-gray-900">{quotation.customerEmail}</p>
                  </div>
                )}
                {quotation.customerAddress && (
                  <div>
                    <p className="text-sm text-gray-600">العنوان:</p>
                    <p className="font-medium text-gray-900">{quotation.customerAddress}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-gray-900 mb-3">بنود عرض السعر</h3>
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="border border-gray-300 px-4 py-3 text-right">#</th>
                    <th className="border border-gray-300 px-4 py-3 text-right">الوصف</th>
                    <th className="border border-gray-300 px-4 py-3 text-center">الكمية</th>
                    <th className="border border-gray-300 px-4 py-3 text-center">سعر الوحدة</th>
                    <th className="border border-gray-300 px-4 py-3 text-center">المجموع</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items?.map((item: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-3 text-center font-medium">{index + 1}</td>
                      <td className="border border-gray-300 px-4 py-3">
                        <p className="font-medium">{item.description}</p>
                        {item.notes && <p className="text-sm text-gray-600 mt-1">{item.notes}</p>}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">{item.quantity}</td>
                      <td className="border border-gray-300 px-4 py-3 text-center">{item.unitPrice.toFixed(2)} ر.س</td>
                      <td className="border border-gray-300 px-4 py-3 text-center font-medium">{item.totalPrice.toFixed(2)} ر.س</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div className="mb-8">
              <div className="flex justify-end">
                <div className="w-full md:w-1/2 space-y-2">
                  <div className="flex justify-between py-2">
                    <span className="text-gray-700">المجموع الفرعي:</span>
                    <span className="font-medium">{quotation.subtotal?.toFixed(2)} ر.س</span>
                  </div>
                  
                  {quotation.discount > 0 && (
                    <div className="flex justify-between py-2 text-red-600">
                      <span>الخصم:</span>
                      <span className="font-medium">- {quotation.discount?.toFixed(2)} ر.س</span>
                    </div>
                  )}

                  <div className="flex justify-between py-2">
                    <span className="text-gray-700">الضريبة ({quotation.taxRate}%):</span>
                    <span className="font-medium">{quotation.taxAmount?.toFixed(2)} ر.س</span>
                  </div>

                  <div className="flex justify-between py-3 border-t-2 border-gray-800 text-lg font-bold">
                    <span>المجموع الإجمالي:</span>
                    <span className="text-blue-600">{quotation.totalAmount?.toFixed(2)} ر.س</span>
                  </div>

                  {quotation.paymentTerms?.downPaymentPercentage > 0 && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-900">الدفعة المقدمة ({quotation.paymentTerms.downPaymentPercentage}%):</span>
                        <span className="font-bold text-blue-900">{quotation.paymentTerms.downPaymentAmount?.toFixed(2)} ر.س</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-900">المبلغ المتبقي:</span>
                        <span className="font-bold text-blue-900">{(quotation.totalAmount - quotation.paymentTerms.downPaymentAmount).toFixed(2)} ر.س</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Payment & Delivery Terms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-bold text-gray-900 mb-2">شروط الدفع</h3>
                <p className="text-sm text-gray-700">{quotation.paymentTerms?.method}</p>
                {quotation.paymentTerms?.downPaymentPercentage > 0 && (
                  <p className="text-sm text-gray-700 mt-1">
                    دفعة مقدمة: {quotation.paymentTerms.downPaymentPercentage}%
                  </p>
                )}
              </div>

              {quotation.deliveryTerms && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-bold text-gray-900 mb-2">شروط التسليم</h3>
                  <p className="text-sm text-gray-700">{quotation.deliveryTerms}</p>
                  {quotation.deliveryDuration && (
                    <p className="text-sm text-gray-700 mt-1">
                      المدة: {quotation.deliveryDuration}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            {quotation.notes && (
              <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="font-bold text-gray-900 mb-2">ملاحظات:</h3>
                <p className="text-sm text-gray-700">{quotation.notes}</p>
              </div>
            )}

            {/* Terms and Conditions */}
            {quotation.terms && (
              <div className="mb-8">
                <h3 className="font-bold text-gray-900 mb-2">الشروط والأحكام:</h3>
                <p className="text-sm text-gray-700 whitespace-pre-line">{quotation.terms}</p>
              </div>
            )}

            {/* Approval Status */}
            {quotation.approvedByName && (
              <div className="mb-8 p-4 bg-green-50 border border-green-300 rounded-lg">
                <p className="text-sm text-green-800">
                  ✓ تمت الموافقة على هذا العرض من قبل: <strong>{quotation.approvedByName}</strong>
                </p>
                {quotation.approvalDate && (
                  <p className="text-xs text-green-700 mt-1">
                    بتاريخ: {format(new Date(quotation.approvalDate), 'dd MMMM yyyy - HH:mm', { locale: ar })}
                  </p>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="mt-12 pt-6 border-t border-gray-300 text-center text-sm text-gray-600">
              <p>شركة نجد للطباعة والتصميم والدعاية والإعلان</p>
              <p className="mt-1">هاتف: +966 XX XXX XXXX | البريد: info@najd.com</p>
              <p className="mt-2 text-xs">تم الإعداد بواسطة: {quotation.preparedByName}</p>
            </div>
          </div>

          {/* Action Buttons - No Print */}
          {user?.department === 'sales' && (
            <div className="no-print mt-6 bg-blue-50 border-2 border-blue-300 rounded-lg p-6">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">تعليمات للمبيعات</h3>
                  <p className="text-sm text-gray-700">
                    يمكنك الآن طباعة أو تحميل عرض السعر وإرساله للعميل.
                    بعد موافقة العميل، قم بتحويل الطلب لمرحلة التنفيذ.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrint}
                    className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium"
                  >
                    📄 طباعة للعميل
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Related Order Link - No Print */}
          <div className="no-print mt-6 text-center">
            <button
              onClick={() => router.push(`/orders/${quotation.relatedOrderId}`)}
              className="text-blue-600 hover:underline"
            >
              ← العودة للطلب {quotation.relatedOrderNumber}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

