/**
 * صفحة عرض جميع المخزونات - للـ CEO
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Layout/Navbar';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';

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
  department: string;
  createdByName: string;
  createdAt: any;
  updatedAt: any;
}

export default function CEOInventoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  // التحقق من الصلاحيات
  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }

    if (user.role !== 'ceo') {
      toast.error('هذه الصفحة للمدير التنفيذي فقط');
      router.push('/');
      return;
    }
  }, [user, router]);

  // جلب جميع عناصر المخزون (كل الأقسام)
  useEffect(() => {
    if (!user || user.role !== 'ceo') return;

    const q = query(
      collection(db, 'inventory'),
      orderBy('department', 'asc')
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

  if (!user || user.role !== 'ceo') {
    return null;
  }

  // فلترة حسب القسم
  const filteredItems =
    selectedDepartment === 'all'
      ? items
      : items.filter((item) => item.department === selectedDepartment);

  // إحصائيات حسب القسم
  const departmentStats = {
    all: items.length,
    printing: items.filter((i) => i.department === 'printing').length,
    design: items.filter((i) => i.department === 'design').length,
    dispatch: items.filter((i) => i.department === 'dispatch').length,
  };

  // إحصائيات حسب الحالة
  const statusStats = {
    in_stock: filteredItems.filter((i) => i.status === 'in_stock').length,
    low_stock: filteredItems.filter((i) => i.status === 'low_stock').length,
    out_of_stock: filteredItems.filter((i) => i.status === 'out_of_stock').length,
  };

  const getDepartmentLabel = (dept: string) => {
    const labels: Record<string, string> = {
      printing: 'الطباعة',
      design: 'التصميم',
      dispatch: 'الإرسال',
      accounting: 'الحسابات',
      sales: 'المبيعات',
    };
    return labels[dept] || dept;
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

  const getStatusBadge = (status: StockStatus) => {
    const badges = {
      in_stock: { text: 'متوفر', class: 'bg-green-100 text-green-800' },
      low_stock: { text: 'قليل', class: 'bg-yellow-100 text-yellow-800' },
      out_of_stock: { text: 'نفذ', class: 'bg-red-100 text-red-800' },
      ordered: { text: 'تم الطلب', class: 'bg-blue-100 text-blue-800' },
    };
    return badges[status];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8" dir="rtl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">مخزون جميع الأقسام</h1>
              <p className="mt-2 text-gray-600">متابعة الخامات والمواد في كل الأقسام</p>
            </div>

            <button
              onClick={() => router.push('/ceo-dashboard/material-requests')}
              className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium shadow-md"
            >
              📋 طلبات الخامات
            </button>
          </div>
        </div>

        {/* إحصائيات عامة */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard
            title="متوفر"
            value={statusStats.in_stock}
            icon="✅"
            color="green"
          />
          <StatCard
            title="قليل (يحتاج طلب)"
            value={statusStats.low_stock}
            icon="⚠️"
            color="yellow"
          />
          <StatCard
            title="نفذ (عاجل)"
            value={statusStats.out_of_stock}
            icon="❌"
            color="red"
          />
        </div>

        {/* فلتر الأقسام */}
        <div className="mb-6 flex gap-2 flex-wrap">
          <DepartmentFilter
            label="جميع الأقسام"
            active={selectedDepartment === 'all'}
            onClick={() => setSelectedDepartment('all')}
            count={departmentStats.all}
          />
          <DepartmentFilter
            label="الطباعة"
            active={selectedDepartment === 'printing'}
            onClick={() => setSelectedDepartment('printing')}
            count={departmentStats.printing}
          />
          <DepartmentFilter
            label="التصميم"
            active={selectedDepartment === 'design'}
            onClick={() => setSelectedDepartment('design')}
            count={departmentStats.design}
          />
          <DepartmentFilter
            label="الإرسال"
            active={selectedDepartment === 'dispatch'}
            onClick={() => setSelectedDepartment('dispatch')}
            count={departmentStats.dispatch}
          />
        </div>

        {/* جدول المخزون */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              {selectedDepartment === 'all'
                ? 'جميع المواد'
                : `مواد قسم ${getDepartmentLabel(selectedDepartment)}`}
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">جاري التحميل...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">لا توجد مواد</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      القسم
                    </th>
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
                      المورد
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredItems.map((item) => {
                    const badge = getStatusBadge(item.status);
                    const percentage = (item.quantity / item.minQuantity) * 100;

                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {getDepartmentLabel(item.department)}
                        </td>
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
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.class}`}
                          >
                            {badge.text}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {item.location || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {item.supplier || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ملخص سريع */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">ملخص الحالة</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-red-800 font-medium mb-2">❌ مواد نفذت (تحتاج طلب فوري)</p>
              {items.filter((i) => i.status === 'out_of_stock').length === 0 ? (
                <p className="text-xs text-red-600">لا توجد مواد نفذت ✅</p>
              ) : (
                <ul className="text-xs text-red-700 space-y-1">
                  {items
                    .filter((i) => i.status === 'out_of_stock')
                    .map((item) => (
                      <li key={item.id}>
                        • {item.name} ({getDepartmentLabel(item.department)})
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-800 font-medium mb-2">⚠️ مواد قليلة (تحتاج طلب قريباً)</p>
              {items.filter((i) => i.status === 'low_stock').length === 0 ? (
                <p className="text-xs text-yellow-600">لا توجد مواد قليلة ✅</p>
              ) : (
                <ul className="text-xs text-yellow-700 space-y-1">
                  {items
                    .filter((i) => i.status === 'low_stock')
                    .slice(0, 5)
                    .map((item) => (
                      <li key={item.id}>
                        • {item.name} ({getDepartmentLabel(item.department)}) - {item.quantity}{' '}
                        {item.unit}
                      </li>
                    ))}
                  {items.filter((i) => i.status === 'low_stock').length > 5 && (
                    <li className="font-medium">
                      ... و {items.filter((i) => i.status === 'low_stock').length - 5} أخرى
                    </li>
                  )}
                </ul>
              )}
            </div>

            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-800 font-medium mb-2">✅ مواد متوفرة</p>
              <p className="text-3xl font-bold text-green-600">
                {items.filter((i) => i.status === 'in_stock').length}
              </p>
              <p className="text-xs text-green-700">من أصل {items.length} مادة</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// مكون فلتر القسم
function DepartmentFilter({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium transition ${
        active
          ? 'bg-najd-blue text-white'
          : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
      }`}
    >
      {label} ({count})
    </button>
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
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  );
}


