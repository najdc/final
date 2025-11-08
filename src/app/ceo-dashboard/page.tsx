/**
 * لوحة المدير التنفيذي - مراقبة شاملة واتخاذ القرار
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders } from '@/hooks/useOrders';
import { useNotifications } from '@/hooks/useNotifications';
import Navbar from '@/components/Layout/Navbar';
import KanbanBoard from '@/components/CEO/KanbanBoard';
import {
  OrderStatus,
  Order,
  ORDER_STATUS_LABELS,
  PRINT_TYPE_LABELS,
  PRIORITY_LABELS,
  getStatusColor,
  getPriorityColor,
  OrderPriority,
  PaymentStatus,
} from '@/types/shared';
import { doc, updateDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { subDays, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';

export default function CEODashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { orders = [], loading: ordersLoading } = useOrders();
  const { unreadCount } = useNotifications();

  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [pendingQuotations, setPendingQuotations] = useState<any[]>([]);
  const [loadingQuotations, setLoadingQuotations] = useState(true);
  const [viewMode, setViewMode] = useState<'overview' | 'kanban'>('overview');
  
  // حالة المخزون
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [materialRequests, setMaterialRequests] = useState<any[]>([]);

  // التوجيه حسب الصلاحيات — بدون return من المكوّن
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && user.role !== 'ceo') {
      router.push('/dashboard');
      return;
    }
  }, [user, authLoading, router]);

  // جلب عروض الأسعار المعلقة
  useEffect(() => {
    if (!user) return;

    const fetchPendingQuotations = async () => {
      try {
        const q = query(
          collection(db, 'quotations'),
          where('status', '==', 'quotation_pending_approval')
        );

        const snapshot = await getDocs(q);
        const quotations = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setPendingQuotations(quotations);
      } catch (error) {
        console.error('Error fetching quotations:', error);
      } finally {
        setLoadingQuotations(false);
      }
    };

    fetchPendingQuotations();
  }, [user]);

  // جلب بيانات المخزون
  useEffect(() => {
    if (!user) return;

    const fetchInventoryData = async () => {
      try {
        // جلب المخزون
        const inventoryQuery = query(collection(db, 'inventory'));
        const inventorySnapshot = await getDocs(inventoryQuery);
        const inventory = inventorySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setInventoryItems(inventory);

        // جلب طلبات الخامات المعلقة
        const requestsQuery = query(
          collection(db, 'material_requests'),
          where('status', '==', 'pending_ceo_approval')
        );
        const requestsSnapshot = await getDocs(requestsQuery);
        const requests = requestsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMaterialRequests(requests);
      } catch (error) {
        console.error('Error fetching inventory data:', error);
      } finally {
        setLoadingInventory(false);
      }
    };

    fetchInventoryData();
  }, [user]);

  // لا نعمل return قبل hooks — نستخدم شرط داخل JSX
  const isLoading = authLoading || !user;

  // تصفية الطلبات حسب الفترة
  const filteredOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];

    let filtered = [...orders];
    const now = new Date();

    switch (selectedPeriod) {
      case 'today':
        filtered = filtered.filter((order) => {
          const orderDate = (order as any).createdAt?.toDate?.() || new Date((order as any).createdAt);
          return isAfter(orderDate, startOfDay(now)) && isBefore(orderDate, endOfDay(now));
        });
        break;
      case 'week':
        filtered = filtered.filter((order) => {
          const orderDate = (order as any).createdAt?.toDate?.() || new Date((order as any).createdAt);
          return isAfter(orderDate, subDays(now, 7));
        });
        break;
      case 'month':
        filtered = filtered.filter((order) => {
          const orderDate = (order as any).createdAt?.toDate?.() || new Date((order as any).createdAt);
          return isAfter(orderDate, subDays(now, 30));
        });
        break;
      case 'all':
      default:
        break;
    }

    return filtered;
  }, [orders, selectedPeriod]);

  // إحصائيات شاملة
  const stats = useMemo(() => {
    const total = filteredOrders.length;
    const needsReview = filteredOrders.filter((o) => o.status === OrderStatus.PENDING_CEO_REVIEW).length;
    const urgent = filteredOrders.filter((o) => (o as any).isUrgent || o.priority === OrderPriority.URGENT).length;

    const design = {
      pending: filteredOrders.filter((o) => o.status === OrderStatus.PENDING_DESIGN).length,
      inProgress: filteredOrders.filter((o) => o.status === OrderStatus.IN_DESIGN).length,
      completed: filteredOrders.filter((o) => o.status === OrderStatus.DESIGN_COMPLETED).length,
    };

    const printing = {
      pending: filteredOrders.filter((o) => o.status === OrderStatus.PENDING_PRINTING).length,
      inProgress: filteredOrders.filter((o) => o.status === OrderStatus.IN_PRINTING).length,
      completed: filteredOrders.filter((o) => o.status === OrderStatus.PRINTING_COMPLETED).length,
    };

    const accounting = {
      pending: filteredOrders.filter((o) => o.status === OrderStatus.PENDING_PAYMENT).length,
      confirmed: filteredOrders.filter((o) => o.status === OrderStatus.PAYMENT_CONFIRMED).length,
    };

    const dispatch = {
      ready: filteredOrders.filter((o) => o.status === OrderStatus.READY_FOR_DISPATCH).length,
      inProgress: filteredOrders.filter((o) => o.status === OrderStatus.IN_DISPATCH).length,
      delivered: filteredOrders.filter((o) => o.status === OrderStatus.DELIVERED).length,
    };

    const financial = {
      totalEstimated: filteredOrders.reduce((sum, o) => sum + ((o as any).estimatedCost || 0), 0),
      totalFinal: filteredOrders.reduce((sum, o) => sum + ((o as any).finalCost || 0), 0),
      totalPaid: filteredOrders.reduce((sum, o) => sum + ((o as any).paidAmount || 0), 0),
      pending: filteredOrders.filter((o) => (o as any).paymentStatus === PaymentStatus.PENDING).length,
    };

    const statuses = {
      cancelled: filteredOrders.filter((o) => o.status === OrderStatus.CANCELLED).length,
      onHold: filteredOrders.filter((o) => o.status === OrderStatus.ON_HOLD).length,
      rejected: filteredOrders.filter((o) => o.status === OrderStatus.REJECTED_BY_CEO).length,
      delivered: filteredOrders.filter((o) => o.status === OrderStatus.DELIVERED).length,
    };

    return {
      total,
      needsReview,
      urgent,
      design,
      printing,
      accounting,
      dispatch,
      financial,
      statuses,
    };
  }, [filteredOrders]);

  // الطلبات التي تحتاج موافقة
  const pendingApprovalOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

    return orders
      .filter((o) => o.status === OrderStatus.PENDING_CEO_REVIEW)
      .sort((a, b) => (priorityOrder[(a as any).priority] ?? 99) - (priorityOrder[(b as any).priority] ?? 99));
  }, [orders]);

  // الطلبات العاجلة
  const urgentOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    return orders.filter(
      (o) =>
        ((o as any).isUrgent || o.priority === OrderPriority.URGENT) &&
        o.status !== OrderStatus.DELIVERED &&
        o.status !== OrderStatus.CANCELLED
    );
  }, [orders]);

  // إحصائيات المخزون
  const inventoryStats = useMemo(() => {
    const total = inventoryItems.length;
    const outOfStock = inventoryItems.filter((item) => item.status === 'out_of_stock').length;
    const lowStock = inventoryItems.filter((item) => item.status === 'low_stock').length;
    const inStock = inventoryItems.filter((item) => item.status === 'in_stock').length;
    const criticalItems = inventoryItems.filter(
      (item) => item.status === 'out_of_stock' || item.status === 'low_stock'
    );

    return {
      total,
      outOfStock,
      lowStock,
      inStock,
      criticalItems,
      pendingRequests: materialRequests.length,
    };
  }, [inventoryItems, materialRequests]);

  // موافقة على طلب
  const approveOrder = async (orderId: string) => {
    try {
      const order = orders.find((o) => o.id === orderId);
      if (!order || !user) return;

      const orderRef = doc(db, 'orders', orderId);

      let nextStatus = OrderStatus.PENDING_PRINTING;
      if ((order as any).needsDesign) {
        nextStatus = OrderStatus.PENDING_DESIGN;
      }

      const timelineEntry = {
        id: `${Date.now()}_${Math.random()}`,
        status: nextStatus,
        userId: (user as any).uid,
        userName: (user as any).displayName,
        userRole: (user as any).role,
        timestamp: Timestamp.now(),
        action: 'موافقة المدير على الطلب',
      };

      await updateDoc(orderRef, {
        status: nextStatus,
        updatedAt: Timestamp.now(),
        timeline: [...(order as any).timeline, timelineEntry],
      });

      alert('تمت الموافقة على الطلب بنجاح ✓');
    } catch (error) {
      console.error('Error approving order:', error);
      alert('حدث خطأ في الموافقة على الطلب');
    }
  };

  // رفض طلب
  const rejectOrder = async (orderId: string, reason?: string) => {
    const rejectionReason = reason || prompt('سبب الرفض (اختياري):');

    try {
      const order = orders.find((o) => o.id === orderId);
      if (!order || !user) return;

      const orderRef = doc(db, 'orders', orderId);

      const timelineEntry = {
        id: `${Date.now()}_${Math.random()}`,
        status: OrderStatus.REJECTED_BY_CEO,
        userId: (user as any).uid,
        userName: (user as any).displayName,
        userRole: (user as any).role,
        timestamp: Timestamp.now(),
        action: `رفض الطلب${rejectionReason ? `: ${rejectionReason}` : ''}`,
        notes: rejectionReason || undefined,
      };

      await updateDoc(orderRef, {
        status: OrderStatus.REJECTED_BY_CEO,
        updatedAt: Timestamp.now(),
        timeline: [...(order as any).timeline, timelineEntry],
      });

      alert('تم رفض الطلب');
    } catch (error) {
      console.error('Error rejecting order:', error);
      alert('حدث خطأ في رفض الطلب');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {isLoading ? (
        <div className="min-h-[70vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-najd-blue"></div>
        </div>
      ) : (
        <main className="max-w-[1920px] mx-auto py-6 px-4 sm:px-6 lg:px-8" dir="rtl">
          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-3">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">👑 لوحة المدير التنفيذي</h1>
                <p className="text-gray-600 mt-1">مراقبة شاملة واتخاذ القرار</p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* View Mode Tabs */}
                <div className="flex gap-2 bg-white rounded-lg p-1 shadow">
                  <button
                    onClick={() => setViewMode('overview')}
                    className={`px-4 py-2 rounded-md font-medium transition ${
                      viewMode === 'overview'
                        ? 'bg-najd-blue text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    📊 نظرة عامة
                  </button>
                  <button
                    onClick={() => setViewMode('kanban')}
                    className={`px-4 py-2 rounded-md font-medium transition ${
                      viewMode === 'kanban'
                        ? 'bg-najd-blue text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    📋 لوحة التاسكات
                  </button>
                </div>

                {/* Period Filter - only show in overview mode */}
                {viewMode === 'overview' && (
                  <div className="flex gap-2">
                    {[
                      { value: 'today', label: 'اليوم' },
                      { value: 'week', label: 'آخر 7 أيام' },
                      { value: 'month', label: 'آخر 30 يوم' },
                      { value: 'all', label: 'الكل' },
                    ].map((period) => (
                      <button
                        key={period.value}
                        onClick={() => setSelectedPeriod(period.value as any)}
                        className={`px-4 py-2 rounded-lg font-medium transition ${
                          selectedPeriod === period.value
                            ? 'bg-najd-blue text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {period.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Kanban Board View */}
          {viewMode === 'kanban' ? (
            <KanbanBoard />
          ) : (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <MetricCard title="إجمالي الطلبات" value={stats.total} icon="📊" color="bg-blue-500" trend="+12%" />
            <MetricCard
              title="تحتاج موافقتك"
              value={stats.needsReview}
              icon="⏳"
              color="bg-orange-500"
              onClick={() => document.getElementById('pending-section')?.scrollIntoView({ behavior: 'smooth' })}
            />
            <MetricCard
              title="طلبات عاجلة"
              value={stats.urgent}
              icon="🔥"
              color="bg-red-500"
              onClick={() => document.getElementById('urgent-section')?.scrollIntoView({ behavior: 'smooth' })}
            />
            <MetricCard title="تم التسليم" value={stats.statuses.delivered} icon="✅" color="bg-green-500" />
          </div>

          {/* إجراءات سريعة */}
          <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">⚡ إجراءات سريعة</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <QuickActionButton
                title="إضافة مستخدم"
                icon="👤+"
                onClick={() => router.push('/users/new')}
                color="bg-najd-gold hover:bg-yellow-500 text-najd-blue"
              />
              <QuickActionButton
                title="المستخدمين"
                icon="👥"
                onClick={() => router.push('/users')}
                color="bg-gray-700 hover:bg-gray-800 text-white"
              />
              <QuickActionButton
                title="العملاء"
                icon="🏢"
                onClick={() => router.push('/customers')}
                color="bg-blue-600 hover:bg-blue-700 text-white"
              />
              <QuickActionButton
                title="المخزون"
                icon="📦"
                onClick={() => router.push('/ceo-dashboard/inventory')}
                color="bg-green-600 hover:bg-green-700 text-white"
              />
              <QuickActionButton
                title="الفواتير"
                icon="💰"
                onClick={() => router.push('/accounting/invoices')}
                color="bg-purple-600 hover:bg-purple-700 text-white"
              />
              <QuickActionButton
                title="عروض الأسعار"
                icon="📋"
                onClick={() => router.push('/quotations')}
                color="bg-orange-600 hover:bg-orange-700 text-white"
              />
            </div>
          </div>

          {/* Departments Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
            <DepartmentCard
              title="قسم التصميم"
              icon="🎨"
              color="bg-purple-500"
              stats={[
                { label: 'في الانتظار', value: stats.design.pending, color: 'text-orange-600' },
                { label: 'جاري العمل', value: stats.design.inProgress, color: 'text-blue-600' },
                { label: 'مكتمل', value: stats.design.completed, color: 'text-green-600' },
              ]}
            />
            <DepartmentCard
              title="قسم الطباعة"
              icon="🖨️"
              color="bg-indigo-500"
              stats={[
                { label: 'في الانتظار', value: stats.printing.pending, color: 'text-orange-600' },
                { label: 'جاري الطباعة', value: stats.printing.inProgress, color: 'text-blue-600' },
                { label: 'مكتمل', value: stats.printing.completed, color: 'text-green-600' },
              ]}
            />
            <DepartmentCard
              title="قسم الحسابات"
              icon="💰"
              color="bg-green-500"
              stats={[
                { label: 'في انتظار الدفع', value: stats.accounting.pending, color: 'text-orange-600' },
                { label: 'تم التأكيد', value: stats.accounting.confirmed, color: 'text-green-600' },
                { label: 'المبلغ المدفوع', value: `${stats.financial.totalPaid.toLocaleString()} ر.س`, color: 'text-blue-600' },
              ]}
            />
            <DepartmentCard
              title="قسم الإرسال"
              icon="📦"
              color="bg-cyan-500"
              stats={[
                { label: 'جاهز للإرسال', value: stats.dispatch.ready, color: 'text-orange-600' },
                { label: 'جاري الإرسال', value: stats.dispatch.inProgress, color: 'text-blue-600' },
                { label: 'تم التسليم', value: stats.dispatch.delivered, color: 'text-green-600' },
              ]}
            />
          </div>
   {/* Inventory Management Section */}
   <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                📦 متابعة المخزون
              </h2>
              <button
                onClick={() => router.push('/ceo-dashboard/inventory')}
                className="px-4 py-2 bg-najd-blue text-white rounded-lg hover:bg-opacity-90 transition text-sm font-medium"
              >
                عرض الكل →
              </button>
            </div>

            {/* إحصائيات المخزون */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <InventoryStatCard
                title="إجمالي المواد"
                value={inventoryStats.total}
                icon="📊"
                color="bg-blue-500"
              />
              <InventoryStatCard
                title="متوفر"
                value={inventoryStats.inStock}
                icon="✅"
                color="bg-green-500"
              />
              <InventoryStatCard
                title="مخزون قليل"
                value={inventoryStats.lowStock}
                icon="⚠️"
                color="bg-yellow-500"
              />
              <InventoryStatCard
                title="نفذ (عاجل)"
                value={inventoryStats.outOfStock}
                icon="❌"
                color="bg-red-500"
              />
            </div>

            {/* تنبيهات المخزون الحرجة */}
            {inventoryStats.criticalItems.length > 0 && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">🚨</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-red-900 mb-2">تنبيه: مواد تحتاج اهتمام فوري</h3>
                    <div className="space-y-2">
                      {inventoryStats.criticalItems.slice(0, 5).map((item: any) => (
                        <div key={item.id} className="flex justify-between items-center text-sm">
                          <span className="text-red-800">
                            • {item.name} - {item.department && getDepartmentLabel(item.department)}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            item.status === 'out_of_stock'
                              ? 'bg-red-200 text-red-900'
                              : 'bg-yellow-200 text-yellow-900'
                          }`}>
                            {item.status === 'out_of_stock' ? 'نفذ' : `${item.quantity} ${item.unit} فقط`}
                          </span>
                        </div>
                      ))}
                      {inventoryStats.criticalItems.length > 5 && (
                        <p className="text-sm text-red-700 font-medium mt-2">
                          + {inventoryStats.criticalItems.length - 5} مواد أخرى
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* طلبات الخامات المعلقة */}
            {materialRequests.length > 0 && (
              <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-orange-900 flex items-center gap-2">
                    📋 طلبات خامات تحتاج موافقة
                    <span className="bg-orange-500 text-white px-2 py-1 rounded-full text-xs">
                      {materialRequests.length}
                    </span>
                  </h3>
                  <button
                    onClick={() => router.push('/ceo-dashboard/material-requests')}
                    className="text-sm text-orange-700 hover:text-orange-900 font-medium"
                  >
                    عرض الكل →
                  </button>
                </div>
                <div className="space-y-2">
                  {materialRequests.slice(0, 3).map((request: any) => (
                    <div key={request.id} className="bg-white rounded p-3 text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-900">{request.requestNumber}</p>
                          <p className="text-gray-600 text-xs">من: {request.departmentName}</p>
                        </div>
                        <button
                          onClick={() => router.push('/ceo-dashboard/material-requests')}
                          className="px-3 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700"
                        >
                          مراجعة
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* الروابط السريعة */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={() => router.push('/ceo-dashboard/inventory')}
                className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
              >
                📦 إدارة المخزونات
              </button>
              <button
                onClick={() => router.push('/ceo-dashboard/material-requests')}
                className="p-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition text-sm font-medium"
              >
                📋 طلبات الخامات
              </button>
            </div>
          </div>
          {/* Financial Overview */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">💵 نظرة عامة مالية</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FinancialMetric label="التكلفة المقدرة" value={stats.financial.totalEstimated} color="text-gray-700" />
              <FinancialMetric label="التكلفة النهائية" value={stats.financial.totalFinal} color="text-blue-700" />
              <FinancialMetric label="المبلغ المدفوع" value={stats.financial.totalPaid} color="text-green-700" />
              <FinancialMetric
                label="المبلغ المتبقي"
                value={stats.financial.totalFinal - stats.financial.totalPaid}
                color="text-orange-700"
              />
            </div>
          </div>

          {/* Pending Quotations Section */}
          {pendingQuotations.length > 0 && (
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg shadow-lg p-6 mb-6 border-2 border-yellow-300">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  💰 عروض أسعار تحتاج موافقة
                  <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm">
                    {pendingQuotations.length}
                  </span>
                </h2>
              </div>

              <div className="space-y-3">
                {pendingQuotations.map((quotation) => (
                  <div key={quotation.id} className="bg-white rounded-lg p-4 shadow border-r-4 border-orange-500">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-gray-900">{quotation.quotationNumber}</h3>
                        <p className="text-sm text-gray-600">للطلب: {quotation.relatedOrderNumber}</p>
                        <p className="text-sm text-gray-600">العميل: {quotation.customerName}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-lg font-bold text-blue-600">{quotation.totalAmount?.toFixed(2)} ر.س</p>
                        <p className="text-xs text-gray-500">أعده: {quotation.preparedByName}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => router.push(`/accounting/quotations/${quotation.id}`)}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm font-medium"
                      >
                        📄 مراجعة عرض السعر
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

       

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            {/* Pending Approval Orders */}
            <div id="pending-section" className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  ⏳ طلبات تحتاج موافقة
                  {stats.needsReview > 0 && (
                    <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm">{stats.needsReview}</span>
                  )}
                </h2>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {pendingApprovalOrders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">لا توجد طلبات تحتاج موافقة</div>
                ) : (
                  pendingApprovalOrders.map((order) => (
                    <ApprovalOrderCard
                      key={order.id}
                      order={order}
                      onApprove={() => approveOrder(order.id)}
                      onReject={() => rejectOrder(order.id)}
                      onView={() => router.push(`/orders/${order.id}`)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Urgent Orders */}
            <div id="urgent-section" className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  🔥 الطلبات العاجلة
                  {urgentOrders.length > 0 && (
                    <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm">{urgentOrders.length}</span>
                  )}
                </h2>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {urgentOrders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">لا توجد طلبات عاجلة</div>
                ) : (
                  urgentOrders.map((order) => (
                    <UrgentOrderCard key={order.id} order={order} onView={() => router.push(`/orders/${order.id}`)} />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Status Distribution */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">📈 توزيع حالات الطلبات</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <StatusBadge label="ملغي" value={stats.statuses.cancelled} color="bg-red-100 text-red-800" />
              <StatusBadge label="معلق" value={stats.statuses.onHold} color="bg-yellow-100 text-yellow-800" />
              <StatusBadge label="مرفوض" value={stats.statuses.rejected} color="bg-red-100 text-red-800" />
              <StatusBadge label="تم التسليم" value={stats.statuses.delivered} color="bg-green-100 text-green-800" />
              <StatusBadge label="تحتاج موافقة" value={stats.needsReview} color="bg-orange-100 text-orange-800" />
              <StatusBadge label="عاجل" value={stats.urgent} color="bg-red-100 text-red-800" />
            </div>
          </div>
            </>
          )}
        </main>
      )}
    </div>
  );
}

/* ==== المكونات الفرعية ==== */

interface MetricCardProps {
  title: string;
  value: number;
  icon: string;
  color: string;
  trend?: string;
  onClick?: () => void;
}
function MetricCard({ title, value, icon, color, trend, onClick }: MetricCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg shadow-lg p-6 ${onClick ? 'cursor-pointer hover:shadow-xl' : ''} transition`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-4xl font-bold text-gray-900">{value}</p>
          {trend && <p className="text-sm text-green-600 mt-1">{trend}</p>}
        </div>
        <div className={`w-16 h-16 ${color} rounded-full flex items-center justify-center text-3xl`}>{icon}</div>
      </div>
    </div>
  );
}

interface DepartmentCardProps {
  title: string;
  icon: string;
  color: string;
  stats: Array<{ label: string; value: number | string; color: string }>;
}
function DepartmentCard({ title, icon, color, stats }: DepartmentCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-12 h-12 ${color} rounded-full flex items-center justify-center text-2xl`}>{icon}</div>
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      </div>
      <div className="space-y-2">
        {stats.map((stat, index) => (
          <div key={index} className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{stat.label}</span>
            <span className={`text-lg font-bold ${stat.color}`}>{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface FinancialMetricProps {
  label: string;
  value: number;
  color: string;
}
function FinancialMetric({ label, value, color }: FinancialMetricProps) {
  return (
    <div className="text-center">
      <p className="text-sm text-gray-600 mb-2">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()} ر.س</p>
    </div>
  );
}

interface ApprovalOrderCardProps {
  order: Order;
  onApprove: () => void;
  onReject: () => void;
  onView: () => void;
}
function ApprovalOrderCard({ order, onApprove, onReject, onView }: ApprovalOrderCardProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-gray-900">{order.orderNumber}</span>
            <span
              className="text-xs font-medium px-2 py-1 rounded-full text-white"
              style={{ backgroundColor: getPriorityColor(order.priority) }}
            >
              {PRIORITY_LABELS[order.priority]}
            </span>
          </div>
          <div className="text-sm text-gray-600">{order.customerName}</div>
          <div className="text-xs text-gray-500">{order.customerPhone}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
        <div>🖨️ {PRINT_TYPE_LABELS[order.printType]}</div>
        <div>📦 الكمية: {order.quantity}</div>
        {order.estimatedCost && <div>💰 {order.estimatedCost.toLocaleString()} ر.س</div>}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="flex-1 bg-green-500 text-white py-2 px-3 rounded text-sm font-medium hover:bg-green-600 transition"
        >
          ✓ موافقة
        </button>
        <button
          onClick={onReject}
          className="flex-1 bg-red-500 text-white py-2 px-3 rounded text-sm font-medium hover:bg-red-600 transition"
        >
          ✗ رفض
        </button>
        <button
          onClick={onView}
          className="bg-gray-200 text-gray-700 py-2 px-4 rounded text-sm font-medium hover:bg-gray-300 transition"
        >
          عرض
        </button>
      </div>
    </div>
  );
}

interface UrgentOrderCardProps {
  order: Order;
  onView: () => void;
}
function UrgentOrderCard({ order, onView }: UrgentOrderCardProps) {
  return (
    <div className="border-2 border-red-300 bg-red-50 rounded-lg p-4 hover:shadow-md transition">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🔥</span>
            <span className="font-bold text-gray-900">{order.orderNumber}</span>
          </div>
          <div className="text-sm text-gray-700">{order.customerName}</div>
        </div>
        <span
          className="text-xs font-medium px-3 py-1 rounded-full text-white"
          style={{ backgroundColor: getStatusColor(order.status) }}
        >
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      <div className="text-xs text-gray-600 mb-3">📱 {order.customerPhone}</div>

      <button
        onClick={onView}
        className="w-full bg-red-600 text-white py-2 rounded text-sm font-medium hover:bg-red-700 transition"
      >
        عرض التفاصيل
      </button>
    </div>
  );
}

interface StatusBadgeProps {
  label: string;
  value: number;
  color: string;
}
function StatusBadge({ label, value, color }: StatusBadgeProps) {
  return (
    <div className={`${color} rounded-lg p-4 text-center`}>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-sm font-medium">{label}</div>
    </div>
  );
}

// مكون إحصائيات المخزون
interface InventoryStatCardProps {
  title: string;
  value: number;
  icon: string;
  color: string;
}
function InventoryStatCard({ title, value, icon, color }: InventoryStatCardProps) {
  return (
    <div className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:shadow-md transition">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`w-14 h-14 ${color} rounded-full flex items-center justify-center text-2xl`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// دالة للحصول على اسم القسم بالعربي
function getDepartmentLabel(dept: string): string {
  const labels: Record<string, string> = {
    printing: 'الطباعة',
    design: 'التصميم',
    dispatch: 'الإرسال',
    accounting: 'الحسابات',
    sales: 'المبيعات',
    management: 'الإدارة',
  };
  return labels[dept] || dept;
}

// مكون زر الإجراء السريع
interface QuickActionButtonProps {
  title: string;
  icon: string;
  onClick: () => void;
  color: string;
}
function QuickActionButton({ title, icon, onClick, color }: QuickActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`${color} rounded-lg p-3 transition-all shadow-md hover:shadow-lg active:scale-95 font-medium`}
    >
      <div className="flex flex-col items-center gap-1">
        <span className="text-2xl">{icon}</span>
        <span className="text-xs sm:text-sm">{title}</span>
      </div>
    </button>
  );
}
