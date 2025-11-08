/**
 * صفحة إنشاء طلب جديد
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Layout/Navbar';
import { collection, addDoc, serverTimestamp, doc, runTransaction, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import toast from 'react-hot-toast';
import {
  PrintType,
  OrderPriority,
  MaterialType,
  OrderStatus,
  Material,
  AttachedFile,
  PaymentStatus,
  COLLECTIONS,
  STORAGE_PATHS,
  Customer,
} from '@/types/shared';
import InventoryMaterialsSelector, { OrderInventoryMaterial } from '@/components/Orders/InventoryMaterialsSelector';
import PurchaseRequestModal from '@/components/Orders/PurchaseRequestModal';
import { decreaseInventory, checkMaterialsAvailability } from '@/utils/inventoryHelpers';

export default function NewOrderPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('new');
  const [isNewCustomer, setIsNewCustomer] = useState(true);

  // بيانات الطلب
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  // المنتجات في الطلب
  interface Product {
    id: string;
    printType: PrintType;
    quantity: number;
    needsDesign: boolean;
    designDescription: string;
    description: string; // وصف المنتج
  }

  const [products, setProducts] = useState<Product[]>([
    {
      id: Math.random().toString(36).substr(2, 9),
      printType: PrintType.DIGITAL,
      quantity: 1,
      needsDesign: false,
      designDescription: '',
      description: '',
    },
  ]);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [inventoryMaterials, setInventoryMaterials] = useState<OrderInventoryMaterial[]>([]);
  const [showPurchaseRequestModal, setShowPurchaseRequestModal] = useState(false);
  const [missingMaterials, setMissingMaterials] = useState<any[]>([]);
  const [pendingOrderData, setPendingOrderData] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<OrderPriority>(OrderPriority.MEDIUM);
  const [estimatedCost, setEstimatedCost] = useState<number>(0); // التسعيرة الأولية من المبيعات
  
  // نوع الطلب - الآن طلبات عروض الأسعار منفصلة
  // const [isQuotation, setIsQuotation] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');

  // جلب قائمة العملاء
  useEffect(() => {
    if (!user) return;

    const customersRef = collection(db, 'customers');
    const customersQuery = query(
      customersRef,
      where('createdBy', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      customersQuery,
      (snapshot) => {
        const customersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Customer[];
        setCustomers(customersData);
      },
      (error) => {
        console.error('Error fetching customers:', error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // تحديث بيانات العميل عند الاختيار
  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    
    if (customerId === 'new') {
      setIsNewCustomer(true);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setCustomerAddress('');
    } else {
      setIsNewCustomer(false);
      const selectedCustomer = customers.find((c) => c.id === customerId);
      if (selectedCustomer) {
        setCustomerName(selectedCustomer.name);
        setCustomerPhone(selectedCustomer.phone);
        setCustomerEmail(selectedCustomer.email || '');
        setCustomerAddress(selectedCustomer.address || '');
      }
    }
  };

  // إضافة منتج
  const addProduct = () => {
    setProducts([
      ...products,
      {
        id: Math.random().toString(36).substr(2, 9),
        printType: PrintType.DIGITAL,
        quantity: 1,
        needsDesign: false,
        designDescription: '',
        description: '',
      },
    ]);
  };

  // حذف منتج
  const removeProduct = (id: string) => {
    if (products.length === 1) {
      toast.error('يجب أن يحتوي الطلب على منتج واحد على الأقل');
      return;
    }
    setProducts(products.filter((p) => p.id !== id));
  };

  // تحديث منتج
  const updateProduct = (id: string, field: keyof Product, value: any) => {
    const updated = products.map((p) =>
      p.id === id ? { ...p, [field]: value } : p
    );
    setProducts(updated);
  };

  // إضافة مادة
  const addMaterial = () => {
    setMaterials([
      ...materials,
      {
        type: MaterialType.PAPER,
        description: '',
        quantity: 0,
      },
    ]);
  };

  // حذف مادة
  const removeMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  // تحديث مادة
  const updateMaterial = (index: number, field: keyof Material, value: any) => {
    const updated = [...materials];
    updated[index] = { ...updated[index], [field]: value };
    setMaterials(updated);
  };

  // معالجة رفع الملفات
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  // توليد رقم طلب جديد
  const generateOrderNumber = async (): Promise<string> => {
    const counterRef = doc(db, 'counters', 'orders');
    
    const orderNumber = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let currentCount = 0;
      
      if (!counterDoc.exists()) {
        // إنشاء العداد للمرة الأولى
        transaction.set(counterRef, {
          count: 1,
          lastUpdated: serverTimestamp(),
        });
        currentCount = 1;
      } else {
        // زيادة العداد
        const counterData = counterDoc.data();
        currentCount = (counterData?.count || 0) + 1;
        
        transaction.update(counterRef, {
          count: currentCount,
          lastUpdated: serverTimestamp(),
        });
      }

      // توليد رقم الطلب بالصيغة: NAJD-YYYY-XXXX
      const year = new Date().getFullYear();
      const paddedNumber = currentCount.toString().padStart(4, '0');
      
      return `NAJD-${year}-${paddedNumber}`;
    });

    return orderNumber;
  };

  // إرسال الطلب
  const handleSubmit = async (e: React.FormEvent, submitForReview: boolean = true) => {
    e.preventDefault();

    if (!user) {
      toast.error('يجب تسجيل الدخول');
      return;
    }

    setLoading(true);

    try {
      // 1. التحقق من توفر الخامات من المخزون
      if (inventoryMaterials.length > 0) {
        const availabilityCheck = await checkMaterialsAvailability(inventoryMaterials);
        
        if (!availabilityCheck.available) {
          // حفظ بيانات الطلب مؤقتاً
          setPendingOrderData({ submitForReview });
          setMissingMaterials(availabilityCheck.missingMaterials);
          setShowPurchaseRequestModal(true);
          setLoading(false);
          return;
        }
      }

      // 2. توليد رقم الطلب
      const orderNumber = await generateOrderNumber();

      // 3. رفع الملفات (إن وجدت)
      const uploadedFiles: AttachedFile[] = [];

      for (const file of files) {
        const fileRef = ref(
          storage,
          `${STORAGE_PATHS.ORDER_FILES}/${orderNumber}/${file.name}`
        );
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);

        uploadedFiles.push({
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          url,
          size: file.size,
          type: file.type,
          uploadedBy: user.uid,
          uploadedAt: new Date().toISOString(),
        });
      }

      // 4. إنشاء الطلب
      // حساب الكمية الإجمالية ونوع الطباعة الأساسي
      const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
      const primaryPrintType = products[0]?.printType || PrintType.DIGITAL;
      const needsDesign = products.some((p) => p.needsDesign);

      // 4. إضافة عميل جديد إذا لزم الأمر
      let savedCustomerId = selectedCustomerId !== 'new' ? selectedCustomerId : null;
      
      if (isNewCustomer && customerName && customerPhone) {
        try {
          const newCustomerRef = await addDoc(collection(db, 'customers'), {
            name: customerName,
            phone: customerPhone,
            email: customerEmail || null,
            address: customerAddress || null,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          savedCustomerId = newCustomerRef.id;
        } catch (error) {
          console.error('Error saving customer:', error);
          // نستمر حتى لو فشل حفظ العميل
        }
      }

      const orderData = {
        orderNumber,
        status: submitForReview ? OrderStatus.PENDING_CEO_REVIEW : OrderStatus.DRAFT,
        priority,
        customerId: savedCustomerId, // ربط الطلب بالعميل
        customerName,
        customerPhone,
        customerEmail: customerEmail || null,
        customerAddress: customerAddress || null,
        // حفظ نوع الطباعة والكمية الأساسية للتوافق
        printType: primaryPrintType,
        quantity: totalQuantity,
        needsDesign,
        designDescription: products
          .filter((p) => p.needsDesign && p.designDescription)
          .map((p) => p.designDescription)
          .join(' | '),
        // المنتجات المتعددة
        products: products.map((p) => ({
          id: p.id,
          printType: p.printType,
          quantity: p.quantity,
          needsDesign: p.needsDesign,
          designDescription: p.designDescription,
          description: p.description,
        })),
        materials,
        inventoryMaterials: inventoryMaterials.length > 0 ? inventoryMaterials : null,
        files: uploadedFiles,
        notes,
        estimatedCost: estimatedCost || null, // التسعيرة الأولية من المبيعات
        finalCost: null, // سيتم مراجعتها من الحسابات
        paymentStatus: PaymentStatus.PENDING,
        createdBy: user.uid,
        createdByName: user.displayName,
        comments: [],
        timeline: [],
        tags: [],
        isUrgent: priority === OrderPriority.URGENT,
        isQuotation: false, // طلب طباعة عادي (طلبات عروض الأسعار منفصلة الآن)
        requestedDeliveryDate: requestedDeliveryDate || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const orderRef = await addDoc(collection(db, COLLECTIONS.ORDERS), orderData);

      // 6. تقليل المخزون إذا كانت هناك خامات محددة
      if (inventoryMaterials.length > 0) {
        const decreaseResult = await decreaseInventory(
          inventoryMaterials,
          orderRef.id,
          orderNumber,
          user.uid,
          user.displayName || 'مجهول'
        );

        if (!decreaseResult.success) {
          console.error('Inventory decrease errors:', decreaseResult.errors);
          toast.error('تم إنشاء الطلب ولكن فشل تحديث بعض الخامات');
        }
      }

      toast.success(submitForReview ? 'تم إرسال الطلب للمراجعة بنجاح' : 'تم حفظ الطلب كمسودة');
      router.push('/orders');
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('فشل إنشاء الطلب');
    } finally {
      setLoading(false);
    }
  };

  if (!user || (user.role !== 'sales' && user.role !== 'sales_head')) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto py-12 px-4">
          <p className="text-center text-red-600">ليس لديك صلاحية لإنشاء طلبات</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8" dir="rtl">
        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">إنشاء طلب جديد</h1>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* معلومات العميل */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">معلومات العميل</h2>
              
              {/* اختيار العميل */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  اختر العميل
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
                >
                  <option value="new">+ عميل جديد</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} - {customer.phone}
                    </option>
                  ))}
                </select>
              </div>

              {/* بيانات العميل */}
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
                    disabled={!isNewCustomer}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue disabled:bg-gray-100"
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
                    disabled={!isNewCustomer}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue disabled:bg-gray-100"
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
                    disabled={!isNewCustomer}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue disabled:bg-gray-100"
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
                    disabled={!isNewCustomer}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue disabled:bg-gray-100"
                  />
                </div>
              </div>

              {isNewCustomer && (
                <p className="mt-2 text-sm text-gray-600">
                  💡 سيتم حفظ هذا العميل تلقائياً لاستخدامه في الطلبات القادمة
                </p>
              )}
            </section>

            {/* المنتجات */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">المنتجات</h2>
                <button
                  type="button"
                  onClick={addProduct}
                  className="px-4 py-2 bg-najd-gold text-najd-blue rounded-md hover:bg-yellow-500 transition font-medium"
                >
                  + إضافة منتج
                </button>
              </div>

              <div className="space-y-6">
                {products.map((product, index) => (
                  <div
                    key={product.id}
                    className="border border-gray-200 rounded-lg p-6 bg-gray-50 relative"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium text-gray-900">
                        منتج #{index + 1}
                      </h3>
                      {products.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeProduct(product.id)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          × حذف
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          وصف المنتج *
                        </label>
                        <input
                          type="text"
                          required
                          value={product.description}
                          onChange={(e) =>
                            updateProduct(product.id, 'description', e.target.value)
                          }
                          placeholder="مثال: بنر إعلاني، كرت شخصي، ..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          نوع الطباعة *
                        </label>
                        <select
                          value={product.printType}
                          onChange={(e) =>
                            updateProduct(product.id, 'printType', e.target.value as PrintType)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue bg-white"
                        >
                          <option value={PrintType.DIGITAL}>ديجيتال</option>
                          <option value={PrintType.OFFSET}>أوفست</option>
                          <option value={PrintType.INDOOR}>إندور</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          الكمية *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={product.quantity}
                          onChange={(e) =>
                            updateProduct(product.id, 'quantity', parseInt(e.target.value))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue bg-white"
                        />
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id={`needsDesign-${product.id}`}
                          checked={product.needsDesign}
                          onChange={(e) =>
                            updateProduct(product.id, 'needsDesign', e.target.checked)
                          }
                          className="h-4 w-4 text-najd-blue focus:ring-najd-blue border-gray-300 rounded"
                        />
                        <label
                          htmlFor={`needsDesign-${product.id}`}
                          className="mr-2 text-sm font-medium text-gray-700"
                        >
                          يحتاج تصميم
                        </label>
                      </div>

                      {product.needsDesign && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            وصف التصميم المطلوب
                          </label>
                          <textarea
                            rows={3}
                            value={product.designDescription}
                            onChange={(e) =>
                              updateProduct(product.id, 'designDescription', e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue bg-white"
                            placeholder="اشرح التصميم المطلوب بالتفصيل..."
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* معلومات إضافية */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">معلومات إضافية</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    الأولوية *
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as OrderPriority)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
                  >
                    <option value={OrderPriority.LOW}>منخفضة</option>
                    <option value={OrderPriority.MEDIUM}>متوسطة</option>
                    <option value={OrderPriority.HIGH}>عالية</option>
                    <option value={OrderPriority.URGENT}>عاجل</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    تاريخ التسليم المطلوب
                  </label>
                  <input
                    type="date"
                    value={requestedDeliveryDate}
                    onChange={(e) => setRequestedDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    التسعيرة الأولية (ر.س)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
                    placeholder="السعر التقريبي للطلب"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    ⚠️ سيتم مراجعة التسعيرة من قسم الحسابات لاحقاً
                  </p>
                </div>
              </div>

            </section>

            {/* المواد */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">المواد المطلوبة</h2>
                <button
                  type="button"
                  onClick={addMaterial}
                  className="px-4 py-2 bg-najd-blue text-white rounded-md hover:bg-primary-700 transition"
                >
                  + إضافة مادة
                </button>
              </div>

              <div className="space-y-4">
                {materials.map((material, index) => (
                  <div key={index} className="flex gap-4 items-start p-4 border border-gray-200 rounded-md">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <select
                        value={material.type}
                        onChange={(e) => updateMaterial(index, 'type', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value={MaterialType.PAPER}>ورق</option>
                        <option value={MaterialType.PLATES}>بليتات</option>
                        <option value={MaterialType.MOLDS}>قوالب</option>
                      </select>

                      <input
                        type="text"
                        placeholder="الوصف"
                        value={material.description}
                        onChange={(e) => updateMaterial(index, 'description', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md"
                      />

                      <input
                        type="number"
                        placeholder="الكمية"
                        value={material.quantity || ''}
                        onChange={(e) => updateMaterial(index, 'quantity', parseInt(e.target.value) || 0)}
                        className="px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeMaterial(index)}
                      className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* الخامات من المخزون */}
            <section>
              <div className="border-t border-gray-200 pt-6 mb-6">
                <InventoryMaterialsSelector
                  selectedMaterials={inventoryMaterials}
                  onChange={setInventoryMaterials}
                  onMissingMaterials={(missing) => {
                    setMissingMaterials(missing);
                    setShowPurchaseRequestModal(true);
                  }}
                />
              </div>
            </section>

            {/* الملفات */}
            <section>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الملفات المرفقة
              </label>
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              {files.length > 0 && (
                <p className="mt-2 text-sm text-gray-600">
                  تم اختيار {files.length} ملف
                </p>
              )}
            </section>

            {/* الملاحظات */}
            <section>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ملاحظات إضافية
              </label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
                placeholder="أي ملاحظات أو تعليمات خاصة..."
              />
            </section>

            {/* أزرار الإجراءات */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-najd-blue text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
              >
                {loading ? 'جاري الإنشاء...' : 'إنشاء الطلب'}
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

      {/* نافذة طلب الشراء للخامات الناقصة */}
      {showPurchaseRequestModal && (
        <PurchaseRequestModal
          missingMaterials={missingMaterials}
          relatedOrderNumber={undefined}
          relatedOrderId={undefined}
          onClose={() => {
            setShowPurchaseRequestModal(false);
            setMissingMaterials([]);
            setPendingOrderData(null);
          }}
          onSuccess={() => {
            setShowPurchaseRequestModal(false);
            setMissingMaterials([]);
            setPendingOrderData(null);
            toast.success('تم إنشاء طلب الشراء بنجاح. يمكنك الآن إنشاء الطلب بدون هذه الخامات أو الانتظار حتى تتوفر.');
          }}
        />
      )}
    </div>
  );
}

