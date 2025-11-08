'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Layout/Navbar';
import { collection, addDoc, serverTimestamp, doc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS, OrderStatus, OrderPriority, PaymentStatus } from '@/types/shared';
import toast from 'react-hot-toast';

export default function NewQuotationRequestPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // بيانات الطلب
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  
  // وصف المطلوب
  const [description, setDescription] = useState('');
  const [estimatedQuantity, setEstimatedQuantity] = useState('');
  const [priority, setPriority] = useState<OrderPriority>(OrderPriority.MEDIUM);
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');

  // توليد رقم طلب جديد
  const generateOrderNumber = async (): Promise<string> => {
    const counterRef = doc(db, 'counters', 'orders');
    
    const orderNumber = await runTransaction(db, async (transaction) => {
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
      
      return `NAJD-${year}-${paddedNumber}`;
    });

    return orderNumber;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('يجب تسجيل الدخول');
      return;
    }

    setLoading(true);

    try {
      const orderNumber = await generateOrderNumber();

      // إنشاء طلب عرض سعر منفصل
      const orderData = {
        orderNumber,
        status: OrderStatus.PENDING_CEO_REVIEW,
        priority,
        
        // معلومات العميل
        customerName,
        customerPhone,
        customerEmail: customerEmail || null,
        customerAddress: customerAddress || null,
        companyName: companyName || null,
        taxNumber: taxNumber || null,
        
        // وصف مبسط (سيتم التفصيل في عرض السعر)
        description, // وصف ما يريده العميل
        estimatedQuantity: estimatedQuantity || null,
        
        // حقول مطلوبة (قيم افتراضية)
        printType: 'digital', // سيتم تحديده في عرض السعر
        quantity: 1, // سيتم تحديده في عرض السعر
        needsDesign: false,
        materials: [],
        files: [],
        notes: notes || '',
        
        // حالة الدفع
        paymentStatus: PaymentStatus.PENDING,
        
        // تحديد كطلب عرض سعر
        isQuotation: true,
        isQuotationOnly: true, // طلب عرض سعر فقط (وليس طلب طباعة)
        
        // الإسنادات
        createdBy: user.uid,
        createdByName: user.displayName,
        
        // التعليقات والمتابعة
        comments: [],
        timeline: [],
        
        // Tags
        tags: ['quotation', 'quotation-only'],
        isUrgent: priority === OrderPriority.URGENT,
        
        // التواريخ
        requestedDeliveryDate: requestedDeliveryDate || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, COLLECTIONS.ORDERS), orderData);

      toast.success('تم إرسال طلب عرض السعر بنجاح! سيتم التواصل معك قريباً.');
      router.push('/orders');
      
    } catch (error) {
      console.error('Error creating quotation request:', error);
      toast.error('فشل إرسال طلب عرض السعر');
    } finally {
      setLoading(false);
    }
  };

  if (!user || (user.role !== 'sales' && user.role !== 'sales_head')) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto py-12 px-4">
          <p className="text-center text-red-600">ليس لديك صلاحية لإنشاء طلبات عروض أسعار</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8" dir="rtl">
        <div className="bg-white rounded-lg shadow p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              💰 طلب عرض سعر جديد
            </h1>
            <p className="text-gray-600">
              قم بملء معلومات العميل ووصف ما يريده. سيقوم قسم الحسابات بإعداد عرض سعر مفصل له.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* معلومات العميل */}
            <section className="border-r-4 border-yellow-500 pr-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">معلومات العميل</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    اسم العميل *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    placeholder="اسم العميل أو الشركة"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    رقم الهاتف *
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    placeholder="+966XXXXXXXXX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    اسم الشركة (إن وجد)
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    الرقم الضريبي (إن وجد)
                  </label>
                  <input
                    type="text"
                    value={taxNumber}
                    onChange={(e) => setTaxNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    placeholder="300000000000003"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    العنوان
                  </label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  />
                </div>
              </div>
            </section>

            {/* وصف المطلوب */}
            <section className="border-r-4 border-blue-500 pr-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">وصف ما يريده العميل</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    وصف تفصيلي لما يريده العميل *
                  </label>
                  <textarea
                    rows={5}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="مثال: كروت شخصية - ورق كوشيه 350 جرام - طباعة ملونة وجهين - تصميم جديد..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    اكتب كل التفاصيل التي ذكرها العميل لمساعدة قسم الحسابات في التسعير
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    الكمية المتوقعة (تقريبية)
                  </label>
                  <input
                    type="text"
                    value={estimatedQuantity}
                    onChange={(e) => setEstimatedQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="مثال: 1000 كرت، 500 بروشور، إلخ"
                  />
                </div>
              </div>
            </section>

            {/* معلومات إضافية */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">معلومات إضافية</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    الأولوية
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as OrderPriority)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={OrderPriority.LOW}>منخفضة</option>
                    <option value={OrderPriority.MEDIUM}>متوسطة</option>
                    <option value={OrderPriority.HIGH}>عالية</option>
                    <option value={OrderPriority.URGENT}>عاجل</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    التسليم المطلوب (تقريبي)
                  </label>
                  <input
                    type="date"
                    value={requestedDeliveryDate}
                    onChange={(e) => setRequestedDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ملاحظات إضافية
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="أي ملاحظات أو تفاصيل إضافية..."
                />
              </div>
            </section>

            {/* تنبيه */}
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">💡</span>
                <div>
                  <h3 className="font-bold text-yellow-900 mb-1">طلب عرض سعر</h3>
                  <p className="text-sm text-yellow-800">
                    هذا طلب للحصول على تسعيرة فقط. لن يتم التنفيذ حتى موافقة العميل على السعر.
                    سيقوم قسم الحسابات بإعداد عرض سعر مفصل بناءً على المعلومات المقدمة.
                  </p>
                </div>
              </div>
            </div>

            {/* أزرار الإجراءات */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-gray-900 rounded-md hover:from-yellow-600 hover:to-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-bold"
              >
                {loading ? 'جاري الإرسال...' : '💰 إرسال طلب عرض السعر'}
              </button>

              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition font-medium"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}


