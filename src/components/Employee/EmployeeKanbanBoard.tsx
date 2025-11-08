'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  priority: string;
  createdAt: any;
  estimatedCost?: number;
  finalCost?: number;
  needsDesign: boolean;
}

interface Column {
  id: string;
  title: string;
  statuses: string[];
  color: string;
  icon: string;
}

// الأعمدة حسب القسم
const getDepartmentColumns = (department: string): Column[] => {
  switch (department) {
    case 'design':
      return [
        {
          id: 'pending',
          title: 'بانتظار التصميم',
          statuses: ['pending_design'],
          color: 'bg-yellow-100 border-yellow-300',
          icon: '⏳',
        },
        {
          id: 'in_progress',
          title: 'قيد التصميم',
          statuses: ['in_design'],
          color: 'bg-blue-100 border-blue-300',
          icon: '🎨',
        },
        {
          id: 'review',
          title: 'مراجعة',
          statuses: ['design_review'],
          color: 'bg-purple-100 border-purple-300',
          icon: '👀',
        },
        {
          id: 'completed',
          title: 'مكتمل',
          statuses: ['design_completed'],
          color: 'bg-green-100 border-green-300',
          icon: '✅',
        },
      ];
    case 'printing':
      return [
        {
          id: 'pending',
          title: 'بانتظار الطباعة',
          statuses: ['pending_printing'],
          color: 'bg-yellow-100 border-yellow-300',
          icon: '⏳',
        },
        {
          id: 'in_progress',
          title: 'قيد الطباعة',
          statuses: ['in_printing'],
          color: 'bg-blue-100 border-blue-300',
          icon: '🖨️',
        },
        {
          id: 'completed',
          title: 'مكتمل',
          statuses: ['printing_completed'],
          color: 'bg-green-100 border-green-300',
          icon: '✅',
        },
      ];
    case 'accounting':
      return [
        {
          id: 'pending',
          title: 'بانتظار الدفع',
          statuses: ['pending_payment'],
          color: 'bg-yellow-100 border-yellow-300',
          icon: '⏳',
        },
        {
          id: 'confirmed',
          title: 'تم التأكيد',
          statuses: ['payment_confirmed'],
          color: 'bg-green-100 border-green-300',
          icon: '✅',
        },
      ];
    case 'dispatch':
      return [
        {
          id: 'materials',
          title: 'الخامات',
          statuses: ['pending_materials', 'materials_in_progress', 'materials_ready'],
          color: 'bg-yellow-100 border-yellow-300',
          icon: '📦',
        },
        {
          id: 'ready',
          title: 'جاهز للإرسال',
          statuses: ['ready_for_dispatch'],
          color: 'bg-blue-100 border-blue-300',
          icon: '📋',
        },
        {
          id: 'in_dispatch',
          title: 'قيد الإرسال',
          statuses: ['in_dispatch'],
          color: 'bg-purple-100 border-purple-300',
          icon: '🚚',
        },
        {
          id: 'delivered',
          title: 'تم التسليم',
          statuses: ['delivered'],
          color: 'bg-green-100 border-green-300',
          icon: '✅',
        },
      ];
    default:
      return [];
  }
};

const statusLabels: Record<string, string> = {
  pending_design: 'بانتظار التصميم',
  in_design: 'قيد التصميم',
  design_review: 'مراجعة التصميم',
  design_completed: 'التصميم مكتمل',
  pending_printing: 'بانتظار الطباعة',
  in_printing: 'قيد الطباعة',
  printing_completed: 'الطباعة مكتملة',
  pending_payment: 'بانتظار الدفع',
  payment_confirmed: 'تم تأكيد الدفع',
  pending_materials: 'بانتظار الخامات',
  materials_in_progress: 'جاري تجهيز الخامات',
  materials_ready: 'الخامات جاهزة',
  ready_for_dispatch: 'جاهز للإرسال',
  in_dispatch: 'قيد الإرسال',
  delivered: 'تم التسليم',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-200 text-gray-800',
  medium: 'bg-blue-200 text-blue-800',
  high: 'bg-orange-200 text-orange-800',
  urgent: 'bg-red-200 text-red-800',
};

const priorityLabels: Record<string, string> = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'عالية',
  urgent: 'عاجل',
};

