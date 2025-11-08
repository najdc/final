/**
 * نافذة إنشاء طلب شراء للخامات الناقصة
 */

'use client';

import { useState } from 'react';
import { collection, addDoc, doc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { notifyCEO } from '@/utils/ceoNotifications';

interface MissingMaterial {
  itemName: string;
  category: string;
  requestedQuantity: number;
  availableQuantity: number;
  unit: string;
}

interface Props {
  missingMaterials: MissingMaterial[];
  relatedOrderNumber?: string;
  relatedOrderId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PurchaseRequestModal({
  missingMaterials,
  relatedOrderNumber,
  relatedOrderId,
  onClose,
  onSuccess,
}: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [supplier, setSuggester] = useState('');
  const [estimatedCosts, setEstimatedCosts] = useState<{ [key: number]: number }>({});

  // توليد رقم طلب شراء
  const generatePurchaseRequestNumber = async (): Promise<string> => {
    const counterRef = doc(db, 'counters', 'purchase_requests');
    
    const requestNumber = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let currentCount = 0;
      
      if (!counterDoc.exists()) {
        transaction.set(counterRef, { count: 1 });
        currentCount = 1;
      } else {
        const counterData = counterDoc.data();
        currentCount = (counterData?.count || 0) + 1;
        transaction.update(counterRef, { count: currentCount });
      }

      const year = new Date().getFullYear();
      const paddedNumber = currentCount.toString().padStart(4, '0');
      
      return `PURCHREQ-${year}-${paddedNumber}`;
    });

    return requestNumber;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('يجب تسجيل الدخول');
      return;
    }

    if (!reason.trim()) {
      toast.error('يجب إدخال سبب الطلب');
      return;
    }

    setLoading(true);

    try {
      // توليد رقم طلب الشراء
      const requestNumber = await generatePurchaseRequestNumber();

      // إعداد عناصر الطلب
      const items = missingMaterials.map((material, index) => ({
        id: Math.random().toString(36).substr(2, 9),
        category: material.category as any,
        name: material.itemName,
        requestedQuantity: material.requestedQuantity - material.availableQuantity,
        unit: material.unit,
        estimatedCost: estimatedCosts[index] || 0,
        totalEstimatedCost: (estimatedCosts[index] || 0) * (material.requestedQuantity - material.availableQuantity),
      }));

      const totalEstimatedCost = items.reduce((sum, item) => sum + (item.totalEstimatedCost || 0), 0);

      // إنشاء طلب الشراء
      const purchaseRequestData = {
        requestNumber,
        status: 'pending',
        items,
        requestedBy: user.uid,
        requestedByName: user.displayName || 'غير معروف',
        department: 'sales',
        relatedOrderId: relatedOrderId || null,
        relatedOrderNumber: relatedOrderNumber || null,
        priority,
        reason,
        notes: notes || null,
        totalEstimatedCost,
        supplier: supplier || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'purchase_requests'), purchaseRequestData);

      // إرسال إشعار للـ CEO
      await notifyCEO({
        type: 'purchase_request',
        title: 'طلب شراء جديد',
        message: `طلب شراء ${requestNumber} من ${user.displayName || 'موظف المبيعات'} - ${items.length} صنف - ${totalEstimatedCost.toLocaleString('ar-SA')} ر.س`,
        actionUrl: '/ceo-dashboard/material-requests',
        priority,
      });

      toast.success('تم إنشاء طلب الشراء بنجاح');
      onSuccess();
    } catch (error) {
      console.error('Error creating purchase request:', error);
      toast.error('فشل إنشاء طلب الشراء');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" dir="rtl">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">طلب شراء خامات</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* الخامات الناقصة */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">الخامات المطلوبة:</h3>
            <div className="space-y-3">
              {missingMaterials.map((material, index) => (
                <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">{material.itemName}</h4>
                      <p className="text-sm text-gray-600">{material.category}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-red-600">
                        ناقص: {material.requestedQuantity - material.availableQuantity} {material.unit}
                      </p>
                      <p className="text-xs text-gray-500">
                        (المطلوب: {material.requestedQuantity} - المتوفر: {material.availableQuantity})
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      التكلفة المقدرة للوحدة (ر.س)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={estimatedCosts[index] || ''}
                      onChange={(e) =>
                        setEstimatedCosts({
                          ...estimatedCosts,
                          [index]: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    {estimatedCosts[index] && (
                      <p className="text-sm text-gray-600 mt-1">
                        التكلفة الإجمالية: {((estimatedCosts[index] || 0) * (material.requestedQuantity - material.availableQuantity)).toFixed(2)} ر.س
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* معلومات الطلب */}
          {relatedOrderNumber && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                📋 <strong>مرتبط بالطلب:</strong> {relatedOrderNumber}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              الأولوية *
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="low">منخفضة</option>
              <option value="medium">متوسطة</option>
              <option value="high">عالية</option>
              <option value="urgent">عاجلة</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              سبب الطلب *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              placeholder="مثال: خامات مطلوبة لطلب عميل..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              المورد المقترح (اختياري)
            </label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSuggester(e.target.value)}
              placeholder="اسم المورد..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ملاحظات إضافية (اختياري)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات إضافية..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {/* الأزرار */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-najd-blue text-white rounded-lg hover:bg-opacity-90 transition font-medium disabled:bg-gray-400"
            >
              {loading ? 'جاري الإرسال...' : '📤 إرسال طلب الشراء'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              إلغاء
            </button>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              ⚠️ <strong>ملاحظة:</strong> سيتم إرسال طلب الشراء للمدير التنفيذي للموافقة عليه.
              لن يتم إنشاء الطلب حتى تتوفر الخامات المطلوبة.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}


