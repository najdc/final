/**
 * لوحة التحكم الرئيسية
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders } from '@/hooks/useOrders';
import { useNotifications } from '@/hooks/useNotifications';
import Navbar from '@/components/Layout/Navbar';
import { OrderStatus, ORDER_STATUS_LABELS, getStatusColor } from '@/types/shared';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { orders, loading: ordersLoading } = useOrders();
  const { unreadCount } = useNotifications();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    // توجيه الموظفين العاديين إلى صفحة مهامي مباشرة
    if (user && user.department && !user.isHead && 
        user.role !== 'ceo' && user.role !== 'sales' && 
        user.role !== 'sales_head' && user.department !== 'accounting') {
      router.push('/my-tasks');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-najd-blue"></div>
      </div>
    );
  }

  // إحصائيات الطلبات
  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === OrderStatus.PENDING_CEO_REVIEW).length;
  const inProgressOrders = orders.filter((o) =>
    [
      OrderStatus.IN_DESIGN,
      OrderStatus.IN_PRINTING,
      OrderStatus.MATERIALS_IN_PROGRESS,
      OrderStatus.IN_DISPATCH,
    ].includes(o.status)
  ).length;
  const completedOrders = orders.filter((o) => o.status === OrderStatus.DELIVERED).length;

  // الطلبات الأخيرة (آخر 5)
  const recentOrders = orders.slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8" dir="rtl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            مرحباً، {user.displayName}
          </h1>
          <p className="text-gray-600">نظرة عامة على النظام</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="إجمالي الطلبات"
            value={totalOrders}
            icon="📊"
            color="bg-blue-500"
          />
          <StatCard
            title="طلبات قيد المراجعة"
            value={pendingOrders}
            icon="⏳"
            color="bg-yellow-500"
          />
          <StatCard
            title="طلبات قيد التنفيذ"
            value={inProgressOrders}
            icon="🔄"
            color="bg-purple-500"
          />
          <StatCard
            title="طلبات مكتملة"
            value={completedOrders}
            icon="✅"
            color="bg-green-500"
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Orders */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">آخر الطلبات</h2>
              <button
                onClick={() => router.push('/orders')}
                className="text-sm text-najd-blue hover:underline"
              >
                عرض الكل
              </button>
            </div>

            {ordersLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-najd-blue mx-auto"></div>
              </div>
            ) : recentOrders.length === 0 ? (
              <p className="text-gray-500 text-center py-8">لا توجد طلبات بعد</p>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => router.push(`/orders/${order.id}`)}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{order.orderNumber}</p>
                      <p className="text-sm text-gray-600">{order.customerName}</p>
                    </div>
                    <div className="text-left mr-4">
                      <span
                        className="inline-block px-3 py-1 text-xs font-medium rounded-full text-white"
                        style={{ backgroundColor: getStatusColor(order.status) }}
                      >
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions Panel */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">إجراءات سريعة</h2>

            <div className="space-y-3">
              {(user.role === 'sales' || user.role === 'sales_head') && (
                <QuickActionButton
                  icon="➕"
                  label="إنشاء طلب جديد"
                  onClick={() => router.push('/orders/new')}
                  color="bg-najd-gold"
                />
              )}

              <QuickActionButton
                icon="📋"
                label="عرض كل الطلبات"
                onClick={() => router.push('/orders')}
                color="bg-najd-blue"
              />

              <QuickActionButton
                icon="🔔"
                label={`الإشعارات ${unreadCount > 0 ? `(${unreadCount})` : ''}`}
                onClick={() => router.push('/notifications')}
                color="bg-gray-600"
              />

              {user.role === 'ceo' && (
                <QuickActionButton
                  icon="👥"
                  label="إدارة المستخدمين"
                  onClick={() => router.push('/users')}
                  color="bg-purple-600"
                />
              )}
            </div>
          </div>
        </div>

        {/* Role-specific Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">معلومات القسم</h2>
          <RoleSpecificInfo user={user} orders={orders} />
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

// مكون زر الإجراء السريع
function QuickActionButton({
  icon,
  label,
  onClick,
  color,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center space-x-3 space-x-reverse ${color} text-white rounded-lg p-4 hover:opacity-90 transition`}
    >
      <span className="text-2xl">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

// معلومات خاصة بالدور
function RoleSpecificInfo({ user, orders }: { user: any; orders: any[] }) {
  const department = user.department;

  if (user.role === 'ceo') {
    const needsReview = orders.filter((o) => o.status === OrderStatus.PENDING_CEO_REVIEW).length;
    return (
      <div className="space-y-2">
        <p className="text-gray-700">
          📊 لديك <span className="font-bold text-najd-blue">{needsReview}</span> طلب يحتاج إلى مراجعتك
        </p>
      </div>
    );
  }

  if (department === 'design') {
    const designOrders = orders.filter((o) =>
      [OrderStatus.PENDING_DESIGN, OrderStatus.IN_DESIGN].includes(o.status)
    ).length;
    return (
      <div className="space-y-2">
        <p className="text-gray-700">
          🎨 لديك <span className="font-bold text-najd-blue">{designOrders}</span> طلب تصميم
        </p>
      </div>
    );
  }

  if (department === 'printing') {
    const printingOrders = orders.filter((o) =>
      [OrderStatus.PENDING_PRINTING, OrderStatus.IN_PRINTING].includes(o.status)
    ).length;
    return (
      <div className="space-y-2">
        <p className="text-gray-700">
          🖨️ لديك <span className="font-bold text-najd-blue">{printingOrders}</span> طلب طباعة
        </p>
      </div>
    );
  }

  if (department === 'accounting') {
    const paymentOrders = orders.filter((o) => o.status === OrderStatus.PENDING_PAYMENT).length;
    return (
      <div className="space-y-2">
        <p className="text-gray-700">
          💰 لديك <span className="font-bold text-najd-blue">{paymentOrders}</span> طلب يحتاج تأكيد دفع
        </p>
      </div>
    );
  }

  if (department === 'dispatch') {
    const dispatchOrders = orders.filter((o) =>
      [OrderStatus.READY_FOR_DISPATCH, OrderStatus.IN_DISPATCH].includes(o.status)
    ).length;
    return (
      <div className="space-y-2">
        <p className="text-gray-700">
          📦 لديك <span className="font-bold text-najd-blue">{dispatchOrders}</span> طلب للإرسال
        </p>
      </div>
    );
  }

  return (
    <div className="text-gray-700">
      <p>مرحباً بك في نظام إدارة شركة نجد</p>
    </div>
  );
}

