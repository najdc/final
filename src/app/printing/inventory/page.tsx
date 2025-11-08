/**
 * صفحة إدارة مخزون الطباعة
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Layout/Navbar';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDoc,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';
import { notifyCEO, notifyCEOInventoryOutOfStock, notifyCEOInventoryLowStock } from '@/utils/ceoNotifications';
import {
  PlusIcon,
  PencilIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';

// الأنواع المحلية
type MaterialCategory = 'paper' | 'ink' | 'plates' | 'molds' | 'chemicals' | 'other';
type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'ordered';

interface InventoryItem {
  id: string;
  category: MaterialCategory;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  minQuantity: number;
  maxQuantity?: number;
  status: StockStatus;
  location?: string;
  supplier?: string;
  lastRestocked?: string;
  createdBy: string;
  createdByName: string;
  department: string;
  createdAt: any;
  updatedAt: any;
}

export default function PrintingInventoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);

  // التحقق من الصلاحيات
  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }

    if (user.department !== 'printing') {
      toast.error('هذه الصفحة لقسم الطباعة فقط');
      router.push('/');
      return;
    }
  }, [user, router]);

  // جلب عناصر المخزون
  useEffect(() => {
    if (!user || user.department !== 'printing') return;

    const q = query(
      collection(db, 'inventory'),
      where('department', '==', 'printing')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const inventoryItems: InventoryItem[] = [];
      snapshot.forEach((doc) => {
        inventoryItems.push({ id: doc.id, ...doc.data() } as InventoryItem);
      });

      // ترتيب حسب الحالة (الناقص أولاً)
      inventoryItems.sort((a, b) => {
        const statusOrder = { out_of_stock: 0, low_stock: 1, in_stock: 2, ordered: 3 };
        return statusOrder[a.status] - statusOrder[b.status];
      });

      setItems(inventoryItems);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (!user || user.department !== 'printing') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8" dir="rtl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">مخزون الطباعة</h1>
              <p className="mt-2 text-gray-600">إدارة الخامات والأوراق والأحبار</p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowRequestModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
              >
                <ClipboardDocumentListIcon className="h-5 w-5" />
                طلب خامات
              </button>
              
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-najd-blue text-white rounded-lg hover:bg-primary-700 transition"
              >
                <PlusIcon className="h-5 w-5" />
                إضافة مادة
              </button>
            </div>
          </div>
        </div>

        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="إجمالي المواد"
            value={items.length}
            icon="📦"
            color="blue"
          />
          <StatCard
            title="متوفر"
            value={items.filter((i) => i.status === 'in_stock').length}
            icon="✅"
            color="green"
          />
          <StatCard
            title="قليل"
            value={items.filter((i) => i.status === 'low_stock').length}
            icon="⚠️"
            color="yellow"
          />
          <StatCard
            title="نفذ"
            value={items.filter((i) => i.status === 'out_of_stock').length}
            icon="❌"
            color="red"
          />
        </div>

        {/* قائمة المخزون */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">المواد المتاحة</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">جاري التحميل...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 mb-4">لا توجد مواد في المخزون</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-najd-blue text-white rounded-lg hover:bg-primary-700"
              >
                إضافة أول مادة
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      المادة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      النوع
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      الكمية
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      الحالة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      الموقع
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      إجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item) => (
                    <InventoryRow
                      key={item.id}
                      item={item}
                      onEdit={() => {
                        setSelectedItem(item);
                        setShowEditModal(true);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* زر عرض طلبات الخامات */}
        <div className="mt-6">
          <button
            onClick={() => router.push('/printing/material-requests')}
            className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
          >
            عرض طلبات الخامات السابقة
          </button>
        </div>
      </main>

      {/* Modal إضافة مادة */}
      {showAddModal && (
        <AddItemModal
          onClose={() => setShowAddModal(false)}
          userId={user.uid}
          userName={user.displayName}
        />
      )}

      {/* Modal تعديل مادة */}
      {showEditModal && selectedItem && (
        <EditItemModal
          item={selectedItem}
          onClose={() => {
            setShowEditModal(false);
            setSelectedItem(null);
          }}
        />
      )}

      {/* Modal طلب خامات */}
      {showRequestModal && (
        <MaterialRequestModal
          onClose={() => setShowRequestModal(false)}
          userId={user.uid}
          userName={user.displayName}
          department={user.department}
          items={items}
        />
      )}
    </div>
  );
}

