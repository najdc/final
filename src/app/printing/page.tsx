/**
 * لوحة موظف الطباعة - نظام Kanban للطلبات
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
  COLLECTIONS,
} from '@/types/shared';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns/format';
import { ar } from 'date-fns/locale/ar';
import toast from 'react-hot-toast';

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
    id: 'pending',
    title: 'في انتظار الطباعة',
    status: [OrderStatus.PENDING_PRINTING],
    color: 'bg-orange-100 border-orange-300',
    icon: '⏳',
  },
  {
    id: 'in_progress',
    title: 'جاري الطباعة',
    status: [OrderStatus.IN_PRINTING],
    color: 'bg-blue-100 border-blue-300',
    icon: '🖨️',
  },
  {
    id: 'completed',
    title: 'اكتملت الطباعة',
    status: [OrderStatus.PRINTING_COMPLETED],
    color: 'bg-green-100 border-green-300',
    icon: '✅',
  },
  {
    id: 'sent_to_accounting',
    title: 'تم الإرسال للحسابات',
    status: [OrderStatus.PENDING_PAYMENT],
    color: 'bg-purple-100 border-purple-300',
    icon: '💰',
  },
];

export default function PrintingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { orders, loading: ordersLoading } = useOrders();
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
    // التحقق من أن المستخدم من قسم الطباعة
    if (user && user.department !== 'printing') {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // تصفية الطلبات حسب البحث
  const filteredOrders = orders.filter((order) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.orderNumber.toLowerCase().includes(query) ||
      order.customerName.toLowerCase().includes(query) ||
      order.customerPhone.includes(query)
    );
  });

  // تحديث حالة الطلب
  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingOrderId(orderId);
    
    try {
      const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);
      
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      toast.success('تم تحديث حالة الطلب بنجاح');
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('فشل تحديث حالة الطلب');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // تجميع الطلبات حسب الأعمدة
  const getOrdersForColumn = (columnStatuses: OrderStatus[]) => {
    return filteredOrders.filter((order) => columnStatuses.includes(order.status));
  };

  // إحصائيات سريعة
  const stats = {
    pending: filteredOrders.filter((o) => o.status === OrderStatus.PENDING_PRINTING).length,
    inProgress: filteredOrders.filter((o) => o.status === OrderStatus.IN_PRINTING).length,
    completed: filteredOrders.filter((o) => o.status === OrderStatus.PRINTING_COMPLETED).length,
    total: filteredOrders.length,
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Navbar />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                🖨️ لوحة قسم الطباعة
              </h1>
              <p className="mt-2 text-gray-600">
                إدارة ومتابعة طلبات الطباعة
              </p>
            </div>

            {/* زر إدارة المخزون */}
            <button
              onClick={() => router.push('/printing/inventory')}
              className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium shadow-md flex items-center gap-2"
            >
              <span className="text-xl">📦</span>
              إدارة المخزون
            </button>
          </div>

          {/* Stats Summary */}
          <div className="flex justify-end gap-4">
            <div className="bg-orange-50 px-4 py-2 rounded-lg border border-orange-200">
              <p className="text-xs text-orange-800">في الانتظار</p>
              <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
            </div>
            <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-800">جاري الطباعة</p>
              <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
            </div>
            <div className="bg-green-50 px-4 py-2 rounded-lg border border-green-200">
              <p className="text-xs text-green-800">مكتملة</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="بحث (رقم الطلب، اسم العميل، رقم الهاتف...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {ordersLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {KANBAN_COLUMNS.map((column) => {
              const columnOrders = getOrdersForColumn(column.status);
              
              return (
                <div key={column.id} className="flex flex-col">
                  {/* Column Header */}
                  <div className={`${column.color} rounded-t-lg border-2 p-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{column.icon}</span>
                        <h2 className="font-bold text-gray-900">{column.title}</h2>
                      </div>
                      <span className="bg-white px-2 py-1 rounded-full text-sm font-bold">
                        {columnOrders.length}
                      </span>
                    </div>
                  </div>

                  {/* Column Content */}
                  <div className={`${column.color} rounded-b-lg border-2 border-t-0 p-4 flex-1 min-h-[500px] space-y-3`}>
                    {columnOrders.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">لا توجد طلبات</p>
                    ) : (
                      columnOrders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          onStatusUpdate={updateOrderStatus}
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

// بطاقة الطلب
function OrderCard({
  order,
  onStatusUpdate,
  onViewDetails,
  isUpdating,
}: {
  order: Order;
  onStatusUpdate: (orderId: string, newStatus: OrderStatus) => void;
  onViewDetails: () => void;
  isUpdating: boolean;
}): JSX.Element {
  const getNextStatus = (currentStatus: OrderStatus): OrderStatus | null => {
    switch (currentStatus) {
      case OrderStatus.PENDING_PRINTING:
        return OrderStatus.IN_PRINTING;
      case OrderStatus.IN_PRINTING:
        return OrderStatus.PRINTING_COMPLETED;
      case OrderStatus.PRINTING_COMPLETED:
        return OrderStatus.PENDING_PAYMENT;
      default:
        return null;
    }
  };

  const getActionLabel = (currentStatus: OrderStatus): string => {
    switch (currentStatus) {
      case OrderStatus.PENDING_PRINTING:
        return '▶️ بدء الطباعة';
      case OrderStatus.IN_PRINTING:
        return '✓ إكمال الطباعة';
      case OrderStatus.PRINTING_COMPLETED:
        return '→ إرسال للحسابات';
      default:
        return 'تحديث';
    }
  };

  const nextStatus = getNextStatus(order.status);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow border border-gray-200">
      {/* Order Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-gray-900">{order.orderNumber}</h3>
          <p className="text-sm text-gray-600">{order.customerName}</p>
          <p className="text-xs text-gray-500">{order.customerPhone}</p>
        </div>
        <span
          className="px-2 py-1 text-xs font-medium rounded-full text-white"
          style={{ backgroundColor: getPriorityColor(order.priority) }}
        >
          {PRIORITY_LABELS[order.priority]}
        </span>
      </div>

      {/* Order Details */}
      <div className="mb-3 space-y-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">نوع الطباعة:</span>
          <span className="font-medium text-gray-900">{PRINT_TYPE_LABELS[order.printType]}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">الكمية:</span>
          <span className="font-medium text-gray-900">{order.quantity}</span>
        </div>
        {order.requestedDeliveryDate && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">التسليم:</span>
            <span className="font-medium text-gray-900">
              {format(new Date(order.requestedDeliveryDate), 'dd/MM/yyyy')}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2">
        {nextStatus && (
          <button
            onClick={() => onStatusUpdate(order.id, nextStatus)}
            disabled={isUpdating}
            className="w-full px-3 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition disabled:opacity-50 font-medium"
          >
            {isUpdating ? 'جاري التحديث...' : getActionLabel(order.status)}
          </button>
        )}
        
        <button
          onClick={onViewDetails}
          className="w-full px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition"
        >
          عرض التفاصيل
        </button>
      </div>

      {/* Timestamp */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          تم الإنشاء: {order.createdAt && format(
            typeof order.createdAt === 'string'
              ? new Date(order.createdAt)
              : order.createdAt.toDate(),
            'dd/MM HH:mm',
            { locale: ar }
          )}
        </p>
      </div>
    </div>
  );
}


