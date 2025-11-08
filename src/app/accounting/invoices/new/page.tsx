/**
 * صفحة إنشاء فاتورة جديدة
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Layout/Navbar';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order } from '@/types/shared';
import { Invoice, InvoiceItem, InvoiceType, InvoiceStatus } from '@najd/shared';

const TAX_RATE = 15; // 15% ضريبة القيمة المضافة في السعودية

export default function NewInvoicePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  // معلومات العميل
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  
  // الطلب المرتبط (اختياري)
  const [relatedOrderId, setRelatedOrderId] = useState('');
  const [relatedOrderNumber, setRelatedOrderNumber] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  
  // بنود الفاتورة
  const [items, setItems] = useState<InvoiceItem[]>([{
    id: '1',
    description: '',
    quantity: 1,
    unitPrice: 0,
    totalPrice: 0,
  }]);
  
  // المعلومات المالية
  const [discount, setDiscount] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  
  // شروط الدفع
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [notes, setNotes] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }

    // التحقق من الصلاحيات
    if (user && user.department !== 'accounting' && user.role !== 'ceo') {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchCompletedOrders();
    }
  }, [user]);

  const fetchCompletedOrders = async () => {
    try {
      const q = query(
        collection(db, 'orders'),
        where('status', 'in', ['printing_completed', 'pending_payment', 'payment_confirmed'])
      );
      const snapshot = await getDocs(q);
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      setOrders(ordersData);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  // ربط بطلب موجود
  const handleSelectOrder = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setRelatedOrderId(order.id);
      setRelatedOrderNumber(order.orderNumber);
      setCustomerName(order.customerName);
      setCustomerPhone(order.customerPhone);
      setCustomerEmail(order.customerEmail || '');
      setCustomerAddress(order.customerAddress || '');
      
      // إنشاء بند واحد من الطلب
      setItems([{
        id: '1',
        description: `الطلب رقم ${order.orderNumber} - ${order.printType} - الكمية: ${order.quantity}`,
        quantity: order.quantity,
        unitPrice: (order.finalCost || order.estimatedCost || 0) / order.quantity,
        totalPrice: order.finalCost || order.estimatedCost || 0,
      }]);
    }
  };

  // إضافة بند جديد
  const addItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
    };
    setItems([...items, newItem]);
  };

  // حذف بند
  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  // تحديث بند
  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, [field]: value };
      
      // حساب السعر الإجمالي تلقائياً
      if (field === 'quantity' || field === 'unitPrice') {
        updated.totalPrice = updated.quantity * updated.unitPrice;
      }
      
      return updated;
    }));
  };

  // حساب المجاميع
  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const afterDiscount = subtotal - discount;
    const afterShipping = afterDiscount + shippingCost;
    const taxAmount = afterShipping * (TAX_RATE / 100);
    const total = afterShipping + taxAmount;
    
    return {
      subtotal,
      taxAmount,
      total,
    };
  };

  const totals = calculateTotals();

  // حفظ الفاتورة
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerName || !customerPhone) {
      setError('يرجى إدخال اسم العميل ورقم الهاتف');
      return;
    }

    if (items.some(item => !item.description || item.quantity <= 0 || item.unitPrice <= 0)) {
      setError('يرجى إكمال جميع بنود الفاتورة');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // توليد رقم الفاتورة (مؤقت - سيتم استبداله بـ Cloud Function)
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      const invoiceData: any = {
        invoiceNumber,
        invoiceType: InvoiceType.SALES,
        status: InvoiceStatus.DRAFT,
        
        // معلومات العميل
        customerName,
        customerPhone,
        customerEmail,
        customerAddress,
        companyName,
        taxNumber,
        
        // الطلب المرتبط
        relatedOrderId: relatedOrderId || undefined,
        relatedOrderNumber: relatedOrderNumber || undefined,
        
        // البنود
        items,
        
        // المعلومات المالية
        subtotal: totals.subtotal,
        taxRate: TAX_RATE,
        taxAmount: totals.taxAmount,
        discount: discount || undefined,
        shippingCost: shippingCost || undefined,
        totalAmount: totals.total,
        
        // معلومات الدفع
        paidAmount: 0,
        remainingAmount: totals.total,
        paymentRecords: [],
        paymentDueDate: paymentDueDate || undefined,
        
        // التواريخ
        issueDate: new Date().toISOString(),
        dueDate: paymentDueDate || undefined,
        
        // الموافقات
        preparedBy: user!.uid,
        preparedByName: user!.displayName,
        
        // ملاحظات
        notes,
        
        // التواريخ
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'invoices'), invoiceData);
      
      // الانتقال لصفحة التفاصيل
      router.push(`/accounting/invoices/${docRef.id}`);
      
    } catch (error) {
      console.error('Error creating invoice:', error);
      setError('حدث خطأ أثناء إنشاء الفاتورة');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-najd-blue"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8" dir="rtl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">إنشاء فاتورة جديدة</h1>
          <p className="text-gray-600">إنشاء فاتورة مبيعات للعميل</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* ربط بطلب موجود */}
          {orders.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                ربط بطلب موجود (اختياري)
              </h2>
              <select
                value={relatedOrderId}
                onChange={(e) => handleSelectOrder(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-najd-blue"
              >
                <option value="">اختر طلب...</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.orderNumber} - {order.customerName} - {order.finalCost || order.estimatedCost} ر.س
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* معلومات العميل */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">معلومات العميل</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم العميل <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-najd-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  رقم الهاتف <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-najd-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-najd-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم الشركة
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-najd-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الرقم الضريبي
                </label>
                <input
                  type="text"
                  value={taxNumber}
                  onChange={(e) => setTaxNumber(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-najd-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  العنوان
                </label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-najd-blue"
                />
              </div>
            </div>
          </div>

          {/* بنود الفاتورة */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">بنود الفاتورة</h2>
              <button
                type="button"
                onClick={addItem}
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition"
              >
                + إضافة بند
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-medium text-gray-900">البند {index + 1}</h3>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        حذف
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        الوصف
                      </label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-najd-blue"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        الكمية
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-najd-blue"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        سعر الوحدة (ر.س)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, 'unitPrice', Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-najd-blue"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <p className="text-sm text-gray-600">
                        المجموع: <span className="font-bold">{item.totalPrice.toFixed(2)} ر.س</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* المعلومات المالية */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">المعلومات المالية</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الخصم (ر.س)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-najd-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تكلفة الشحن (ر.س)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-najd-blue"
                />
              </div>
            </div>

            {/* ملخص المبالغ */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">المجموع الفرعي:</span>
                <span className="font-medium">{totals.subtotal.toFixed(2)} ر.س</span>
              </div>
              
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>الخصم:</span>
                  <span>- {discount.toFixed(2)} ر.س</span>
                </div>
              )}
              
              {shippingCost > 0 && (
                <div className="flex justify-between text-sm">
                  <span>الشحن:</span>
                  <span>+ {shippingCost.toFixed(2)} ر.س</span>
                </div>
              )}
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">الضريبة ({TAX_RATE}%):</span>
                <span className="font-medium">{totals.taxAmount.toFixed(2)} ر.س</span>
              </div>
              
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>المبلغ الإجمالي:</span>
                <span className="text-najd-blue">{totals.total.toFixed(2)} ر.س</span>
              </div>
            </div>
          </div>

          {/* شروط الدفع */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">شروط الدفع</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  طريقة الدفع المتوقعة
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-najd-blue"
                >
                  <option value="cash">نقدي</option>
                  <option value="bank">تحويل بنكي</option>
                  <option value="check">شيك</option>
                  <option value="card">بطاقة</option>
                  <option value="installment">تقسيط</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تاريخ الاستحقاق
                </label>
                <input
                  type="date"
                  value={paymentDueDate}
                  onChange={(e) => setPaymentDueDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-najd-blue"
                />
              </div>
            </div>
          </div>

          {/* الملاحظات */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">الملاحظات</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="ملاحظات إضافية..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-najd-blue"
            />
          </div>

          {/* الأزرار */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-najd-blue text-white px-6 py-3 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ كمسودة'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              إلغاء
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}



