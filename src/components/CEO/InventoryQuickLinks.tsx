/**
 * روابط سريعة للمخزون وطلبات الخامات - CEO
 */

'use client';

import { useRouter } from 'next/navigation';

export default function InventoryQuickLinks() {
  const router = useRouter();

  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      <button
        onClick={() => router.push('/ceo-dashboard/inventory')}
        className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
      >
        📦 المخزونات
      </button>
      <button
        onClick={() => router.push('/ceo-dashboard/material-requests')}
        className="p-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition text-sm font-medium"
      >
        📋 طلبات الخامات
      </button>
    </div>
  );
}


