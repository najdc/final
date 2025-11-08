/**
 * Hook لإدارة الطلبات
 */

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, OrderStatus, COLLECTIONS } from '@/types/shared';
import { useAuth } from '@/contexts/AuthContext';

export function useOrders(status?: OrderStatus) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // قسم الحسابات يحتاج معاملة خاصة لطلبات عروض الأسعار
      if (user.department === 'accounting' && user.role !== 'ceo' && !user.isHead) {
        // استعلامين منفصلين: واحد للحالات العادية وواحد لطلبات عروض الأسعار
        const unsubscribers: (() => void)[] = [];
        let orders1: Order[] = [];
        let orders2: Order[] = [];
        let loaded1 = false;
        let loaded2 = false;
        
        const mergeAndSetOrders = () => {
          if (loaded1 && loaded2) {
            // دمج الطلبات وإزالة المكررات
            const allOrders = [...orders1, ...orders2];
            const uniqueOrders = Array.from(
              new Map(allOrders.map(order => [order.id, order])).values()
            );
            // ترتيب حسب التاريخ
            uniqueOrders.sort((a, b) => {
              const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return dateB - dateA;
            });
            setOrders(uniqueOrders);
            setLoading(false);
          }
        };
        
        // استعلام 1: الطلبات في حالات الحسابات العادية
        const constraints1: QueryConstraint[] = [
          where('status', 'in', [OrderStatus.PENDING_PAYMENT, OrderStatus.PAYMENT_CONFIRMED]),
          orderBy('createdAt', 'desc')
        ];
        
        if (status) {
          constraints1.push(where('status', '==', status));
        }
        
        const q1 = query(collection(db, COLLECTIONS.ORDERS), ...constraints1);
        
        const unsub1 = onSnapshot(
          q1,
          (snapshot) => {
            orders1 = snapshot.docs.map((doc) => ({
              ...doc.data(),
              id: doc.id,
            })) as Order[];
            
            loaded1 = true;
            mergeAndSetOrders();
          },
          (err) => {
            console.error('Error fetching orders (payment status):', err);
            loaded1 = true;
            orders1 = [];
            mergeAndSetOrders();
          }
        );
        
        // استعلام 2: طلبات عروض الأسعار
        const constraints2: QueryConstraint[] = [
          where('isQuotation', '==', true),
          orderBy('createdAt', 'desc')
        ];
        
        if (status) {
          constraints2.push(where('status', '==', status));
        }
        
        const q2 = query(collection(db, COLLECTIONS.ORDERS), ...constraints2);
        
        const unsub2 = onSnapshot(
          q2,
          (snapshot) => {
            orders2 = snapshot.docs.map((doc) => ({
              ...doc.data(),
              id: doc.id,
            })) as Order[];
            
            loaded2 = true;
            mergeAndSetOrders();
          },
          (err) => {
            console.error('Error fetching orders (quotations):', err);
            loaded2 = true;
            orders2 = [];
            mergeAndSetOrders();
          }
        );
        
        unsubscribers.push(unsub1, unsub2);
        
        return () => {
          unsubscribers.forEach(unsub => unsub());
        };
      } else {
        // السلوك العادي لباقي الأقسام
        const constraints: QueryConstraint[] = [];

        // تصفية حسب الصلاحيات
        if (user.role !== 'ceo' && !user.isHead) {
          // الموظفين العاديين يرون الطلبات الخاصة بهم أو قسمهم فقط
          if (user.department === 'sales') {
            constraints.push(where('createdBy', '==', user.uid));
          } else {
            // باقي الأقسام ترى الطلبات في حالات معينة
            const departmentStatuses = getDepartmentStatuses(user.department);
            if (departmentStatuses.length > 0) {
              constraints.push(where('status', 'in', departmentStatuses));
            }
          }
        }

        // تصفية حسب الحالة
        if (status) {
          constraints.push(where('status', '==', status));
        }

        // الترتيب
        constraints.push(orderBy('createdAt', 'desc'));

        const q = query(collection(db, COLLECTIONS.ORDERS), ...constraints);

        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const ordersData = snapshot.docs.map((doc) => ({
              ...doc.data(),
              id: doc.id,
            })) as Order[];

            setOrders(ordersData);
            setLoading(false);
          },
          (err) => {
            console.error('Error fetching orders:', err);
            setError(err as Error);
            setLoading(false);
          }
        );

        return () => unsubscribe();
      }
    } catch (err) {
      console.error('Error setting up orders listener:', err);
      setError(err as Error);
      setLoading(false);
    }
  }, [user, status]);

  return { orders, loading, error };
}

// دالة مساعدة لتحديد الحالات حسب القسم
function getDepartmentStatuses(department: string): OrderStatus[] {
  switch (department) {
    case 'design':
      return [
        OrderStatus.PENDING_DESIGN,
        OrderStatus.IN_DESIGN,
        OrderStatus.DESIGN_REVIEW,
        OrderStatus.DESIGN_COMPLETED,
      ];
    case 'printing':
      return [
        OrderStatus.PENDING_PRINTING,
        OrderStatus.IN_PRINTING,
        OrderStatus.PRINTING_COMPLETED,
      ];
    case 'accounting':
      return [OrderStatus.PENDING_PAYMENT, OrderStatus.PAYMENT_CONFIRMED];
    case 'dispatch':
      return [
        OrderStatus.PENDING_MATERIALS,
        OrderStatus.MATERIALS_IN_PROGRESS,
        OrderStatus.MATERIALS_READY,
        OrderStatus.READY_FOR_DISPATCH,
        OrderStatus.IN_DISPATCH,
        OrderStatus.DELIVERED,
      ];
    default:
      return [];
  }
}