const statusColors: Record<string, string> = {
  pending_design: 'border-purple-300 bg-purple-50',
  in_design: 'border-purple-500 bg-purple-100',
  design_review: 'border-purple-600 bg-purple-150',
  design_completed: 'border-purple-700 bg-purple-200',
  pending_printing: 'border-blue-300 bg-blue-50',
  in_printing: 'border-blue-500 bg-blue-100',
  printing_completed: 'border-blue-700 bg-blue-200',
  pending_payment: 'border-green-300 bg-green-50',
  payment_confirmed: 'border-green-600 bg-green-100',
  pending_materials: 'border-indigo-300 bg-indigo-50',
  materials_in_progress: 'border-indigo-400 bg-indigo-100',
  materials_ready: 'border-indigo-500 bg-indigo-150',
  ready_for_dispatch: 'border-indigo-600 bg-indigo-200',
  in_dispatch: 'border-cyan-500 bg-cyan-100',
  delivered: 'border-green-700 bg-green-200',
};

export default function EmployeeKanbanBoard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (!user || !user.department) return;

    // تحديد الأعمدة حسب القسم
    const deptColumns = getDepartmentColumns(user.department);
    setColumns(deptColumns);

    // الحصول على جميع الحالات للقسم
    const allStatuses = deptColumns.flatMap((col) => col.statuses);

    const ordersQuery = query(
      collection(db, 'orders'),
      where('status', 'in', allStatuses),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      const ordersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Order[];
      setOrders(ordersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const getOrdersByColumn = (columnId: string) => {
    const column = columns.find((col) => col.id === columnId);
    if (!column) return [];

    return orders.filter((order) => {
      const matchesStatus = column.statuses.includes(order.status);
      const matchesSearch = searchTerm
        ? order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.customerName.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      return matchesStatus && matchesSearch;
    });
  };

  const getColumnIdByStatus = (status: string): string | null => {
    const column = columns.find((col) => col.statuses.includes(status));
    return column?.id || null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const orderId = active.id as string;
    const targetColumnId = over.id as string;

    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const currentColumnId = getColumnIdByStatus(order.status);
    const targetColumn = columns.find((col) => col.id === targetColumnId);

    if (!targetColumn || currentColumnId === targetColumnId) return;

    const newStatus = targetColumn.statuses[0];

    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: Timestamp.now(),
      });
      toast.success(`تم تحديث حالة الطلب ${order.orderNumber}`);
    } catch (error) {
      console.error('Error moving order:', error);
      toast.error('فشل تحديث حالة الطلب');
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const activeOrder = activeId ? orders.find((o) => o.id === activeId) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-najd-blue"></div>
      </div>
    );
  }

  if (!user || !user.department) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">خطأ: لا يمكن تحديد قسمك</p>
      </div>
    );
  }

  const departmentNames: Record<string, string> = {
    design: 'التصميم',
    printing: 'الطباعة',
    accounting: 'الحسابات',
    dispatch: 'الإرسال',
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="bg-gradient-to-r from-najd-blue to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold flex items-center gap-3">
                📋 مهام {departmentNames[user.department] || user.department}
              </h2>
              <p className="text-blue-100 mt-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-sm">
                  ↔️ اسحب وأفلت
                </span>
                الطلبات بين الأعمدة لتحديث حالتها
              </p>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="🔍 بحث برقم الطلب أو اسم العميل..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-4 pr-12 py-3 border-2 border-white/30 bg-white/10 backdrop-blur-sm text-white placeholder-white/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-white focus:bg-white/20 w-80 text-base"
              />
            </div>
          </div>

          {/* Statistics */}
          <div className={`grid grid-cols-${columns.length} gap-3`}>
            {columns.map((column) => {
              const columnOrders = getOrdersByColumn(column.id);
              return (
                <div 
                  key={column.id} 
                  className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1"
                >
                  <div className="text-center">
                    <div className="text-4xl mb-2">{column.icon}</div>
                    <div className="text-sm font-semibold text-gray-700 mb-1">{column.title}</div>
                    <div className="text-3xl font-bold text-najd-blue">{columnOrders.length}</div>
                    <div className="text-xs text-gray-500 mt-1">طلبات</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Kanban Board */}
        <div className={`grid grid-cols-${columns.length} gap-4`}>
          {columns.map((column) => {
            const columnOrders = getOrdersByColumn(column.id);
            return (
              <DroppableColumn key={column.id} column={column} orders={columnOrders} />
            );
          })}
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeOrder ? (
          <div className={`rounded-2xl shadow-2xl p-6 border-4 border-najd-blue opacity-95 rotate-6 scale-110 ${statusColors[activeOrder.status] || 'bg-white'}`}>
            <div className="text-center">
              <div className="text-4xl mb-3">🚀</div>
              <div className="text-lg font-bold text-najd-blue mb-2">{activeOrder.orderNumber}</div>
              <div className="text-base text-gray-800 font-semibold mb-2">{activeOrder.customerName}</div>
              <div className="text-xs font-bold text-gray-700 bg-white/90 rounded-lg px-4 py-2 inline-block border-2 border-najd-blue">
                {statusLabels[activeOrder.status]}
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface DroppableColumnProps {
  column: Column;
  orders: Order[];
}

function DroppableColumn({ column, orders }: DroppableColumnProps) {
  const { useDroppable } = require('@dnd-kit/core');
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  return (
    <div className="flex flex-col h-full">
      <div className={`${column.color} rounded-t-2xl p-5 border-3 border-b-0 shadow-md`}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl drop-shadow-sm">{column.icon}</span>
              <h3 className="text-lg font-bold text-gray-900">{column.title}</h3>
            </div>
            <span className="bg-white rounded-full px-4 py-2 text-base font-bold text-gray-900 shadow-sm">
              {orders.length}
            </span>
          </div>
          <div className="text-xs text-gray-600 font-medium bg-white/50 rounded-lg px-3 py-1.5 inline-block">
            ⬇️ أفلت الطلبات هنا
          </div>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`${column.color} rounded-b-2xl p-3 border-3 border-t-0 flex-1 min-h-[600px] space-y-3 overflow-y-auto shadow-lg`}
      >
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <div className="text-6xl mb-4 opacity-30">📭</div>
            <div className="text-base font-medium">لا توجد طلبات</div>
            <div className="text-sm text-gray-400 mt-2">اسحب الطلبات هنا</div>
          </div>
        ) : (
          orders.map((order) => (
            <DraggableOrderCard key={order.id} order={order} />
          ))
        )}
      </div>
    </div>
  );
}

interface DraggableOrderCardProps {
  order: Order;
}

function DraggableOrderCard({ order }: DraggableOrderCardProps) {
  const { useDraggable } = require('@dnd-kit/core');
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  const statusColor = statusColors[order.status] || 'border-gray-300 bg-white';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-xl shadow-md p-4 hover:shadow-2xl transition-all duration-200 border-3 cursor-grab active:cursor-grabbing transform hover:-translate-y-1 ${statusColor} ${
        isDragging ? 'opacity-50 scale-110 rotate-2 shadow-2xl' : ''
      }`}
    >
      <div className="flex items-center justify-center mb-2 opacity-40">
        <div className="flex gap-1">
          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
        </div>
      </div>

      <div className="flex items-start justify-between mb-3">
        <Link
          href={`/orders/${order.id}`}
          className="text-base font-bold text-najd-blue hover:underline hover:text-blue-700 transition flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          📄 {order.orderNumber}
        </Link>
        <span
          className={`text-xs px-3 py-1.5 rounded-full font-bold shadow-sm ${
            priorityColors[order.priority] || priorityColors.medium
          }`}
        >
          {priorityLabels[order.priority] || order.priority}
        </span>
      </div>

      <div className="text-sm text-gray-800 mb-3 flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2">
        <span className="text-base">👤</span>
        <span className="font-semibold">{order.customerName}</span>
      </div>

      <div className="text-xs font-bold text-gray-700 mb-3 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2 inline-flex items-center gap-2 border-2 border-white shadow-sm">
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
        {statusLabels[order.status] || order.status}
      </div>

      {order.needsDesign && (
        <div className="inline-flex items-center gap-2 text-xs font-bold bg-purple-100 text-purple-800 px-3 py-2 rounded-lg border-2 border-purple-200 mb-2">
          <span className="text-base">🎨</span>
          يحتاج تصميم
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-200/50 text-xs text-gray-500 text-center font-medium">
        ⬆️ اسحب لتغيير الحالة
      </div>
    </div>
  );
}

