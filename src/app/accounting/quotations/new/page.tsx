'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Layout/Navbar';
import { doc, getDoc, addDoc, collection, serverTimestamp, updateDoc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/types/shared';
import toast from 'react-hot-toast';

interface QuotationItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

function NewQuotationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const orderId = searchParams.get('orderId');
  
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Quotation fields
  const [items, setItems] = useState<QuotationItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }
  ]);
  const [taxRate] = useState(15); // 15% VAT in Saudi Arabia
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [paymentMethod, setPaymentMethod] = useState('نقدي أو تحويل بنكي');
  const [downPaymentPercentage, setDownPaymentPercentage] = useState(50);
  const [deliveryTerms, setDeliveryTerms] = useState('التسليم حسب الاتفاق');
  const [deliveryDuration, setDeliveryDuration] = useState('7-10 أيام عمل');
  const [validityDays, setValidityDays] = useState(14);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('الأسعار شاملة ضريبة القيمة المضافة.\nالعرض ساري المفعول للمدة المحددة.\nيتم الدفع حسب الشروط المتفق عليها.');

  useEffect(() => {
    if (!user || user.department !== 'accounting') {
      router.push('/dashboard');
      return;
    }

    if (!orderId) {
      toast.error('معرف الطلب مطلوب');
      router.push('/orders');
      return;
    }

    const fetchOrder = async () => {
      try {
        const orderDoc = await getDoc(doc(db, COLLECTIONS.ORDERS, orderId));
        
        if (orderDoc.exists()) {
          const orderData = {
            id: orderDoc.id,
            ...orderDoc.data(),
          };
          setOrder(orderData);
          
          // Pre-fill first item based on order
          if ((orderData as any).products && (orderData as any).products.length > 0) {
            const product = (orderData as any).products[0];
            setItems([{
              id: '1',
              description: product.description || 'منتج',
              quantity: product.quantity || 1,
              unitPrice: 0,
              totalPrice: 0
            }]);
          }
        } else {
          toast.error('الطلب غير موجود');
          router.push('/orders');
        }
      } catch (error) {
        console.error('Error fetching order:', error);
        toast.error('فشل تحميل بيانات الطلب');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [user, orderId, router]);

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    
    let discountAmount = 0;
    if (discountType === 'percentage') {
      discountAmount = subtotal * (discount / 100);
    } else {
      discountAmount = discount;
    }
    
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * (taxRate / 100);
    const totalAmount = afterDiscount + taxAmount;
    
    return {
      subtotal,
      discountAmount,
      afterDiscount,
      taxAmount,
      totalAmount,
      downPayment: totalAmount * (downPaymentPercentage / 100)
    };
  };

  const totals = calculateTotals();

  // Item management
  const addItem = () => {
    const newItem: QuotationItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) {
      toast.error('يجب أن يحتوي عرض السعر على بند واحد على الأقل');
      return;
    }
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof QuotationItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Recalculate total price
        if (field === 'quantity' || field === 'unitPrice') {
          updated.totalPrice = updated.quantity * updated.unitPrice;
        }
        return updated;
      }
      return item;
    }));
  };

  // Generate quotation number
  const generateQuotationNumber = async (): Promise<string> => {
    const counterRef = doc(db, 'counters', 'quotations');
    
    const quotationNumber = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let currentCount = 0;
      
      if (!counterDoc.exists()) {
        transaction.set(counterRef, {
          count: 1,
          lastUpdated: serverTimestamp(),
        });
        currentCount = 1;
      } else {
        const counterData = counterDoc.data();
        currentCount = (counterData?.count || 0) + 1;
        
        transaction.update(counterRef, {
          count: currentCount,
          lastUpdated: serverTimestamp(),
        });
      }

      const year = new Date().getFullYear();
      const paddedNumber = currentCount.toString().padStart(4, '0');
      
      return `QT-${year}-${paddedNumber}`;
    });

    return quotationNumber;
  };

  // Save quotation
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (items.some(item => !item.description || item.quantity <= 0 || item.unitPrice <= 0)) {
      toast.error('يرجى ملء جميع بنود عرض السعر بشكل صحيح');
      return;
    }

    if (!paymentMethod) {
      toast.error('يرجى تحديد طريقة الدفع');
      return;
    }

    setSaving(true);

    try {
      // Generate quotation number
      const quotationNumber = await generateQuotationNumber();

      // Calculate dates
      const issueDate = new Date();
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + validityDays);

      // Prepare quotation data
      const quotationData = {
        quotationNumber,
        status: 'quotation_pending_approval', // يُرسل مباشرة للموافقة
        
        // Customer info from order
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail || null,
        customerAddress: order.customerAddress || null,
        
        // Related order
        relatedOrderId: order.id,
        relatedOrderNumber: order.orderNumber,
        
        // Items
        items: items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          notes: item.notes || null
        })),
        
        // Financial calculations
        subtotal: totals.subtotal,
        taxRate,
        taxAmount: totals.taxAmount,
        discount: totals.discountAmount,
        discountPercentage: discountType === 'percentage' ? discount : null,
        totalAmount: totals.totalAmount,
        
        // Payment terms
        paymentTerms: {
          method: paymentMethod,
          downPaymentPercentage,
          downPaymentAmount: totals.downPayment,
          remainingPaymentTerms: `المبلغ المتبقي: ${(totals.totalAmount - totals.downPayment).toFixed(2)} ر.س`
        },
        
        // Delivery
        deliveryTerms,
        deliveryDuration,
        
        // Dates
        issueDate: issueDate.toISOString(),
        validUntil: expiryDate.toISOString(),
        expiryDate: expiryDate.toISOString(),
        
        // Created by
        preparedBy: user?.uid || '',
        preparedByName: user?.displayName || '',
        
        // Notes and terms
        notes,
        terms,
        
        // Metadata
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        
        tags: ['draft']
      };

      // Save quotation
      const quotationRef = await addDoc(collection(db, 'quotations'), quotationData);

      // Update order with quotation reference
      await updateDoc(doc(db, COLLECTIONS.ORDERS, order.id), {
        quotationId: quotationRef.id,
        quotationNumber,
        updatedAt: serverTimestamp()
      });

      toast.success(`تم إنشاء عرض السعر ${quotationNumber} وإرساله للموافقة!`);
      
      // TODO: إرسال إشعار للـ CEO
      
      // Navigate to quotation details
      router.push(`/accounting/quotations/${quotationRef.id}`);

    } catch (error) {
      console.error('Error saving quotation:', error);
      toast.error('فشل حفظ عرض السعر');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">جاري التحميل...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:underline mb-4"
          >
            ← العودة
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            إنشاء عرض سعر جديد
          </h1>
          <p className="mt-2 text-gray-600">
            للطلب: {order?.orderNumber}
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Order Info Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">معلومات العميل</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">العميل</p>
                <p className="text-base font-medium text-gray-900">{order?.customerName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">رقم الهاتف</p>
                <p className="text-base font-medium text-gray-900">{order?.customerPhone}</p>
              </div>
              {order?.customerEmail && (
                <div>
                  <p className="text-sm text-gray-600">البريد الإلكتروني</p>
                  <p className="text-base font-medium text-gray-900">{order?.customerEmail}</p>
                </div>
              )}
              {order?.customerAddress && (
                <div>
                  <p className="text-sm text-gray-600">العنوان</p>
                  <p className="text-base font-medium text-gray-900">{order?.customerAddress}</p>
                </div>
              )}
            </div>
          </div>

          {/* Items Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">بنود عرض السعر</h2>
              <button
                type="button"
                onClick={addItem}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
              >
                + إضافة بند
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium text-gray-900">بند #{index + 1}</h3>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        × حذف
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        الوصف *
                      </label>
                      <input
                        type="text"
                        required
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="وصف المنتج أو الخدمة"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        الكمية *
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        سعر الوحدة (ر.س) *
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ملاحظات (اختياري)
                      </label>
                      <input
                        type="text"
                        value={item.notes || ''}
                        onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="ملاحظات إضافية عن هذا البند"
                      />
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-lg font-bold text-gray-900">
                      المجموع: {item.totalPrice.toFixed(2)} ر.س
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">الحسابات المالية</h2>

            {/* Discount */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الخصم
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  نوع الخصم
                </label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as 'amount' | 'percentage')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="amount">مبلغ (ر.س)</option>
                  <option value="percentage">نسبة مئوية (%)</option>
                </select>
              </div>
            </div>

            {/* Totals */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-gray-700">
                <span>المجموع الفرعي:</span>
                <span className="font-medium">{totals.subtotal.toFixed(2)} ر.س</span>
              </div>
              
              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>الخصم:</span>
                  <span className="font-medium">- {totals.discountAmount.toFixed(2)} ر.س</span>
                </div>
              )}

              <div className="flex justify-between text-gray-700">
                <span>بعد الخصم:</span>
                <span className="font-medium">{totals.afterDiscount.toFixed(2)} ر.س</span>
              </div>

              <div className="flex justify-between text-gray-700">
                <span>الضريبة ({taxRate}%):</span>
                <span className="font-medium">{totals.taxAmount.toFixed(2)} ر.س</span>
              </div>

              <div className="pt-2 border-t-2 border-gray-300 flex justify-between text-lg font-bold text-gray-900">
                <span>المجموع الإجمالي:</span>
                <span className="text-blue-600">{totals.totalAmount.toFixed(2)} ر.س</span>
              </div>
            </div>
          </div>

          {/* Payment Terms */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">شروط الدفع</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  طريقة الدفع *
                </label>
                <input
                  type="text"
                  required
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="نقدي، تحويل بنكي، آجل، إلخ"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  نسبة الدفعة المقدمة (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={downPaymentPercentage}
                  onChange={(e) => setDownPaymentPercentage(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {downPaymentPercentage > 0 && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>الدفعة المقدمة:</strong> {totals.downPayment.toFixed(2)} ر.س
                </p>
                <p className="text-sm text-blue-900 mt-1">
                  <strong>المبلغ المتبقي:</strong> {(totals.totalAmount - totals.downPayment).toFixed(2)} ر.س
                </p>
              </div>
            )}
          </div>

          {/* Delivery Terms */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">شروط التسليم</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  شروط التسليم
                </label>
                <input
                  type="text"
                  value={deliveryTerms}
                  onChange={(e) => setDeliveryTerms(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="التسليم حسب الاتفاق"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  مدة التسليم
                </label>
                <input
                  type="text"
                  value={deliveryDuration}
                  onChange={(e) => setDeliveryDuration(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="7-10 أيام عمل"
                />
              </div>
            </div>
          </div>

          {/* Validity Period */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">صلاحية عرض السعر</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  صالح لمدة (أيام)
                </label>
                <input
                  type="number"
                  min="1"
                  value={validityDays}
                  onChange={(e) => setValidityDays(parseInt(e.target.value) || 14)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-end">
                <p className="text-sm text-gray-600">
                  عرض السعر صالح حتى: <strong>{new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toLocaleDateString('ar-SA')}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Notes and Terms */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">ملاحظات وشروط</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ملاحظات إضافية
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="أي ملاحظات إضافية..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الشروط والأحكام
                </label>
                <textarea
                  rows={4}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {saving ? 'جاري الحفظ...' : '💾 حفظ عرض السعر'}
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NewQuotationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-najd-blue"></div>
      </div>
    }>
      <NewQuotationPageContent />
    </Suspense>
  );
}
