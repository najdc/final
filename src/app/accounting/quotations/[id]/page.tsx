'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Layout/Navbar';
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
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

export default function QuotationDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const [quotation, setQuotation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

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
          router.push('/accounting');
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

  // CEO Approve
  const handleApprove = async () => {
    if (!quotation) return;

    setUpdating(true);
    try {
      await updateDoc(doc(db, 'quotations', quotation.id), {
        status: 'quotation_approved',
        approvedBy: user?.uid || '',
        approvedByName: user?.displayName || '',
        approvalDate: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });

      // إرسال إشعار للمبيعات
      const orderDoc = await getDoc(doc(db, COLLECTIONS.ORDERS, quotation.relatedOrderId));
      if (orderDoc.exists()) {
        const orderData = orderDoc.data();
        
        await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
          type: 'quotation_approved',
          title: '✅ تمت الموافقة على عرض السعر',
          message: `تمت الموافقة على عرض السعر ${quotation.quotationNumber} للطلب ${quotation.relatedOrderNumber}. يمكنك الآن تحميله وإرساله للعميل.`,
          recipientId: orderData.createdBy,
          recipientRole: 'sales',
          relatedId: quotation.id,
          relatedType: 'quotation',
          isRead: false,
          createdAt: serverTimestamp(),
          actionUrl: `/quotations/${quotation.id}`, // ← رابط مباشر لعرض السعر
        });
      }

      toast.success('تمت الموافقة على عرض السعر بنجاح!');
      
      // Refresh
      const updatedDoc = await getDoc(doc(db, 'quotations', quotation.id));
      setQuotation({ id: updatedDoc.id, ...updatedDoc.data() });

    } catch (error) {
      console.error('Error approving quotation:', error);
      toast.error('فشل الموافقة على عرض السعر');
    } finally {
      setUpdating(false);
    }
  };

  // CEO Reject
  const handleReject = async () => {
    if (!quotation) return;
    
    const reason = prompt('يرجى إدخال سبب الرفض:');
    if (!reason) return;

    setUpdating(true);
    try {
      await updateDoc(doc(db, 'quotations', quotation.id), {
        status: 'quotation_cancelled',
        rejectedBy: user?.uid || '',
        rejectedByName: user?.displayName || '',
        rejectionReason: reason,
        rejectionDate: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });

      // إرسال إشعار للمحاسب
      await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
        type: 'quotation_rejected',
        title: 'تم رفض عرض السعر',
        message: `تم رفض عرض السعر ${quotation.quotationNumber}. السبب: ${reason}`,
        recipientId: quotation.preparedBy,
        recipientRole: 'accounting',
        relatedId: quotation.id,
        relatedType: 'quotation',
        isRead: false,
        createdAt: serverTimestamp(),
      });

      toast.success('تم رفض عرض السعر');
      
      // Refresh
      const updatedDoc = await getDoc(doc(db, 'quotations', quotation.id));
      setQuotation({ id: updatedDoc.id, ...updatedDoc.data() });

    } catch (error) {
      console.error('Error rejecting quotation:', error);
      toast.error('فشل رفض عرض السعر');
    } finally {
      setUpdating(false);
    }
  };

  // Send to Client (after CEO approval)
  const handleSendToClient = async () => {
    if (!quotation) return;

    setUpdating(true);
    try {
      await updateDoc(doc(db, 'quotations', quotation.id), {
        status: 'quotation_sent',
        sentToClientAt: new Date().toISOString(),
        sentBy: user?.uid || '',
        updatedAt: serverTimestamp(),
      });

      toast.success('تم إرسال عرض السعر للعميل!');
      
      // Refresh
      const updatedDoc = await getDoc(doc(db, 'quotations', quotation.id));
      setQuotation({ id: updatedDoc.id, ...updatedDoc.data() });

    } catch (error) {
      console.error('Error sending quotation:', error);
      toast.error('فشل إرسال عرض السعر');
    } finally {
      setUpdating(false);
    }
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
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:underline mb-4"
          >
            ← العودة
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                عرض السعر {quotation.quotationNumber}
              </h1>
              <p className="mt-2 text-gray-600">
                للطلب: {quotation.relatedOrderNumber}
              </p>
            </div>

            <span
              className="px-4 py-2 text-sm font-medium rounded-full text-white"
              style={{ backgroundColor: QUOTATION_STATUS_COLORS[quotation.status] }}
            >
              {QUOTATION_STATUS_LABELS[quotation.status]}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">معلومات العميل</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">الاسم</p>
                  <p className="text-base font-medium text-gray-900">{quotation.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">رقم الهاتف</p>
                  <p className="text-base font-medium text-gray-900">{quotation.customerPhone}</p>
                </div>
                {quotation.customerEmail && (
                  <div>
                    <p className="text-sm text-gray-600">البريد الإلكتروني</p>
                    <p className="text-base font-medium text-gray-900">{quotation.customerEmail}</p>
                  </div>
                )}
                {quotation.customerAddress && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600">العنوان</p>
                    <p className="text-base font-medium text-gray-900">{quotation.customerAddress}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">بنود عرض السعر</h2>
              <div className="space-y-4">
                {quotation.items?.map((item: any, index: number) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.description}</p>
                        {item.notes && (
                          <p className="text-sm text-gray-600 mt-1">{item.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                      <div>
                        <p className="text-gray-600">الكمية</p>
                        <p className="font-medium text-gray-900">{item.quantity}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">سعر الوحدة</p>
                        <p className="font-medium text-gray-900">{item.unitPrice.toFixed(2)} ر.س</p>
                      </div>
                      <div>
                        <p className="text-gray-600">المجموع</p>
                        <p className="font-medium text-gray-900">{item.totalPrice.toFixed(2)} ر.س</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">الملخص المالي</h2>
              <div className="space-y-2">
                <div className="flex justify-between text-gray-700">
                  <span>المجموع الفرعي:</span>
                  <span className="font-medium">{quotation.subtotal?.toFixed(2)} ر.س</span>
                </div>
                
                {quotation.discount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>الخصم:</span>
                    <span className="font-medium">- {quotation.discount?.toFixed(2)} ر.س</span>
                  </div>
                )}

                <div className="flex justify-between text-gray-700">
                  <span>الضريبة ({quotation.taxRate}%):</span>
                  <span className="font-medium">{quotation.taxAmount?.toFixed(2)} ر.س</span>
                </div>

                <div className="pt-2 border-t-2 border-gray-300 flex justify-between text-lg font-bold text-gray-900">
                  <span>المجموع الإجمالي:</span>
                  <span className="text-blue-600">{quotation.totalAmount?.toFixed(2)} ر.س</span>
                </div>

                {quotation.paymentTerms?.downPaymentPercentage > 0 && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-900">
                      <strong>الدفعة المقدمة ({quotation.paymentTerms.downPaymentPercentage}%):</strong> {quotation.paymentTerms.downPaymentAmount?.toFixed(2)} ر.س
                    </p>
                    <p className="text-sm text-blue-900 mt-1">
                      <strong>المبلغ المتبقي:</strong> {(quotation.totalAmount - quotation.paymentTerms.downPaymentAmount).toFixed(2)} ر.س
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment & Delivery Terms */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">شروط الدفع والتسليم</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">طريقة الدفع</p>
                  <p className="text-base font-medium text-gray-900">{quotation.paymentTerms?.method}</p>
                </div>
                {quotation.deliveryTerms && (
                  <div>
                    <p className="text-sm text-gray-600">شروط التسليم</p>
                    <p className="text-base font-medium text-gray-900">{quotation.deliveryTerms}</p>
                  </div>
                )}
                {quotation.deliveryDuration && (
                  <div>
                    <p className="text-sm text-gray-600">مدة التسليم</p>
                    <p className="text-base font-medium text-gray-900">{quotation.deliveryDuration}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Notes & Terms */}
            {(quotation.notes || quotation.terms) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">ملاحظات وشروط</h2>
                {quotation.notes && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">ملاحظات إضافية:</p>
                    <p className="text-base text-gray-900">{quotation.notes}</p>
                  </div>
                )}
                {quotation.terms && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">الشروط والأحكام:</p>
                    <p className="text-base text-gray-900 whitespace-pre-line">{quotation.terms}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Metadata */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">معلومات إضافية</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">تم الإعداد بواسطة</p>
                  <p className="text-base font-medium text-gray-900">{quotation.preparedByName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">تاريخ الإصدار</p>
                  <p className="text-base font-medium text-gray-900">
                    {quotation.issueDate && format(new Date(quotation.issueDate), 'dd MMMM yyyy', { locale: ar })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">صالح حتى</p>
                  <p className="text-base font-medium text-gray-900">
                    {quotation.validUntil && format(new Date(quotation.validUntil), 'dd MMMM yyyy', { locale: ar })}
                  </p>
                </div>
                {quotation.approvedByName && (
                  <div>
                    <p className="text-sm text-gray-600">تمت الموافقة بواسطة</p>
                    <p className="text-base font-medium text-gray-900">{quotation.approvedByName}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions for CEO */}
            {user?.role === 'ceo' && quotation.status === 'quotation_pending_approval' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">إجراءات المدير</h2>
                <div className="space-y-2">
                  <button
                    onClick={handleApprove}
                    disabled={updating}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 font-medium"
                  >
                    ✓ الموافقة على عرض السعر
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={updating}
                    className="w-full px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50 font-medium"
                  >
                    ✗ رفض عرض السعر
                  </button>
                </div>
              </div>
            )}

            {/* Actions for Accounting after CEO approval */}
            {user?.department === 'accounting' && quotation.status === 'quotation_approved' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">إجراءات الحسابات</h2>
                <div className="space-y-2">
                  <button
                    onClick={handleSendToClient}
                    disabled={updating}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 font-medium"
                  >
                    📧 إرسال للعميل
                  </button>
                  <p className="text-xs text-gray-600 text-center mt-2">
                    تمت الموافقة من المدير، يمكنك الآن إرسال عرض السعر للعميل
                  </p>
                </div>
              </div>
            )}

            {/* View Order */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">الطلب المرتبط</h2>
              <button
                onClick={() => router.push(`/orders/${quotation.relatedOrderId}`)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition"
              >
                عرض الطلب {quotation.relatedOrderNumber}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

