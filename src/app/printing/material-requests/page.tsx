/**
 * صفحة طلبات الخامات
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
  orderBy,
  updateDoc,
  doc,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';
import { format } from 'date-fns/format';
import { ar } from 'date-fns/locale/ar';

type MaterialRequestStatus = 'pending' | 'approved' | 'rejected' | 'ordered' | 'received';

interface MaterialRequest {
  id: string;
  requestNumber: string;
  status: MaterialRequestStatus;
  items: any[];
  requestedBy: string;
  requestedByName: string;
  department: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reason?: string;
  notes?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: any;
  rejectedReason?: string;
  createdAt: any;
  updatedAt: any;
}

export default function MaterialRequestsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | MaterialRequestStatus>('all');

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

  // جلب الطلبات
  useEffect(() => {
    if (!user || user.department !== 'printing') return;

    let q = query(
      collection(db, 'material_requests'),
      where('department', '==', 'printing'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const materialRequests: MaterialRequest[] = [];
      snapshot.forEach((doc) => {
        materialRequests.push({ id: doc.id, ...doc.data() } as MaterialRequest);
      });

      setRequests(materialRequests);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredRequests =
    filter === 'all' ? requests : requests.filter((r) => r.status === filter);

  if (!user || user.department !== 'printing') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8" dir="rtl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">طلبات الخامات</h1>
          <p className="mt-2 text-gray-600">جميع طلبات الخامات المرسلة</p>
        </div>

        {/* الفلاتر */}
        <div className="mb-6 flex gap-2 flex-wrap">
          <FilterButton
            label="الكل"
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            count={requests.length}
          />
          <FilterButton
            label="قيد الانتظار"
            active={filter === 'pending'}
            onClick={() => setFilter('pending')}
            count={requests.filter((r) => r.status === 'pending').length}
            color="yellow"
          />
          <FilterButton
            label="موافق عليه"
            active={filter === 'approved'}
            onClick={() => setFilter('approved')}
            count={requests.filter((r) => r.status === 'approved').length}
            color="green"
          />
          <FilterButton
            label="مرفوض"
            active={filter === 'rejected'}
            onClick={() => setFilter('rejected')}
            count={requests.filter((r) => r.status === 'rejected').length}
            color="red"
          />
          <FilterButton
            label="تم الطلب"
            active={filter === 'ordered'}
            onClick={() => setFilter('ordered')}
            count={requests.filter((r) => r.status === 'ordered').length}
            color="blue"
          />
          <FilterButton
            label="تم الاستلام"
            active={filter === 'received'}
            onClick={() => setFilter('received')}
            count={requests.filter((r) => r.status === 'received').length}
            color="green"
          />
        </div>

        {/* قائمة الطلبات */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">جاري التحميل...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500 mb-4">لا توجد طلبات</p>
              <button
                onClick={() => router.push('/printing/inventory')}
                className="px-4 py-2 bg-najd-blue text-white rounded-lg"
              >
                العودة للمخزون
              </button>
            </div>
          ) : (
            filteredRequests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
  count,
  color = 'gray',
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
  color?: string;
}) {
  const colors = {
    gray: 'bg-gray-100 text-gray-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-blue-100 text-blue-800',
  };

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

function RequestCard({ request }: { request: MaterialRequest }) {
  const getStatusBadge = (status: MaterialRequestStatus) => {
    const badges = {
      pending: { text: 'قيد الانتظار', class: 'bg-yellow-100 text-yellow-800' },
      approved: { text: 'موافق عليه', class: 'bg-green-100 text-green-800' },
      rejected: { text: 'مرفوض', class: 'bg-red-100 text-red-800' },
      ordered: { text: 'تم الطلب', class: 'bg-blue-100 text-blue-800' },
      received: { text: 'تم الاستلام', class: 'bg-green-100 text-green-800' },
    };
    return badges[status];
  };

  const getPriorityBadge = (priority: string) => {
    const badges = {
      low: { text: 'منخفضة', class: 'bg-gray-100 text-gray-800' },
      medium: { text: 'متوسطة', class: 'bg-blue-100 text-blue-800' },
      high: { text: 'عالية', class: 'bg-orange-100 text-orange-800' },
      urgent: { text: 'عاجل', class: 'bg-red-100 text-red-800' },
    };
    return badges[priority as keyof typeof badges];
  };

  const statusBadge = getStatusBadge(request.status);
  const priorityBadge = getPriorityBadge(request.priority);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">{request.requestNumber}</h3>
          <p className="text-sm text-gray-500 mt-1">
            بواسطة: {request.requestedByName} •{' '}
            {request.createdAt &&
              format(
                request.createdAt.toDate?.() || new Date(request.createdAt),
                'dd MMMM yyyy',
                { locale: ar }
              )}
          </p>
        </div>

        <div className="flex gap-2">
          <span className={`px-3 py-1 text-sm font-semibold rounded-full ${priorityBadge.class}`}>
            {priorityBadge.text}
          </span>
          <span className={`px-3 py-1 text-sm font-semibold rounded-full ${statusBadge.class}`}>
            {statusBadge.text}
          </span>
        </div>
      </div>

      {/* السبب */}
      {request.reason && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm font-medium text-blue-900">السبب:</p>
          <p className="text-sm text-blue-800">{request.reason}</p>
        </div>
      )}

      {/* المواد المطلوبة */}
      <div className="mb-4">
        <h4 className="font-medium text-gray-900 mb-2">المواد المطلوبة:</h4>
        <div className="space-y-2">
          {request.items.map((item: any, index: number) => (
            <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <div>
                <p className="font-medium text-gray-900">{item.name}</p>
                {item.notes && <p className="text-sm text-gray-500">{item.notes}</p>}
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900">
                  {item.requestedQuantity} {item.unit}
                </p>
                {item.estimatedCost && (
                  <p className="text-sm text-gray-500">{item.estimatedCost} ر.س</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* الملاحظات */}
      {request.notes && (
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700">ملاحظات:</p>
          <p className="text-sm text-gray-600">{request.notes}</p>
        </div>
      )}

      {/* سبب الرفض */}
      {request.status === 'rejected' && request.rejectedReason && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm font-medium text-red-900">سبب الرفض:</p>
          <p className="text-sm text-red-800">{request.rejectedReason}</p>
        </div>
      )}

      {/* معلومات الموافقة */}
      {request.status === 'approved' && request.approvedBy && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm text-green-800">
            تمت الموافقة بواسطة: {request.approvedByName}
          </p>
        </div>
      )}
    </div>
  );
}


