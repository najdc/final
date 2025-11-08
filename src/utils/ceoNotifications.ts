/**
 * إشعارات فورية للـ CEO - Client Side
 * تعمل بدون Cloud Functions
 */

import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * إرسال إشعار لجميع مستخدمي CEO
 */
export async function notifyCEO(notification: {
  type: string;
  title: string;
  message: string;
  orderId?: string | null;
  actionUrl?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}) {
  try {
    // الحصول على جميع مستخدمي CEO النشطين
    const ceoQuery = query(
      collection(db, 'users'),
      where('role', '==', 'ceo'),
      where('isActive', '==', true)
    );

    const ceoSnapshot = await getDocs(ceoQuery);

    // إرسال إشعار لكل CEO
    for (const ceoDoc of ceoSnapshot.docs) {
      await addDoc(collection(db, 'notifications'), {
        type: notification.type,
        title: notification.title,
        message: notification.message,
        recipientId: ceoDoc.id,
        recipientRole: 'ceo',
        orderId: notification.orderId || null,
        isRead: false,
        isActionRequired:
          notification.priority === 'urgent' || notification.priority === 'high',
        priority: notification.priority || 'medium',
        createdAt: serverTimestamp(),
        actionUrl: notification.actionUrl || '/',
      });
    }

    console.log(`✅ تم إرسال إشعار للـ CEO: ${notification.title}`);
  } catch (error) {
    console.error('❌ خطأ في إرسال إشعار للـ CEO:', error);
  }
}

/**
 * إشعار عند تغيير حالة طلب
 */
export async function notifyCEOOrderStatusChange(
  orderNumber: string,
  customerName: string,
  status: string,
  orderId: string
) {
  const statusLabels: Record<string, string> = {
    printing_completed: 'اكتملت الطباعة',
    design_completed: 'اكتمل التصميم',
    delivered: 'تم التسليم',
    cancelled: 'تم الإلغاء',
    payment_confirmed: 'تم تأكيد الدفع',
    in_design: 'بدأ التصميم',
    in_printing: 'بدأت الطباعة',
    in_dispatch: 'بدأ التوصيل',
  };

  const label = statusLabels[status] || status;

  await notifyCEO({
    type: 'order_status_changed',
    title: `🔔 ${label}`,
    message: `الطلب ${orderNumber} - ${customerName}: ${label}`,
    orderId,
    actionUrl: `/orders/${orderId}`,
    priority: status === 'delivered' ? 'low' : 'medium',
  });
}

/**
 * إشعار عند إكمال مهمة
 */
export async function notifyCEOTaskCompleted(
  employeeName: string,
  taskType: string,
  orderNumber: string,
  orderId: string,
  duration?: number
) {
  const taskLabels: Record<string, string> = {
    design: 'التصميم',
    printing: 'الطباعة',
    dispatch: 'التوصيل',
    accounting: 'المراجعة المالية',
  };

  const label = taskLabels[taskType] || taskType;
  const durationText = duration ? ` في ${duration.toFixed(1)} ساعة` : '';

  await notifyCEO({
    type: 'task_completed',
    title: `✅ مهمة ${label} مكتملة`,
    message: `أكمل ${employeeName} ${label} للطلب ${orderNumber}${durationText}`,
    orderId,
    actionUrl: `/orders/${orderId}`,
    priority: 'low',
  });
}

/**
 * إشعار عند نفاد مادة
 */
export async function notifyCEOInventoryOutOfStock(
  itemName: string,
  department: string
) {
  const deptLabels: Record<string, string> = {
    printing: 'الطباعة',
    design: 'التصميم',
    dispatch: 'الإرسال',
  };

  await notifyCEO({
    type: 'inventory_out_of_stock',
    title: '❌ مادة نفذت من المخزون!',
    message: `${itemName} نفذ من مخزون ${deptLabels[department] || department} - يحتاج طلب فوري`,
    actionUrl: '/ceo-dashboard/inventory',
    priority: 'high',
  });
}

/**
 * إشعار عند نقص مادة
 */
export async function notifyCEOInventoryLowStock(
  itemName: string,
  quantity: number,
  unit: string,
  department: string
) {
  const deptLabels: Record<string, string> = {
    printing: 'الطباعة',
    design: 'التصميم',
    dispatch: 'الإرسال',
  };

  await notifyCEO({
    type: 'inventory_low_stock',
    title: '⚠️ مادة قاربت على النفاد',
    message: `${itemName} قليلة في ${deptLabels[department] || department} (${quantity} ${unit} فقط)`,
    actionUrl: '/ceo-dashboard/inventory',
    priority: 'medium',
  });
}


