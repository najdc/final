/**
 * Task Assignment Utilities
 * بديل لـ Cloud Functions للعمل بدون Blaze Plan
 */

import { 
  doc, 
  updateDoc, 
  addDoc, 
  collection, 
  serverTimestamp,
  getDoc 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { notifyCEOTaskCompleted } from './ceoNotifications';

interface AssignTaskParams {
  orderId: string;
  userId: string;
  department: string;
  estimatedDuration?: number | null;
  notes?: string | null;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
}

/**
 * تعيين مهمة لموظف
 */
export async function assignTask(params: AssignTaskParams) {
  const {
    orderId,
    userId,
    department,
    estimatedDuration,
    notes,
    currentUserId,
    currentUserName,
    currentUserRole,
  } = params;

  try {
    // الحصول على بيانات الموظف المُعين له
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      throw new Error('الموظف المُعين غير موجود');
    }

    const user = userDoc.data();

    // التحقق من أن الموظف نشط
    if (!user.isActive) {
      throw new Error('الموظف غير نشط');
    }

    // إنشاء معلومات التعيين
    const assignment: any = {
      userId,
      userName: user.displayName,
      assignedBy: currentUserId,
      assignedByName: currentUserName,
      assignedAt: serverTimestamp(),
      startedAt: null,
      completedAt: null,
      actualDuration: null,
    };
    
    // إضافة الحقول الاختيارية فقط إذا كانت موجودة
    if (estimatedDuration !== null && estimatedDuration !== undefined) {
      assignment.estimatedDuration = estimatedDuration;
    }
    
    if (notes) {
      assignment.notes = notes;
    }

    // تحديد الحقول حسب القسم
    const updateData: any = {
      updatedAt: serverTimestamp(),
    };

    // دعم جميع الأقسام
    switch (department.toLowerCase()) {
      case 'design':
        updateData.assignedToDesign = userId;
        updateData.designAssignment = assignment;
        break;
      case 'printing':
        updateData.assignedToPrinting = userId;
        updateData.printingAssignment = assignment;
        break;
      case 'dispatch':
        updateData.assignedToDispatch = userId;
        updateData.dispatchAssignment = assignment;
        break;
      case 'accounting':
        updateData.assignedToAccounting = userId;
        updateData.accountingAssignment = assignment;
        break;
      case 'sales':
        // المبيعات: تحديث الطلب فقط
        updateData.assignedToSales = userId;
        updateData.salesAssignment = assignment;
        break;
      case 'management':
        // الإدارة: للـ CEO أو إدارة عليا
        updateData.assignedToManagement = userId;
        updateData.managementAssignment = assignment;
        break;
      default:
        // إذا كان القسم غير معروف، استخدم قسم عام
        console.warn(`⚠️ قسم غير معروف: ${department}، سيتم استخدام تعيين عام`);
        updateData[`assignedTo${department.charAt(0).toUpperCase() + department.slice(1)}`] = userId;
        updateData[`${department}Assignment`] = assignment;
    }

    // إضافة Timeline Entry
    const timelineEntry: any = {
      id: Date.now().toString(),
      action: `تم تعيين المهمة لـ ${user.displayName}`,
      userId: currentUserId,
      userName: currentUserName,
      userRole: currentUserRole,
      timestamp: new Date().toISOString(),  // ✅ استخدام ISO string بدلاً من serverTimestamp
    };
    
    // إضافة notes فقط إذا كان موجود
    if (notes) {
      timelineEntry.notes = notes;
    }

    // تحديث الطلب (استخدام array union للـ timeline)
    const orderRef = doc(db, 'orders', orderId);
    const orderDoc = await getDoc(orderRef);
    
    if (!orderDoc.exists()) {
      throw new Error('الطلب غير موجود');
    }

    const currentTimeline = orderDoc.data().timeline || [];
    updateData.timeline = [...currentTimeline, timelineEntry];

    await updateDoc(orderRef, updateData);

    // إرسال إشعار للموظف المُعين
    await addDoc(collection(db, 'notifications'), {
      type: 'task_assigned',
      title: 'مهمة جديدة تم تعيينها لك 🎯',
      message: `تم تعيين مهمة جديدة لك من قبل ${currentUserName}`,
      recipientId: userId,
      recipientRole: user.role,
      orderId,
      isRead: false,
      isActionRequired: true,
      createdAt: serverTimestamp(),
      actionUrl: `/orders/${orderId}`,
    });

    console.log(`✅ Task assigned successfully: Order ${orderId} to User ${userId}`);

    return {
      success: true,
      message: 'تم تعيين المهمة بنجاح',
      assignment,
    };
  } catch (error) {
    console.error('❌ Error assigning task:', error);
    throw error;
  }
}

