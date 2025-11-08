/**
 * لوحة المصمم - نظام Kanban للطلبات
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders } from '@/hooks/useOrders';
import Navbar from '@/components/Layout/Navbar';
import {
  OrderStatus,
  Order,
  PRINT_TYPE_LABELS,
  PRIORITY_LABELS,
  getPriorityColor,
} from '@/types/shared';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns/format';
import { ar } from 'date-fns/locale/ar';

// دالة للحصول على نص الإجراء
function getStatusActionLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    [OrderStatus.PENDING_DESIGN]: 'في انتظار التصميم',
    [OrderStatus.IN_DESIGN]: 'بدء العمل على التصميم',
    [OrderStatus.DESIGN_REVIEW]: 'إرسال التصميم للمراجعة',
    [OrderStatus.DESIGN_COMPLETED]: 'اكتمال التصميم',
    [OrderStatus.PENDING_MATERIALS]: 'إرسال للمواد (المندوب)',
    [OrderStatus.MATERIALS_IN_PROGRESS]: 'جاري تجهيز المواد',
    [OrderStatus.DRAFT]: 'مسودة',
    [OrderStatus.PENDING_CEO_REVIEW]: 'في انتظار مراجعة المدير',
    [OrderStatus.REJECTED_BY_CEO]: 'مرفوض من المدير',
    [OrderStatus.RETURNED_TO_SALES]: 'معاد للمبيعات',
    [OrderStatus.MATERIALS_READY]: 'المواد جاهزة',
    [OrderStatus.PENDING_PRINTING]: 'في انتظار الطباعة',
    [OrderStatus.IN_PRINTING]: 'جاري الطباعة',
    [OrderStatus.PRINTING_COMPLETED]: 'الطباعة مكتملة',
    [OrderStatus.PENDING_PAYMENT]: 'في انتظار الدفع',
    [OrderStatus.PAYMENT_CONFIRMED]: 'تم تأكيد الدفع',
    [OrderStatus.READY_FOR_DISPATCH]: 'جاهز للإرسال',
    [OrderStatus.IN_DISPATCH]: 'جاري الإرسال',
    [OrderStatus.DELIVERED]: 'تم التسليم',
    [OrderStatus.CANCELLED]: 'ملغي',
    [OrderStatus.ON_HOLD]: 'معلق',
  };
  return labels[status] || 'تحديث الحالة';
}

// تعريف الأعمدة
interface KanbanColumn {
  id: string;
  title: string;
  status: OrderStatus[];
  color: string;
  icon: string;
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: 'new',
    title: 'الطلبات الجديدة',
    status: [OrderStatus.PENDING_DESIGN],
    color: 'bg-orange-100 border-orange-300',
    icon: '📋',
  },
  {
    id: 'in_progress',
    title: 'جاري العمل',
    status: [OrderStatus.IN_DESIGN, OrderStatus.DESIGN_REVIEW],
    color: 'bg-blue-100 border-blue-300',
    icon: '🎨',
  },
  {
    id: 'completed',
    title: 'تم الانتهاء',
    status: [OrderStatus.DESIGN_COMPLETED],
    color: 'bg-green-100 border-green-300',
    icon: '✅',
  },
  {
    id: 'sent',
    title: 'تم الإرسال',
    status: [OrderStatus.PENDING_MATERIALS, OrderStatus.MATERIALS_IN_PROGRESS, OrderStatus.PENDING_PRINTING],
    color: 'bg-purple-100 border-purple-300',
    icon: '📦',
  },
];

export default function DesignerPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { orders, loading: ordersLoading } = useOrders();
  const [draggedOrder, setDraggedOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
    // التحقق من أن المستخدم من قسم التصميم
    if (user && user.department !== 'design') {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-najd-blue"></div>
      </div>
    );
  }

  // تصفية الطلبات حسب قسم التصميم
  const designOrders = orders.filter((order) =>
    [
      OrderStatus.PENDING_DESIGN,
      OrderStatus.IN_DESIGN,
      OrderStatus.DESIGN_REVIEW,
      OrderStatus.DESIGN_COMPLETED,
      OrderStatus.PENDING_MATERIALS,
      OrderStatus.MATERIALS_IN_PROGRESS,
    ].includes(order.status)
  );

  // تصفية حسب البحث
  const filteredOrders = designOrders.filter((order) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.orderNumber.toLowerCase().includes(query) ||
      order.customerName.toLowerCase().includes(query) ||
      order.customerPhone.includes(query)
    );
  });

  // دالة لتحديث حالة الطلب
  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      const orderRef = doc(db, 'orders', orderId);
      
      // إنشاء timeline entry
      const timelineEntry = {
        id: `${Date.now()}_${Math.random()}`,
        status: newStatus,
        userId: user.uid,
        userName: user.displayName,
        userRole: user.role,
        timestamp: Timestamp.now(),
        action: getStatusActionLabel(newStatus),
      };

      // تحديث الطلب
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: Timestamp.now(),
        timeline: [...order.timeline, timelineEntry],
      });

      // رسالة نجاح
      setSuccessMessage('تم تحديث الحالة بنجاح ✓');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('حدث خطأ في تحديث حالة الطلب');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // دالة السحب
  const handleDragStart = (order: Order) => {
    setDraggedOrder(order);
  };

  // دالة الإفلات
  const handleDrop = async (columnId: string) => {
    if (!draggedOrder) return;

    const column = KANBAN_COLUMNS.find((col) => col.id === columnId);
    if (!column) return;

    // تحديد الحالة الجديدة بناءً على العمود
    let newStatus: OrderStatus = draggedOrder.status;

    switch (columnId) {
      case 'new':
        newStatus = OrderStatus.PENDING_DESIGN;
        break;
      case 'in_progress':
        newStatus = OrderStatus.IN_DESIGN;
        break;
      case 'completed':
        newStatus = OrderStatus.DESIGN_COMPLETED;
        break;
      case 'dispatched':
        newStatus = OrderStatus.PENDING_MATERIALS;
        break;
    }

    // تحديث الحالة إذا تغيرت
    if (newStatus !== draggedOrder.status) {
      await updateOrderStatus(draggedOrder.id, newStatus);
    }

    setDraggedOrder(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // إحصائيات
  const stats = {
    total: filteredOrders.length,
    new: filteredOrders.filter((o) => o.status === OrderStatus.PENDING_DESIGN).length,
    inProgress: filteredOrders.filter((o) =>
      [OrderStatus.IN_DESIGN, OrderStatus.DESIGN_REVIEW].includes(o.status)
    ).length,
    completed: filteredOrders.filter((o) => o.status === OrderStatus.DESIGN_COMPLETED).length,
    dispatched: filteredOrders.filter((o) =>
      [OrderStatus.PENDING_MATERIALS, OrderStatus.MATERIALS_IN_PROGRESS].includes(o.status)
    ).length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-[1800px] mx-auto py-6 px-4 sm:px-6 lg:px-8" dir="rtl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🎨 لوحة المصمم</h1>
              <p className="text-gray-600 mt-1">إدارة طلبات التصميم</p>
            </div>

            {/* Statistics */}
            <div className="flex gap-4">
              <StatBadge label="الإجمالي" value={stats.total} color="bg-gray-500" />
              <StatBadge label="جديد" value={stats.new} color="bg-orange-500" />
              <StatBadge label="قيد العمل" value={stats.inProgress} color="bg-blue-500" />
              <StatBadge label="مكتمل" value={stats.completed} color="bg-green-500" />
            </div>
          </div>

          {/* Search */}
          <div className="max-w-md">
            <input
              type="text"
              placeholder="بحث برقم الطلب أو اسم العميل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-najd-blue focus:border-transparent"
            />
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce">
            {successMessage}
          </div>
        )}

        {/* Kanban Board */}
        {ordersLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-najd-blue mx-auto"></div>
            <p className="mt-4 text-gray-600">جاري تحميل الطلبات...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {KANBAN_COLUMNS.map((column) => {
              const columnOrders = filteredOrders.filter((order) =>
                column.status.includes(order.status)
              );

              return (
                <div
                  key={column.id}
                  className={`rounded-lg border-2 ${column.color} p-4 min-h-[600px]`}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(column.id)}
                >
                  {/* Column Header */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{column.icon}</span>
                        <h2 className="text-lg font-bold text-gray-800">{column.title}</h2>
                      </div>
                      <span className="bg-white px-2 py-1 rounded-full text-sm font-bold text-gray-700">
                        {columnOrders.length}
                      </span>
                    </div>
                  </div>

                  {/* Column Content */}
                  <div className="space-y-3">
                    {columnOrders.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        لا توجد طلبات
                      </div>
                    ) : (
                      columnOrders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          onDragStart={() => handleDragStart(order)}
                          onUpdateStatus={updateOrderStatus}
                          onViewDetails={() => router.push(`/orders/${order.id}`)}
                          isUpdating={updatingOrderId === order.id}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

// مكون بطاقة الطلب
interface OrderCardProps {
  order: Order;
  onDragStart: () => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  onViewDetails: () => void;
  isUpdating?: boolean;
}

function OrderCard({ order, onDragStart, onUpdateStatus, onViewDetails, isUpdating }: OrderCardProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      draggable={!isUpdating}
      onDragStart={onDragStart}
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-move hover:shadow-md transition-shadow ${
        isUpdating ? 'opacity-50 cursor-wait' : ''
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Order Number & Priority */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="font-bold text-gray-900 text-sm mb-1">{order.orderNumber}</div>
          <div className="text-xs text-gray-600">{order.customerName}</div>
        </div>
        <span
          className="text-xs font-medium px-2 py-1 rounded-full text-white"
          style={{ backgroundColor: getPriorityColor(order.priority) }}
        >
          {PRIORITY_LABELS[order.priority]}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-1 text-xs text-gray-600 mb-3">
        <div>📱 {order.customerPhone}</div>
        <div>🖨️ {PRINT_TYPE_LABELS[order.printType]}</div>
        <div>📦 الكمية: {order.quantity}</div>
        {order.designDescription && (
          <div className="text-gray-500 line-clamp-2 mt-2">
            {order.designDescription}
          </div>
        )}
      </div>

      {/* Date */}
      <div className="text-xs text-gray-500 mb-3">
        🕒{' '}
        {order.createdAt &&
          format(
            typeof order.createdAt === 'string'
              ? new Date(order.createdAt)
              : order.createdAt.toDate(),
            'dd MMM yyyy - HH:mm',
            { locale: ar }
          )}
      </div>

      {/* Actions */}
      {showActions && (
        <div className="space-y-2 mt-3 pt-3 border-t border-gray-200">
          <button
            onClick={onViewDetails}
            className="w-full text-xs bg-najd-blue text-white py-2 rounded hover:bg-blue-700 transition"
          >
            عرض التفاصيل
          </button>

          {/* Quick Status Change Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {order.status === OrderStatus.PENDING_DESIGN && (
              <button
                onClick={() => onUpdateStatus(order.id, OrderStatus.IN_DESIGN)}
                className="text-xs bg-blue-500 text-white py-1 rounded hover:bg-blue-600 transition"
              >
                بدء العمل
              </button>
            )}

            {order.status === OrderStatus.IN_DESIGN && (
              <>
                <button
                  onClick={() => onUpdateStatus(order.id, OrderStatus.DESIGN_REVIEW)}
                  className="text-xs bg-yellow-500 text-white py-1 rounded hover:bg-yellow-600 transition"
                >
                  للمراجعة
                </button>
                <button
                  onClick={() => onUpdateStatus(order.id, OrderStatus.DESIGN_COMPLETED)}
                  className="text-xs bg-green-500 text-white py-1 rounded hover:bg-green-600 transition"
                >
                  إنهاء
                </button>
              </>
            )}

            {order.status === OrderStatus.DESIGN_REVIEW && (
              <>
                <button
                  onClick={() => onUpdateStatus(order.id, OrderStatus.IN_DESIGN)}
                  className="text-xs bg-blue-500 text-white py-1 rounded hover:bg-blue-600 transition"
                >
                  للتعديل
                </button>
                <button
                  onClick={() => onUpdateStatus(order.id, OrderStatus.DESIGN_COMPLETED)}
                  className="text-xs bg-green-500 text-white py-1 rounded hover:bg-green-600 transition"
                >
                  موافقة
                </button>
              </>
            )}

            {order.status === OrderStatus.DESIGN_COMPLETED && (
              <button
                onClick={() => onUpdateStatus(order.id, OrderStatus.PENDING_MATERIALS)}
                className="text-xs col-span-2 bg-purple-500 text-white py-1 rounded hover:bg-purple-600 transition"
              >
                إرسال للمندوب
              </button>
            )}
          </div>
        </div>
      )}

      {/* Urgent Badge */}
      {order.isUrgent && (
        <div className="mt-2 flex items-center gap-1 text-xs text-red-600 font-medium">
          <span>🔥</span>
          <span>طلب عاجل</span>
        </div>
      )}
    </div>
  );
}

// مكون إحصائية صغيرة
function StatBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
      <div className={`w-3 h-3 rounded-full ${color}`}></div>
      <div className="text-sm">
        <span className="text-gray-600">{label}: </span>
        <span className="font-bold text-gray-900">{value}</span>
      </div>
    </div>
  );
}