// مكون إحصائية
function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: string;
  color: string;
}) {
  const colors = {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`text-4xl ${colors[color as keyof typeof colors]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// مكون صف في الجدول
function InventoryRow({
  item,
  onEdit,
}: {
  item: InventoryItem;
  onEdit: () => void;
}) {
  const getStatusBadge = (status: StockStatus) => {
    const badges = {
      in_stock: { text: 'متوفر', class: 'bg-green-100 text-green-800' },
      low_stock: { text: 'قليل', class: 'bg-yellow-100 text-yellow-800' },
      out_of_stock: { text: 'نفذ', class: 'bg-red-100 text-red-800' },
      ordered: { text: 'تم الطلب', class: 'bg-blue-100 text-blue-800' },
    };
    return badges[status];
  };

  const getCategoryLabel = (category: MaterialCategory) => {
    const labels = {
      paper: 'ورق',
      ink: 'أحبار',
      plates: 'بليتات',
      molds: 'قوالب',
      chemicals: 'كيماويات',
      other: 'أخرى',
    };
    return labels[category];
  };

  const badge = getStatusBadge(item.status);
  const percentage = (item.quantity / item.minQuantity) * 100;

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4">
        <div>
          <div className="font-medium text-gray-900">{item.name}</div>
          {item.description && (
            <div className="text-sm text-gray-500">{item.description}</div>
          )}
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-900">
        {getCategoryLabel(item.category)}
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">
          <span className="font-bold">{item.quantity}</span> {item.unit}
        </div>
        <div className="text-xs text-gray-500">
          الحد الأدنى: {item.minQuantity} {item.unit}
        </div>
        {/* Progress bar */}
        <div className="mt-1 w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${
              percentage > 50
                ? 'bg-green-500'
                : percentage > 20
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </td>
      <td className="px-6 py-4">
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.class}`}>
          {badge.text}
        </span>
      </td>
      <td className="px-6 py-4 text-sm text-gray-900">
        {item.location || '-'}
      </td>
      <td className="px-6 py-4">
        <button
          onClick={onEdit}
          className="text-najd-blue hover:text-primary-700 font-medium"
        >
          <PencilIcon className="h-5 w-5 inline ml-1" />
          تعديل
        </button>
      </td>
    </tr>
  );
}