/**
 * بدء العمل على مهمة
 */
export async function startTask(orderId: string, department: string) {
  try {
    const updateData: any = {
      [`${department}Assignment.startedAt`]: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, 'orders', orderId), updateData);

    console.log(`✅ Task started: Order ${orderId}`);

    return {
      success: true,
      message: 'تم بدء المهمة بنجاح',
    };
  } catch (error) {
    console.error('❌ Error starting task:', error);
    throw error;
  }
}

/**
 * إكمال مهمة
 */
/**
 * إكمال مهمة
 */
export async function completeTask(
    orderId: string,
    department: string,
    currentUserId: string,
    currentUserName: string,
    currentUserRole: string
  ) {
    try {
      // مرجع الطلب وجلبه مرة واحدة فقط
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      
      if (!orderSnap.exists()) {
        throw new Error('الطلب غير موجود');
      }
  
      const order = orderSnap.data() as any;
      const assignment = order[`${department}Assignment`];
  
      // التحقق من أن المهمة بدأت
      if (!assignment || !assignment.startedAt) {
        throw new Error('يجب بدء المهمة أولاً');
      }
  
      // startedAt قد تكون Timestamp أو تاريخ/نص — نعالج الحالتين
      const startedAt: Date =
        typeof assignment.startedAt?.toDate === 'function'
          ? assignment.startedAt.toDate()
          : new Date(assignment.startedAt);
  
      const now = new Date();
      const actualDuration = (now.getTime() - startedAt.getTime()) / (1000 * 60 * 60); // بالساعات
  
      // تحديث المهمة
      const updateData: any = {
        [`${department}Assignment.completedAt`]: serverTimestamp(),
        [`${department}Assignment.actualDuration`]: Math.round(actualDuration * 100) / 100,
        updatedAt: serverTimestamp(),
      };
  
      // إضافة Timeline Entry
      const timelineEntry = {
        id: Date.now().toString(),
        action: `أكمل ${currentUserName} المهمة`,
        userId: currentUserId,
        userName: currentUserName,
        userRole: currentUserRole,
        timestamp: new Date().toISOString(), // ISO string
        notes: `الوقت المستغرق: ${actualDuration.toFixed(2)} ساعة`,
      };
  
      const currentTimeline = order.timeline || [];
      updateData.timeline = [...currentTimeline, timelineEntry];
  
      await updateDoc(orderRef, updateData);
  
      // إرسال إشعار لرئيس القسم
      if (assignment.assignedBy) {
        await addDoc(collection(db, 'notifications'), {
          type: 'task_completed',
          title: 'مهمة مكتملة ✓',
          message: `أكمل ${currentUserName} المهمة المعينة له`,
          recipientId: assignment.assignedBy,
          orderId,
          isRead: false,
          isActionRequired: false,
          createdAt: serverTimestamp(),
          actionUrl: `/orders/${orderId}`,
        });
      }
  
      // إشعار للـ CEO — استخدم نفس snapshot بدون جلب جديد
      await notifyCEOTaskCompleted(
        currentUserName,
        department,
        order.orderNumber,
        orderId,
        Math.round(actualDuration * 100) / 100
      );
  
      console.log(`✅ Task completed: Order ${orderId} in ${actualDuration.toFixed(2)} hours`);
  
      return {
        success: true,
        message: 'تم إكمال المهمة بنجاح',
        actualDuration: Math.round(actualDuration * 100) / 100,
      };
    } catch (error) {
      console.error('❌ Error completing task:', error);
      throw error;
    }
  }
  
