/**
 * صفحة تفاصيل الطلب
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Layout/Navbar';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, functions } from '@/lib/firebase';
import {
  OrderStatus,
  ORDER_STATUS_LABELS,
  PRINT_TYPE_LABELS,
  PRIORITY_LABELS,
  MATERIAL_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
  getStatusColor,
  getPriorityColor,
  COLLECTIONS,
} from '@/types/shared';
import { format } from 'date-fns/format';
import { ar } from 'date-fns/locale/ar';
import toast from 'react-hot-toast';
import { notifyCEOOrderStatusChange, notifyCEOTaskCompleted } from '@/utils/ceoNotifications';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  priority: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress?: string;
  printType: string;
  quantity: number;
  needsDesign: boolean;
  designDescription?: string;
  materials: any[];
  files: any[];
  notes?: string;
  paymentStatus: string;
  createdBy: string;
  createdByName: string;
  createdAt: any;
  updatedAt: any;
  requestedDeliveryDate?: string;
  isUrgent: boolean;
}

export default function OrderDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  // لتعيين المهام
  const [showAssignmentUI, setShowAssignmentUI] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!user || !params.id) return;

    const fetchOrder = async () => {
      try {
        const orderDoc = await getDoc(doc(db, COLLECTIONS.ORDERS, params.id));
        
        if (orderDoc.exists()) {
          setOrder({
            id: orderDoc.id,
            ...orderDoc.data(),
          } as Order);
        } else {
          toast.error('الطلب غير موجود');
          router.push('/orders');
        }
      } catch (error) {
        console.error('Error fetching order:', error);
        toast.error('فشل تحميل بيانات الطلب');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [user, params.id, router]);

  // جلب أعضاء الفريق (للرؤساء فقط)
  useEffect(() => {
    if (!user || !user.isHead) return;

    const fetchTeamMembers = async () => {
      try {
        const q = query(
          collection(db, 'users'),
          where('department', '==', user.department),
          where('isActive', '==', true)
        );
        const snapshot = await getDocs(q);
        const members = snapshot.docs
          .map(doc => ({ uid: doc.id, ...doc.data() }))
          .filter(m => m.uid !== user.uid); // استبعاد الرئيس نفسه
        setTeamMembers(members);
      } catch (error) {
        console.error('Error fetching team members:', error);
      }
    };

    fetchTeamMembers();
  }, [user]);

  const handleStatusUpdate = async (newStatus: OrderStatus, additionalData?: any) => {
    if (!order) return;

    setUpdating(true);
    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp(),
        ...additionalData,
      };

      await updateDoc(doc(db, COLLECTIONS.ORDERS, order.id), updateData);

      setOrder({ ...order, status: newStatus, ...additionalData });
      
      // إشعار للـ CEO عند تحديثات مهمة
      const importantStatuses = [
        OrderStatus.PRINTING_COMPLETED,
        OrderStatus.DESIGN_COMPLETED,
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
        OrderStatus.PAYMENT_CONFIRMED,
      ];
      
      if (importantStatuses.includes(newStatus)) {
        await notifyCEOOrderStatusChange(
          order.orderNumber,
          order.customerName,
          newStatus,
          order.id
        );
      }
      
      toast.success('تم تحديث حالة الطلب بنجاح');
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('فشل تحديث حالة الطلب');
    } finally {
      setUpdating(false);
    }
  };

  // تعيين المهمة لموظف
  const handleAssignTask = async () => {
    if (!selectedUserId) {
      toast.error('يرجى اختيار موظف');
      return;
    }

    setAssigning(true);
    try {
      // استخدام helper function بدلاً من Cloud Function
      const { assignTask } = await import('@/utils/taskAssignment');
      
      console.log('🎯 تعيين مهمة:', {
        orderId: order!.id,
        userId: selectedUserId,
        department: user!.department,
        currentUser: user!.displayName,
      });
      
      await assignTask({
        orderId: order!.id,
        userId: selectedUserId,
        department: user!.department,
        estimatedDuration: estimatedHours ? Number(estimatedHours) : null,
        notes: assignmentNotes || null,
        currentUserId: user!.uid,
        currentUserName: user!.displayName,
        currentUserRole: user!.role,
      });

      toast.success('تم تعيين المهمة بنجاح!');
      
      // إعادة تحميل الصفحة
      window.location.reload();
    } catch (error: any) {
      console.error('Error assigning task:', error);
      toast.error(error.message || 'فشل تعيين المهمة');
    } finally {
      setAssigning(false);
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto py-12 px-4">
          <div className="flex justify-center items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-najd-blue"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto py-12 px-4">
          <p className="text-center text-red-600">الطلب غير موجود</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8" dir="rtl">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <button
              onClick={() => router.back()}
              className="text-najd-blue hover:underline mb-2"
            >
              ← العودة للطلبات
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">
                تفاصيل الطلب {order.orderNumber}
              </h1>
              {(order as any).isQuotation && (
                <span className="inline-flex items-center px-3 py-1 text-sm font-bold rounded-full bg-yellow-100 text-yellow-800 border-2 border-yellow-400">
                  💰 عرض سعر
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <span
              className="px-4 py-2 text-sm font-medium rounded-full text-white"
              style={{ backgroundColor: getStatusColor(order.status) }}
            >
              {ORDER_STATUS_LABELS[order.status]}
            </span>
            <span
              className="px-4 py-2 text-sm font-medium rounded-full text-white"
              style={{ backgroundColor: getPriorityColor(order.priority as any) }}
            >
              {(PRIORITY_LABELS as any)[order.priority]}
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
                  <p className="text-base font-medium text-gray-900">{order.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">رقم الهاتف</p>
                  <p className="text-base font-medium text-gray-900">{order.customerPhone}</p>
                </div>
                {order.customerEmail && (
                  <div>
                    <p className="text-sm text-gray-600">البريد الإلكتروني</p>
                    <p className="text-base font-medium text-gray-900">{order.customerEmail}</p>
                  </div>
                )}
                {order.customerAddress && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600">العنوان</p>
                    <p className="text-base font-medium text-gray-900">{order.customerAddress}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Order Details */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">تفاصيل الطلب</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">نوع الطباعة</p>
                  <p className="text-base font-medium text-gray-900">
                    {(PRINT_TYPE_LABELS as any)[order.printType]}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">الكمية</p>
                  <p className="text-base font-medium text-gray-900">{order.quantity}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">يحتاج تصميم</p>
                  <p className="text-base font-medium text-gray-900">
                    {order.needsDesign ? 'نعم' : 'لا'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">حالة الدفع</p>
                  <p className="text-base font-medium text-gray-900">
                    {(PAYMENT_STATUS_LABELS as any)[order.paymentStatus]}
                  </p>
                </div>
                {order.requestedDeliveryDate && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600">تاريخ التسليم المطلوب</p>
                    <p className="text-base font-medium text-gray-900">
                      {format(new Date(order.requestedDeliveryDate), 'dd MMMM yyyy', {
                        locale: ar,
                      })}
                    </p>
                  </div>
                )}
                {order.designDescription && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600">وصف التصميم</p>
                    <p className="text-base font-medium text-gray-900">{order.designDescription}</p>
                  </div>
                )}
                {order.notes && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600">ملاحظات</p>
                    <p className="text-base font-medium text-gray-900">{order.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Materials */}
            {order.materials && order.materials.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">المواد</h2>
                <div className="space-y-3">
                  {order.materials.map((material, index) => (
                    <div key={index} className="border-r-4 border-najd-gold pr-4">
                      <p className="font-medium text-gray-900">
                        {(MATERIAL_TYPE_LABELS as any)[material.type]}
                      </p>
                      <p className="text-sm text-gray-600">الكمية: {material.quantity}</p>
                      {material.description && (
                        <p className="text-sm text-gray-600">{material.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {order.files && order.files.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">الملفات المرفقة</h2>
                <div className="space-y-2">
                  {order.files.map((file, index) => (
                    <a
                      key={index}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition"
                    >
                      <svg
                        className="w-5 h-5 text-najd-blue"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                        />
                      </svg>
                      <span className="text-sm text-gray-900">{file.name}</span>
                      <span className="text-xs text-gray-500 mr-auto">
                        {(file.size / 1024).toFixed(2)} KB
                      </span>
                    </a>
                  ))}
                </div>
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
                  <p className="text-sm text-gray-600">تم الإنشاء بواسطة</p>
                  <p className="text-base font-medium text-gray-900">{order.createdByName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">تاريخ الإنشاء</p>
                  <p className="text-base font-medium text-gray-900">
                    {order.createdAt &&
                      format(
                        typeof order.createdAt === 'string'
                          ? new Date(order.createdAt)
                          : order.createdAt.toDate(),
                        'dd MMMM yyyy - HH:mm',
                        { locale: ar }
                      )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">آخر تحديث</p>
                  <p className="text-base font-medium text-gray-900">
                    {order.updatedAt &&
                      format(
                        typeof order.updatedAt === 'string'
                          ? new Date(order.updatedAt)
                          : order.updatedAt.toDate(),
                        'dd MMMM yyyy - HH:mm',
                        { locale: ar }
                      )}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            {user.role === 'ceo' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">إجراءات سريعة</h2>
                <div className="space-y-2">
                  {order.status === OrderStatus.PENDING_CEO_REVIEW && (
                    <>
                      <button
                        onClick={() => handleStatusUpdate(OrderStatus.PENDING_DESIGN)}
                        disabled={updating}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50"
                      >
                        الموافقة → التصميم
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(OrderStatus.REJECTED_BY_CEO)}
                        disabled={updating}
                        className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50"
                      >
                        رفض الطلب
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Quick Actions for Accounting - Price Review */}
            {user.department === 'accounting' && order.status === OrderStatus.PRINTING_COMPLETED && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">مراجعة التسعيرة</h2>
                <div className="space-y-3">
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-600">التسعيرة الأولية (من المبيعات):</p>
                    <p className="text-lg font-bold text-gray-900">{(order as any).estimatedCost?.toFixed(2) || '0.00'} ر.س</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      التسعيرة النهائية (ر.س)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={(order as any).finalCost || (order as any).estimatedCost || 0}
                      onBlur={(e) => {
                        const finalCost = parseFloat(e.target.value) || 0;
                        if (finalCost !== (order as any).finalCost) {
                          handleStatusUpdate(OrderStatus.PENDING_PAYMENT, { finalCost });
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <button
                    onClick={() => handleStatusUpdate(OrderStatus.PENDING_PAYMENT)}
                    disabled={updating}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 font-medium"
                  >
                    ✓ تأكيد التسعيرة → في انتظار الدفع
                  </button>
                </div>
              </div>
            )}

            {/* Quick Actions for Accounting - Quotations */}
            {user.department === 'accounting' && (order as any).isQuotation && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">إجراءات عروض الأسعار</h2>
                <div className="space-y-2">
                  {/* Check if quotation already exists */}
                  {!(order as any).quotationId ? (
                    <>
                      <button
                        onClick={() => router.push(`/accounting/quotations/new?orderId=${order.id}`)}
                        className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-md hover:from-blue-600 hover:to-blue-700 transition font-medium flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        إنشاء عرض سعر
                      </button>
                      <p className="text-xs text-gray-500 text-center">
                        قم بإنشاء عرض سعر لهذا الطلب
                      </p>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => router.push(`/accounting/quotations/${(order as any).quotationId}`)}
                        className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-md hover:from-green-600 hover:to-green-700 transition font-medium flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        عرض عرض السعر
                      </button>
                      <p className="text-xs text-green-600 text-center font-medium">
                        ✓ تم إنشاء عرض السعر: {(order as any).quotationNumber}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Quick Actions for Design Department */}
            {user.department === 'design' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">إجراءات التصميم</h2>
                <div className="space-y-2">
                  {order.status === OrderStatus.PENDING_DESIGN && (
                    <button
                      onClick={() => handleStatusUpdate(OrderStatus.IN_DESIGN)}
                      disabled={updating}
                      className="w-full px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition disabled:opacity-50 font-medium"
                    >
                      ▶️ بدء العمل على التصميم
                    </button>
                  )}
                  
                  {order.status === OrderStatus.IN_DESIGN && (
                    <button
                      onClick={() => handleStatusUpdate(OrderStatus.DESIGN_COMPLETED)}
                      disabled={updating}
                      className="w-full px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 font-medium"
                    >
                      ✓ إكمال التصميم
                    </button>
                  )}
                  
                  {order.status === OrderStatus.DESIGN_COMPLETED && (
                    <>
                      <p className="text-sm text-gray-700 mb-2 font-medium">اختر المسار التالي:</p>
                      
                      {/* Check materials needed */}
                      {order.materials && order.materials.some((m: any) => m.type === 'plates') && (
                        <button
                          onClick={() => handleStatusUpdate(OrderStatus.PENDING_MATERIALS)}
                          disabled={updating}
                          className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 font-medium"
                        >
                          📋 إرسال لتيم البليتات
                        </button>
                      )}
                      
                      {order.materials && order.materials.some((m: any) => m.type === 'molds') && (
                        <button
                          onClick={() => handleStatusUpdate(OrderStatus.PENDING_MATERIALS)}
                          disabled={updating}
                          className="w-full px-4 py-3 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition disabled:opacity-50 font-medium"
                        >
                          🔧 إرسال لتيم القوالب
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleStatusUpdate(OrderStatus.PENDING_PRINTING)}
                        disabled={updating}
                        className="w-full px-4 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition disabled:opacity-50 font-medium"
                      >
                        🖨️ إرسال للطباعة مباشرة
                      </button>
                      
                      <p className="text-xs text-gray-500 text-center mt-2">
                        اختر حسب المواد المطلوبة في الطلب
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Quick Actions for Printing Department */}
            {user.department === 'printing' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">إجراءات الطباعة</h2>
                <div className="space-y-2">
                  {order.status === OrderStatus.PENDING_PRINTING && (
                    <button
                      onClick={() => handleStatusUpdate(OrderStatus.IN_PRINTING)}
                      disabled={updating}
                      className="w-full px-4 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition disabled:opacity-50 font-medium"
                    >
                      ▶️ بدء الطباعة
                    </button>
                  )}
                  
                  {order.status === OrderStatus.IN_PRINTING && (
                    <button
                      onClick={() => handleStatusUpdate(OrderStatus.PRINTING_COMPLETED)}
                      disabled={updating}
                      className="w-full px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 font-medium"
                    >
                      ✓ إكمال الطباعة
                    </button>
                  )}
                  
                  {order.status === OrderStatus.PRINTING_COMPLETED && (
                    <button
                      onClick={() => handleStatusUpdate(OrderStatus.PENDING_PAYMENT)}
                      disabled={updating}
                      className="w-full px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition disabled:opacity-50 font-medium"
                    >
                      → إرسال للحسابات
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Task Assignment - للرؤساء فقط */}
            {user.isHead && order && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  تعيين المهمة 🎯
                </h2>

                {/* إذا كانت المهمة معينة */}
                {(order as any)[`assigned${user.department.charAt(0).toUpperCase() + user.department.slice(1)}`] ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">👤</span>
                      <div>
                        <p className="font-bold text-gray-900">
                          {(order as any)[`${user.department}Assignment`]?.userName || 'غير محدد'}
                        </p>
                        <p className="text-sm text-gray-600">
                          المعين لهذه المهمة
                        </p>
                      </div>
                    </div>

                    {(order as any)[`${user.department}Assignment`]?.estimatedDuration && (
                      <p className="text-sm text-gray-600 mb-2">
                        ⏱️ الوقت المتوقع: {(order as any)[`${user.department}Assignment`].estimatedDuration} ساعة
                      </p>
                    )}

                    {(order as any)[`${user.department}Assignment`]?.notes && (
                      <div className="bg-white rounded p-3 mt-2">
                        <p className="text-xs text-gray-500 mb-1">ملاحظاتك:</p>
                        <p className="text-sm text-gray-700">
                          {(order as any)[`${user.department}Assignment`].notes}
                        </p>
                      </div>
                    )}

                    {(order as any)[`${user.department}Assignment`]?.startedAt && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm text-green-600 font-medium">
                          ✓ بدأ العمل - {new Date((order as any)[`${user.department}Assignment`].startedAt).toLocaleDateString('ar-SA')}
                        </p>
                      </div>
                    )}

                    {(order as any)[`${user.department}Assignment`]?.completedAt && (
                      <div className="mt-2">
                        <p className="text-sm text-blue-600 font-medium">
                          ✅ مكتمل - الوقت الفعلي: {(order as any)[`${user.department}Assignment`].actualDuration?.toFixed(2)} ساعة
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setShowAssignmentUI(true);
                        setSelectedUserId('');
                      }}
                      className="w-full mt-4 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                    >
                      🔄 إعادة تعيين
                    </button>
                  </div>
                ) : (
                  /* إذا لم تكن معينة */
                  <div>
                    {!showAssignmentUI ? (
                      <button
                        onClick={() => setShowAssignmentUI(true)}
                        className="w-full px-4 py-3 bg-najd-blue text-white rounded-lg hover:bg-opacity-90 transition font-medium"
                      >
                        + تعيين لموظف
                      </button>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            اختر الموظف <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-najd-blue"
                          >
                            <option value="">اختر موظف...</option>
                            {teamMembers.map((member) => (
                              <option key={member.uid} value={member.uid}>
                                {member.displayName}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            الوقت المتوقع (ساعات)
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={estimatedHours}
                            onChange={(e) => setEstimatedHours(e.target.value)}
                            placeholder="مثال: 8"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-najd-blue"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            ملاحظات (اختياري)
                          </label>
                          <textarea
                            rows={3}
                            value={assignmentNotes}
                            onChange={(e) => setAssignmentNotes(e.target.value)}
                            placeholder="تعليمات خاصة، أولوية، إلخ..."
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-najd-blue"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={handleAssignTask}
                            disabled={!selectedUserId || assigning}
                            className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-medium"
                          >
                            {assigning ? 'جاري التعيين...' : '✓ تعيين'}
                          </button>
                          <button
                            onClick={() => {
                              setShowAssignmentUI(false);
                              setSelectedUserId('');
                              setEstimatedHours('');
                              setAssignmentNotes('');
                            }}
                            className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