// Modal إضافة مادة
function AddItemModal({
  onClose,
  userId,
  userName,
}: {
  onClose: () => void;
  userId: string;
  userName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    category: 'paper' as MaterialCategory,
    name: '',
    description: '',
    quantity: 0,
    unit: 'كجم',
    minQuantity: 0,
    maxQuantity: '',
    location: '',
    supplier: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // تحديد الحالة بناءً على الكمية
      let status: StockStatus = 'in_stock';
      if (formData.quantity === 0) {
        status = 'out_of_stock';
      } else if (formData.quantity <= formData.minQuantity) {
        status = 'low_stock';
      }

      const itemData: any = {
        category: formData.category,
        name: formData.name,
        quantity: formData.quantity,
        unit: formData.unit,
        minQuantity: formData.minQuantity,
        status,
        department: 'printing',
        createdBy: userId,
        createdByName: userName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // إضافة الحقول الاختيارية فقط إذا كانت موجودة
      if (formData.description) itemData.description = formData.description;
      if (formData.maxQuantity) itemData.maxQuantity = Number(formData.maxQuantity);
      if (formData.location) itemData.location = formData.location;
      if (formData.supplier) itemData.supplier = formData.supplier;

      await addDoc(collection(db, 'inventory'), itemData);

      toast.success('تم إضافة المادة بنجاح');
      onClose();
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('فشل إضافة المادة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">إضافة مادة جديدة</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* النوع */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                نوع المادة *
              </label>
              <select
                required
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value as MaterialCategory })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-najd-blue focus:border-najd-blue"
              >
                <option value="paper">ورق</option>
                <option value="ink">أحبار</option>
                <option value="plates">بليتات</option>
                <option value="molds">قوالب</option>
                <option value="chemicals">كيماويات</option>
                <option value="other">أخرى</option>
              </select>
            </div>

            {/* الاسم */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                اسم المادة *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-najd-blue focus:border-najd-blue"
                placeholder="مثال: ورق A4 أبيض 80 جرام"
              />
            </div>

            {/* الكمية الحالية */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الكمية الحالية *
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                required
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-najd-blue focus:border-najd-blue"
              />
            </div>

            {/* الوحدة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                وحدة القياس *
              </label>
              <input
                type="text"
                required
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-najd-blue focus:border-najd-blue"
                placeholder="كجم، لتر، ورقة، علبة، ..."
              />
            </div>

            {/* الحد الأدنى */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الحد الأدنى *
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                required
                value={formData.minQuantity}
                onChange={(e) =>
                  setFormData({ ...formData, minQuantity: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-najd-blue focus:border-najd-blue"
              />
              <p className="text-xs text-gray-500 mt-1">تنبيه عند النقص عن هذا الحد</p>
            </div>

            {/* الحد الأقصى */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الحد الأقصى (اختياري)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={formData.maxQuantity}
                onChange={(e) => setFormData({ ...formData, maxQuantity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-najd-blue focus:border-najd-blue"
              />
            </div>

            {/* الموقع */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                موقع التخزين (اختياري)
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-najd-blue focus:border-najd-blue"
                placeholder="مثال: رف A1، مخزن رقم 2"
              />
            </div>

            {/* المورد */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                المورد (اختياري)
              </label>
              <input
                type="text"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-najd-blue focus:border-najd-blue"
                placeholder="اسم المورد"
              />
            </div>
          </div>

          {/* الوصف */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              وصف تفصيلي (اختياري)
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-najd-blue focus:border-najd-blue"
              placeholder="معلومات إضافية عن المادة..."
            />
          </div>

          {/* الأزرار */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-najd-blue text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'جاري الإضافة...' : 'إضافة'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal تعديل مادة
function EditItemModal({
  item,
  onClose,
}: {
  item: InventoryItem;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(item.quantity);
  const [notes, setNotes] = useState('');
  const { user } = useAuth();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // تحديد الحالة بناءً على الكمية
      let status: StockStatus = 'in_stock';
      if (quantity === 0) {
        status = 'out_of_stock';
      } else if (quantity <= item.minQuantity) {
        status = 'low_stock';
      }

      const updateData: any = {
        quantity,
        status,
        updatedAt: serverTimestamp(),
      };

      if (quantity > item.quantity) {
        updateData.lastRestocked = new Date().toISOString();
      }

      // تنبيه CEO عند نفاد المادة
      if (status === 'out_of_stock' && item.status !== 'out_of_stock') {
        await notifyCEOInventoryOutOfStock(item.name, item.department);
      }

      // تنبيه CEO عند نقص المادة
      if (status === 'low_stock' && item.status !== 'low_stock') {
        await notifyCEOInventoryLowStock(item.name, quantity, item.unit, item.department);
      }

      await updateDoc(doc(db, 'inventory', item.id), updateData);

      // سجل الحركة
      await addDoc(collection(db, 'inventory_transactions'), {
        inventoryItemId: item.id,
        type: quantity > item.quantity ? 'in' : quantity < item.quantity ? 'out' : 'adjustment',
        quantity: Math.abs(quantity - item.quantity),
        previousQuantity: item.quantity,
        newQuantity: quantity,
        reason: notes || 'تحديث الكمية',
        performedBy: user!.uid,
        performedByName: user!.displayName,
        notes: notes || undefined,
        createdAt: serverTimestamp(),
      });

      toast.success('تم تحديث الكمية بنجاح');
      onClose();
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('فشل تحديث المادة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">تحديث: {item.name}</h2>
        </div>

        <form onSubmit={handleUpdate} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              الكمية الحالية
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="0"
                step="0.1"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-najd-blue focus:border-najd-blue text-lg font-bold"
              />
              <span className="text-gray-600">{item.unit}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              الكمية السابقة: {item.quantity} {item.unit}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ملاحظات (سبب التغيير)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-najd-blue focus:border-najd-blue"
              placeholder="مثال: تم استلام شحنة جديدة، استخدام في طلب رقم..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-najd-blue text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'جاري التحديث...' : 'تحديث'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal طلب خامات
function MaterialRequestModal({
  onClose,
  userId,
  userName,
  department,
  items,
}: {
  onClose: () => void;
  userId: string;
  userName: string;
  department: string;
  items: InventoryItem[];
}) {
  const [loading, setLoading] = useState(false);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const getDepartmentLabel = (dept: string) => {
    const labels: Record<string, string> = {
      printing: 'الطباعة',
      design: 'التصميم',
      dispatch: 'الإرسال',
      accounting: 'الحسابات',
    };
    return labels[dept] || dept;
  };
  const [selectedItems, setSelectedItems] = useState<
    Array<{
      inventoryItemId: string;
      name: string;
      category: MaterialCategory;
      requestedQuantity: number;
      unit: string;
      estimatedCost: number;
      notes: string;
    }>
  >([]);

  const addItem = () => {
    setSelectedItems([
      ...selectedItems,
      {
        inventoryItemId: '',
        name: '',
        category: 'paper',
        requestedQuantity: 0,
        unit: 'كجم',
        estimatedCost: 0,
        notes: '',
      },
    ]);
  };

  const removeItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...selectedItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // إذا تم اختيار مادة من المخزون، املأ البيانات تلقائياً
    if (field === 'inventoryItemId' && value) {
      const inventoryItem = items.find((item) => item.id === value);
      if (inventoryItem) {
        updated[index].name = inventoryItem.name;
        updated[index].category = inventoryItem.category;
        updated[index].unit = inventoryItem.unit;
      }
    }
    
    setSelectedItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedItems.length === 0) {
      toast.error('يرجى إضافة مادة واحدة على الأقل');
      return;
    }

    setLoading(true);

    try {
      // توليد رقم الطلب
      const year = new Date().getFullYear();
      const randomNum = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0');
      const requestNumber = `MATREQ-${year}-${randomNum}`;

      const requestData: any = {
        requestNumber,
        status: 'pending',
        items: selectedItems.map((item: any) => {
          const requestItem: any = {
            id: Date.now().toString() + Math.random(),
            category: item.category,
            name: item.name,
            requestedQuantity: item.requestedQuantity,
            unit: item.unit,
          };
          
          if (item.inventoryItemId) requestItem.inventoryItemId = item.inventoryItemId;
          if (item.estimatedCost) requestItem.estimatedCost = item.estimatedCost;
          if (item.notes) requestItem.notes = item.notes;
          
          return requestItem;
        }),
        requestedBy: userId,
        requestedByName: userName,
        department,
        priority,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (reason) requestData.reason = reason;
      if (notes) requestData.notes = notes;

      await addDoc(collection(db, 'material_requests'), requestData);

      // إرسال إشعار لرئيس القسم
      const headQuery = query(
        collection(db, 'users'),
        where('department', '==', department),
        where('isHead', '==', true),
        where('isActive', '==', true)
      );

      const headSnapshot = await getDocs(headQuery);
      
      // إرسال إشعار لكل رئيس قسم (عادة واحد)
      for (const headDoc of headSnapshot.docs) {
        await addDoc(collection(db, 'notifications'), {
          type: 'material_request',
          title: 'طلب خامات جديد 📦',
          message: `طلب خامات جديد من ${userName} - ${requestNumber}`,
          recipientId: headDoc.id,
          orderId: null,
          isRead: false,
          isActionRequired: true,
          createdAt: serverTimestamp(),
          actionUrl: '/printing/material-requests',
        });
      }

      // إرسال إشعار للـ CEO أيضاً
      const ceoQuery = query(
        collection(db, 'users'),
        where('role', '==', 'ceo'),
        where('isActive', '==', true)
      );

      const ceoSnapshot = await getDocs(ceoQuery);
      
      for (const ceoDoc of ceoSnapshot.docs) {
        await addDoc(collection(db, 'notifications'), {
          type: 'material_request',
          title: 'طلب خامات جديد من قسم الطباعة 📦',
          message: `طلب خامات من ${userName} (${getDepartmentLabel(department)}) - ${requestNumber}`,
          recipientId: ceoDoc.id,
          orderId: null,
          isRead: false,
          isActionRequired: true,
          createdAt: serverTimestamp(),
          actionUrl: '/ceo-dashboard/material-requests',
        });
      }

      toast.success('تم إرسال طلب الخامات بنجاح');
      onClose();
    } catch (error) {
      console.error('Error creating material request:', error);
      toast.error('فشل إرسال الطلب');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">طلب خامات جديدة</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* معلومات عامة */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الأولوية *
              </label>
              <select
                required
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-najd-blue focus:border-najd-blue"
              >
                <option value="low">منخفضة</option>
                <option value="medium">متوسطة</option>
                <option value="high">عالية</option>
                <option value="urgent">عاجل</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                سبب الطلب
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-najd-blue focus:border-najd-blue"
                placeholder="مثال: نفاد الأحبار، طلبات كثيرة..."
              />
            </div>
          </div>

          {/* المواد المطلوبة */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">المواد المطلوبة</h3>
              <button
                type="button"
                onClick={addItem}
                className="px-4 py-2 bg-najd-gold text-najd-blue rounded-lg hover:bg-yellow-500 transition"
              >
                + إضافة مادة
              </button>
            </div>

            <div className="space-y-4">
              {selectedItems.map((item, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium text-gray-900">مادة #{index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      × حذف
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* اختيار من المخزون أو جديدة */}
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        اختر من المخزون (اختياري)
                      </label>
                      <select
                        value={item.inventoryItemId}
                        onChange={(e) => updateItem(index, 'inventoryItemId', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                      >
                        <option value="">-- مادة جديدة --</option>
                        {items.map((invItem) => (
                          <option key={invItem.id} value={invItem.id}>
                            {invItem.name} ({invItem.quantity} {invItem.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* الاسم */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        اسم المادة *
                      </label>
                      <input
                        type="text"
                        required
                        value={item.name}
                        onChange={(e) => updateItem(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                      />
                    </div>

                    {/* الكمية */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        الكمية المطلوبة *
                      </label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        required
                        value={item.requestedQuantity}
                        onChange={(e) =>
                          updateItem(index, 'requestedQuantity', parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                      />
                    </div>

                    {/* الوحدة */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        الوحدة *
                      </label>
                      <input
                        type="text"
                        required
                        value={item.unit}
                        onChange={(e) => updateItem(index, 'unit', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                      />
                    </div>

                    {/* التكلفة المقدرة */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        التكلفة المقدرة (ر.س)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.estimatedCost}
                        onChange={(e) =>
                          updateItem(index, 'estimatedCost', parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {selectedItems.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-4">لا توجد مواد مطلوبة</p>
                  <button
                    type="button"
                    onClick={addItem}
                    className="px-4 py-2 bg-najd-blue text-white rounded-lg"
                  >
                    إضافة مادة
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ملاحظات إضافية */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ملاحظات إضافية
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-najd-blue focus:border-najd-blue"
              placeholder="أي معلومات إضافية..."
            />
          </div>

          {/* الأزرار */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading || selectedItems.length === 0}
              className="flex-1 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'جاري الإرسال...' : 'إرسال طلب الخامات'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

