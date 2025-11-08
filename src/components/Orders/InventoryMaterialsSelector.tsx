/**
 * مكون اختيار الخامات من المخزون لربط الطلبات بالمخزون
 */

'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';

// أنواع الخامات من المخزون
interface InventoryItem {
  id: string;
  name: string;
  category: string;
  department: string;
  quantity: number;
  unit: string;
  status: string;
}

// خامة محددة للطلب
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

interface Props {
  selectedMaterials: OrderInventoryMaterial[];
  onChange: (materials: OrderInventoryMaterial[]) => void;
  onMissingMaterials: (missingItems: {
    itemName: string;
    category: string;
    requestedQuantity: number;
    availableQuantity: number;
    unit: string;
  }[]) => void;
}

export default function InventoryMaterialsSelector({ selectedMaterials, onChange, onMissingMaterials }: Props) {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // جلب الخامات المتاحة من جميع الأقسام
  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const inventoryRef = collection(db, 'inventory');
        const snapshot = await getDocs(inventoryRef);
        
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as InventoryItem[];

        setInventoryItems(items);
      } catch (error) {
        console.error('Error fetching inventory:', error);
        toast.error('فشل تحميل المخزون');
      } finally {
        setLoading(false);
      }
    };

    fetchInventory();
  }, []);

  // تصفية الخامات حسب البحث والفئة
  const filteredItems = inventoryItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.includes(searchTerm);
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // إضافة خامة
  const addMaterial = (item: InventoryItem) => {
    // التحقق من عدم إضافة نفس الخامة مرتين
    const exists = selectedMaterials.find((m) => m.inventoryItemId === item.id);
    if (exists) {
      toast.error('تم إضافة هذه الخامة بالفعل');
      return;
    }

    const newMaterial: OrderInventoryMaterial = {
      id: Math.random().toString(36).substr(2, 9),
      inventoryItemId: item.id,
      itemName: item.name,
      category: item.category,
      department: item.department,
      quantityUsed: 1,
      unit: item.unit,
      notes: '',
    };

    onChange([...selectedMaterials, newMaterial]);
    toast.success('تمت إضافة الخامة');
  };

  // حذف خامة
  const removeMaterial = (id: string) => {
    onChange(selectedMaterials.filter((m) => m.id !== id));
  };

  // تحديث كمية الخامة
  const updateQuantity = (id: string, quantity: number) => {
    onChange(
      selectedMaterials.map((m) =>
        m.id === id ? { ...m, quantityUsed: quantity } : m
      )
    );
  };

  // تحديث ملاحظات الخامة
  const updateNotes = (id: string, notes: string) => {
    onChange(
      selectedMaterials.map((m) =>
        m.id === id ? { ...m, notes } : m
      )
    );
  };

  // التحقق من توفر الكميات
  const checkAvailability = () => {
    const missing: {
      itemName: string;
      category: string;
      requestedQuantity: number;
      availableQuantity: number;
      unit: string;
    }[] = [];

    selectedMaterials.forEach((material) => {
      const inventoryItem = inventoryItems.find((i) => i.id === material.inventoryItemId);
      if (!inventoryItem) {
        missing.push({
          itemName: material.itemName,
          category: material.category,
          requestedQuantity: material.quantityUsed,
          availableQuantity: 0,
          unit: material.unit,
        });
      } else if (inventoryItem.quantity < material.quantityUsed) {
        missing.push({
          itemName: material.itemName,
          category: material.category,
          requestedQuantity: material.quantityUsed,
          availableQuantity: inventoryItem.quantity,
          unit: material.unit,
        });
      }
    });

    if (missing.length > 0) {
      onMissingMaterials(missing);
    }

    return missing.length === 0;
  };

  // الحصول على حالة التوفر للخامة
  const getAvailabilityStatus = (material: OrderInventoryMaterial) => {
    const inventoryItem = inventoryItems.find((i) => i.id === material.inventoryItemId);
    if (!inventoryItem) return { status: 'unavailable', message: 'غير متوفرة', color: 'text-red-600' };
    
    if (inventoryItem.quantity >= material.quantityUsed) {
      return { status: 'available', message: `متوفرة (${inventoryItem.quantity} ${material.unit})`, color: 'text-green-600' };
    } else if (inventoryItem.quantity > 0) {
      return { status: 'partial', message: `متوفر فقط ${inventoryItem.quantity} ${material.unit}`, color: 'text-orange-600' };
    } else {
      return { status: 'out', message: 'نفذت من المخزون', color: 'text-red-600' };
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-najd-blue"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-900">الخامات المطلوبة من المخزون</h3>
        <button
          type="button"
          onClick={checkAvailability}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
        >
          ✓ التحقق من التوفر
        </button>
      </div>

      {/* الخامات المحددة */}
      {selectedMaterials.length > 0 && (
        <div className="space-y-3 mb-6">
          <h4 className="text-sm font-medium text-gray-700">الخامات المحددة:</h4>
          {selectedMaterials.map((material) => {
            const availability = getAvailabilityStatus(material);
            return (
              <div key={material.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h5 className="font-medium text-gray-900">{material.itemName}</h5>
                    <p className="text-sm text-gray-600">
                      {material.category} - {material.department}
                    </p>
                    <p className={`text-sm font-medium ${availability.color}`}>
                      {availability.message}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMaterial(material.id)}
                    className="text-red-600 hover:text-red-800 text-xl"
                  >
                    ×
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      الكمية المطلوبة
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={material.quantityUsed}
                        onChange={(e) => updateQuantity(material.id, parseFloat(e.target.value) || 0)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                      />
                      <span className="text-sm text-gray-600">{material.unit}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ملاحظات
                    </label>
                    <input
                      type="text"
                      value={material.notes || ''}
                      onChange={(e) => updateNotes(material.id, e.target.value)}
                      placeholder="ملاحظات (اختياري)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* البحث والتصفية */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            🔍 البحث عن خامة
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث بالاسم أو النوع..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            📦 الفئة
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="all">الكل</option>
            <option value="paper">ورق</option>
            <option value="ink">أحبار</option>
            <option value="plates">بليتات</option>
            <option value="molds">قوالب</option>
            <option value="chemicals">كيماويات</option>
            <option value="other">أخرى</option>
          </select>
        </div>
      </div>

      {/* قائمة الخامات المتاحة */}
      <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            لا توجد خامات متاحة
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredItems.map((item) => {
              const isSelected = selectedMaterials.some((m) => m.inventoryItemId === item.id);
              return (
                <div
                  key={item.id}
                  className={`p-4 hover:bg-gray-50 transition ${isSelected ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900">{item.name}</h5>
                      <p className="text-sm text-gray-600">
                        {item.category} - {item.department}
                      </p>
                      <p className={`text-sm font-medium ${
                        item.quantity > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {item.quantity} {item.unit} متوفرة
                      </p>
                      <p className="text-xs text-gray-500">
                        الحالة: {
                          item.status === 'in_stock' ? '✓ متوفر' :
                          item.status === 'low_stock' ? '⚠️ قليل' :
                          item.status === 'out_of_stock' ? '❌ نفذ' :
                          item.status === 'ordered' ? '🛒 تم الطلب' : item.status
                        }
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => addMaterial(item)}
                      disabled={isSelected}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        isSelected
                          ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                          : 'bg-najd-blue text-white hover:bg-opacity-90'
                      }`}
                    >
                      {isSelected ? 'تم الإضافة' : '+ إضافة'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          💡 <strong>ملاحظة:</strong> سيتم تقليل المخزون تلقائياً عند إنشاء الطلب. 
          إذا كانت الكميات غير متوفرة، ستتمكن من إنشاء طلب شراء للمدير التنفيذي.
        </p>
      </div>
    </div>
  );
}


