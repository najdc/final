/**
 * دوال مساعدة لإدارة المخزون
 */

import { doc, updateDoc, addDoc, collection, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';

export interface OrderInventoryMaterial {
  id: string;
  inventoryItemId: string;
  itemName: string;
  category: string;
  department: string;
  quantityUsed: number;
  unit: string;
  notes?: string;
}

/**
 * تقليل المخزون عند إنشاء طلب
 */
export async function decreaseInventory(
  materials: OrderInventoryMaterial[],
  orderId: string,
  orderNumber: string,
  performedBy: string,
  performedByName: string
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const material of materials) {
    try {
      // الحصول على بيانات العنصر الحالية
      const itemRef = doc(db, 'inventory', material.inventoryItemId);
      const itemDoc = await getDoc(itemRef);

      if (!itemDoc.exists()) {
        errors.push(`الخامة ${material.itemName} غير موجودة في المخزون`);
        continue;
      }

      const itemData = itemDoc.data();
      const currentQuantity = itemData.quantity || 0;

      // التحقق من توفر الكمية
      if (currentQuantity < material.quantityUsed) {
        errors.push(`الكمية المتوفرة من ${material.itemName} غير كافية (المتوفر: ${currentQuantity}, المطلوب: ${material.quantityUsed})`);
        continue;
      }

      // حساب الكمية الجديدة
      const newQuantity = currentQuantity - material.quantityUsed;

      // تحديد الحالة الجديدة
      let newStatus = itemData.status;
      const minQuantity = itemData.minQuantity || 0;

      if (newQuantity === 0) {
        newStatus = 'out_of_stock';
      } else if (newQuantity <= minQuantity) {
        newStatus = 'low_stock';
      } else {
        newStatus = 'in_stock';
      }

      // تحديث المخزون
      await updateDoc(itemRef, {
        quantity: newQuantity,
        status: newStatus,
        updatedAt: Timestamp.now(),
      });

      // إنشاء سجل حركة المخزون
      await addDoc(collection(db, 'inventory_transactions'), {
        inventoryItemId: material.inventoryItemId,
        type: 'out',
        quantity: material.quantityUsed,
        previousQuantity: currentQuantity,
        newQuantity,
        reason: `استخدام في طلب ${orderNumber}`,
        relatedOrderId: orderId,
        performedBy,
        performedByName,
        notes: material.notes || null,
        createdAt: Timestamp.now(),
      });

      console.log(`✅ تم تقليل ${material.itemName} بمقدار ${material.quantityUsed}`);
    } catch (error) {
      console.error(`Error decreasing inventory for ${material.itemName}:`, error);
      errors.push(`فشل تحديث ${material.itemName}: ${(error as Error).message}`);
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * التحقق من توفر الخامات قبل إنشاء الطلب
 */
export async function checkMaterialsAvailability(
  materials: OrderInventoryMaterial[]
): Promise<{
  available: boolean;
  missingMaterials: {
    itemName: string;
    category: string;
    requestedQuantity: number;
    availableQuantity: number;
    unit: string;
  }[];
}> {
  const missingMaterials: {
    itemName: string;
    category: string;
    requestedQuantity: number;
    availableQuantity: number;
    unit: string;
  }[] = [];

  for (const material of materials) {
    try {
      const itemRef = doc(db, 'inventory', material.inventoryItemId);
      const itemDoc = await getDoc(itemRef);

      if (!itemDoc.exists()) {
        missingMaterials.push({
          itemName: material.itemName,
          category: material.category,
          requestedQuantity: material.quantityUsed,
          availableQuantity: 0,
          unit: material.unit,
        });
        continue;
      }

      const itemData = itemDoc.data();
      const currentQuantity = itemData.quantity || 0;

      if (currentQuantity < material.quantityUsed) {
        missingMaterials.push({
          itemName: material.itemName,
          category: material.category,
          requestedQuantity: material.quantityUsed,
          availableQuantity: currentQuantity,
          unit: material.unit,
        });
      }
    } catch (error) {
      console.error(`Error checking availability for ${material.itemName}:`, error);
      missingMaterials.push({
        itemName: material.itemName,
        category: material.category,
        requestedQuantity: material.quantityUsed,
        availableQuantity: 0,
        unit: material.unit,
      });
    }
  }

  return {
    available: missingMaterials.length === 0,
    missingMaterials,
  };
}

/**
 * إعادة الخامات للمخزون (عند إلغاء طلب)
 */
export async function returnInventory(
  materials: OrderInventoryMaterial[],
  orderId: string,
  orderNumber: string,
  performedBy: string,
  performedByName: string
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const material of materials) {
    try {
      const itemRef = doc(db, 'inventory', material.inventoryItemId);
      const itemDoc = await getDoc(itemRef);

      if (!itemDoc.exists()) {
        errors.push(`الخامة ${material.itemName} غير موجودة في المخزون`);
        continue;
      }

      const itemData = itemDoc.data();
      const currentQuantity = itemData.quantity || 0;
      const newQuantity = currentQuantity + material.quantityUsed;

      // تحديد الحالة الجديدة
      let newStatus = itemData.status;
      const minQuantity = itemData.minQuantity || 0;

      if (newQuantity > minQuantity) {
        newStatus = 'in_stock';
      }

      // تحديث المخزون
      await updateDoc(itemRef, {
        quantity: newQuantity,
        status: newStatus,
        updatedAt: Timestamp.now(),
      });

      // إنشاء سجل حركة المخزون
      await addDoc(collection(db, 'inventory_transactions'), {
        inventoryItemId: material.inventoryItemId,
        type: 'in',
        quantity: material.quantityUsed,
        previousQuantity: currentQuantity,
        newQuantity,
        reason: `إرجاع من طلب ملغى ${orderNumber}`,
        relatedOrderId: orderId,
        performedBy,
        performedByName,
        notes: material.notes || null,
        createdAt: Timestamp.now(),
      });

      console.log(`✅ تم إرجاع ${material.itemName} بمقدار ${material.quantityUsed}`);
    } catch (error) {
      console.error(`Error returning inventory for ${material.itemName}:`, error);
      errors.push(`فشل إرجاع ${material.itemName}: ${(error as Error).message}`);
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}


