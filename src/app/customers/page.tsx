'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import Navbar from '@/components/Layout/Navbar';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  getDocs,
} from 'firebase/firestore';
import { Customer, CreateCustomerInput } from '@/types/shared';
import toast from 'react-hot-toast';

interface CustomerStats {
  totalOrders: number;
  totalPaid: number;
  totalPending: number;
  completedOrders: number;
  lastOrderDate: Date | null;
}

export default function CustomersPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerStats, setCustomerStats] = useState<Map<string, CustomerStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CreateCustomerInput>({
    name: '',
    phone: '',
    email: '',
    address: '',
    company: '',
    taxNumber: '',
    notes: '',
  });

  useEffect(() => {
    if (!user) return;

    const customersRef = collection(db, 'customers');
    
    // إذا كان CEO أو رئيس قسم، يرى جميع العملاء
    // إذا كان مندوب مبيعات، يرى عملاءه فقط
    const customersQuery = user.role === 'ceo' || user.isHead
      ? query(customersRef, orderBy('createdAt', 'desc'))
      : query(
          customersRef,
          where('createdBy', '==', user.uid),
          orderBy('createdAt', 'desc')
        );

    const unsubscribe = onSnapshot(
      customersQuery,
      async (snapshot) => {
        const customersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Customer[];
        setCustomers(customersData);

        // إذا كان CEO، احسب الإحصائيات
        if (user.role === 'ceo' || user.isHead) {
          await fetchCustomerStats(customersData);
        }
        
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching customers:', error);
        toast.error('خطأ في جلب بيانات العملاء');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // جلب إحصائيات العملاء
  const fetchCustomerStats = async (customersList: Customer[]) => {
    const statsMap = new Map<string, CustomerStats>();

    for (const customer of customersList) {
      try {
        // جلب جميع الطلبات المرتبطة بهذا العميل
        const ordersQuery = query(
          collection(db, 'orders'),
          where('customerId', '==', customer.id)
        );
        
        const ordersSnapshot = await getDocs(ordersQuery);
        
        let totalOrders = 0;
        let totalPaid = 0;
        let totalPending = 0;
        let completedOrders = 0;
        let lastOrderDate: Date | null = null;

        ordersSnapshot.docs.forEach((doc) => {
          const orderData = doc.data();
          totalOrders++;

          // حساب المبالغ
          const finalCost = orderData.finalCost || orderData.estimatedCost || 0;
          const paidAmount = orderData.paidAmount || 0;
          
          totalPaid += paidAmount;
          totalPending += (finalCost - paidAmount);

          // عدد الطلبات المكتملة
          if (orderData.status === 'delivered') {
            completedOrders++;
          }

          // آخر طلب
          const orderDate = orderData.createdAt?.toDate?.() || new Date(orderData.createdAt);
          if (!lastOrderDate || orderDate > lastOrderDate) {
            lastOrderDate = orderDate;
          }
        });

        statsMap.set(customer.id, {
          totalOrders,
          totalPaid,
          totalPending,
          completedOrders,
          lastOrderDate,
        });
      } catch (error) {
        console.error(`Error fetching stats for customer ${customer.id}:`, error);
      }
    }

    setCustomerStats(statsMap);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      company: '',
      taxNumber: '',
      notes: '',
    });
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const newCustomer = {
        ...formData,
        createdBy: user.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'customers'), newCustomer);
      toast.success('تم إضافة العميل بنجاح');
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error adding customer:', error);
      toast.error('خطأ في إضافة العميل');
    }
  };

  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCustomer) return;

    try {
      const customerRef = doc(db, 'customers', selectedCustomer.id);
      await updateDoc(customerRef, {
        ...formData,
        updatedAt: Timestamp.now(),
      });
      toast.success('تم تحديث بيانات العميل بنجاح');
      setIsEditDialogOpen(false);
      setSelectedCustomer(null);
      resetForm();
    } catch (error) {
      console.error('Error updating customer:', error);
      toast.error('خطأ في تحديث بيانات العميل');
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا العميل؟')) return;

    try {
      await deleteDoc(doc(db, 'customers', customerId));
      toast.success('تم حذف العميل بنجاح');
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('خطأ في حذف العميل');
    }
  };

  const openEditDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address || '',
      company: customer.company || '',
      taxNumber: customer.taxNumber || '',
      notes: customer.notes || '',
    });
    setIsEditDialogOpen(true);
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-najd-blue"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8" dir="rtl">
        {/* Statistics Summary for CEO */}
        {(user.role === 'ceo' || user.isHead) && customerStats.size > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">إجمالي العملاء</p>
                  <p className="text-3xl font-bold mt-2">{customers.length}</p>
                </div>
                <div className="text-4xl opacity-80">👥</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">إجمالي الطلبات</p>
                  <p className="text-3xl font-bold mt-2">
                    {Array.from(customerStats.values()).reduce((sum, stat) => sum + stat.totalOrders, 0)}
                  </p>
                </div>
                <div className="text-4xl opacity-80">📦</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">إجمالي المدفوع</p>
                  <p className="text-2xl font-bold mt-2">
                    {Array.from(customerStats.values())
                      .reduce((sum, stat) => sum + stat.totalPaid, 0)
                      .toLocaleString('ar-SA')} ر.س
                  </p>
                </div>
                <div className="text-4xl opacity-80">💰</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">المبالغ المتبقية</p>
                  <p className="text-2xl font-bold mt-2">
                    {Array.from(customerStats.values())
                      .reduce((sum, stat) => sum + stat.totalPending, 0)
                      .toLocaleString('ar-SA')} ر.س
                  </p>
                </div>
                <div className="text-4xl opacity-80">⏳</div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">إدارة العملاء</h1>
                <p className="mt-1 text-sm text-gray-500">
                  {user?.role === 'ceo' || user?.isHead
                    ? 'عرض وإدارة جميع العملاء'
                    : 'عرض وإدارة عملائك'}
                </p>
              </div>
              <button
                onClick={() => setIsAddDialogOpen(true)}
                className="px-4 py-2 bg-najd-blue text-white rounded-md hover:bg-primary-700 transition font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                إضافة عميل جديد
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {customers.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="mt-4 text-gray-500">لا يوجد عملاء حتى الآن</p>
                <p className="text-sm text-gray-400 mt-2">قم بإضافة عميل جديد للبدء</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">اسم العميل</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">معلومات الاتصال</th>
                      {(user.role === 'ceo' || user.isHead) && (
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإحصائيات</th>
                      )}
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الشركة</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الرقم الضريبي</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">العنوان</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {customers.map((customer) => {
                      const stats = customerStats.get(customer.id);
                      return (
                        <tr key={customer.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900" dir="ltr">{customer.phone}</div>
                            {customer.email && (
                              <div className="text-sm text-gray-500">{customer.email}</div>
                            )}
                          </td>
                          {(user.role === 'ceo' || user.isHead) && (
                            <td className="px-6 py-4">
                              {stats ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                                      📦 {stats.totalOrders} طلب
                                    </span>
                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                                      ✅ {stats.completedOrders} مكتمل
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full font-medium">
                                      💰 {stats.totalPaid.toLocaleString('ar-SA')} ر.س
                                    </span>
                                  </div>
                                  {stats.totalPending > 0 && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-medium">
                                        ⏳ {stats.totalPending.toLocaleString('ar-SA')} ر.س متبقي
                                      </span>
                                    </div>
                                  )}
                                  {stats.lastOrderDate && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      آخر طلب: {new Date(stats.lastOrderDate).toLocaleDateString('ar-SA')}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-xs text-gray-400">لا توجد طلبات</div>
                              )}
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{customer.company || '-'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{customer.taxNumber || '-'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 max-w-xs line-clamp-2">
                              {customer.address || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => openEditDialog(customer)}
                              className="text-najd-blue hover:text-primary-700 ml-3"
                            >
                              تعديل
                            </button>
                            <button
                              onClick={() => handleDeleteCustomer(customer.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              حذف
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Customer Modal */}
      {isAddDialogOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" dir="rtl">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setIsAddDialogOpen(false)}></div>
            
            <div className="inline-block w-full max-w-2xl my-8 overflow-hidden text-right align-middle transition-all transform bg-white rounded-lg shadow-xl">
              <div className="px-6 py-5 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">إضافة عميل جديد</h3>
                <p className="mt-1 text-sm text-gray-500">أدخل بيانات العميل الجديد</p>
              </div>
              
              <form onSubmit={handleAddCustomer} className="px-6 py-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">اسم العميل *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
                      placeholder="اسم العميل"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">رقم الجوال *</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
                      placeholder="05xxxxxxxx"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
                      placeholder="customer@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">اسم الشركة</label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
                      placeholder="اسم الشركة"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الرقم الضريبي</label>
                    <input
                      type="text"
                      value={formData.taxNumber}
                      onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
                      placeholder="الرقم الضريبي"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
                      placeholder="عنوان العميل"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
                      placeholder="ملاحظات إضافية عن العميل"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddDialogOpen(false);
                      resetForm();
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-najd-blue rounded-md hover:bg-primary-700"
                  >
                    إضافة
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {isEditDialogOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 overflow-y-auto" dir="rtl">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setIsEditDialogOpen(false)}></div>
            
            <div className="inline-block w-full max-w-2xl my-8 overflow-hidden text-right align-middle transition-all transform bg-white rounded-lg shadow-xl">
              <div className="px-6 py-5 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">تعديل بيانات العميل</h3>
                <p className="mt-1 text-sm text-gray-500">تحديث بيانات {selectedCustomer.name}</p>
              </div>
              
              <form onSubmit={handleEditCustomer} className="px-6 py-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">اسم العميل *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">رقم الجوال *</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">اسم الشركة</label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الرقم الضريبي</label>
                    <input
                      type="text"
                      value={formData.taxNumber}
                      onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      setSelectedCustomer(null);
                      resetForm();
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-najd-blue rounded-md hover:bg-primary-700"
                  >
                    تحديث
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
