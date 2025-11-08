/**
 * صفحة طلبات الخامات - للـ CEO
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

export default function CEOMaterialRequestsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | MaterialRequestStatus>('all');
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

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

  // جلب جميع الطلبات
  useEffect(() => {
    if (!user || user.role !== 'ceo') return;

    const q = query(
      collection(db, 'material_requests'),
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

  // الموافقة على الطلب
  const handleApprove = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'material_requests', requestId), {
        status: 'approved',
        approvedBy: user!.uid,
        approvedByName: user!.displayName,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // إشعار للموظف
      const request = requests.find((r) => r.id === requestId);
      if (request) {
        await addDoc(collection(db, 'notifications'), {
          type: 'material_request_approved',
          title: 'تمت الموافقة على طلب الخامات ✅',
          message: `تمت الموافقة على طلبك ${request.requestNumber}`,
          recipientId: request.requestedBy,
          isRead: false,
          isActionRequired: false,
          createdAt: serverTimestamp(),
          actionUrl: '/printing/material-requests',
        });
      }

      toast.success('تمت الموافقة على الطلب');
      setShowApprovalModal(false);
      setSelectedRequest(null);
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('فشلت الموافقة');
    }
  };

  // رفض الطلب
  const handleReject = async (requestId: string, reason: string) => {
    try {
      await updateDoc(doc(db, 'material_requests', requestId), {
        status: 'rejected',
        rejectedReason: reason,
        approvedBy: user!.uid,
        approvedByName: user!.displayName,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // إشعار للموظف
      const request = requests.find((r) => r.id === requestId);
      if (request) {
        await addDoc(collection(db, 'notifications'), {
          type: 'material_request_rejected',
          title: 'تم رفض طلب الخامات ❌',
          message: `تم رفض طلبك ${request.requestNumber}. السبب: ${reason}`,
          recipientId: request.requestedBy,
          isRead: false,
          isActionRequired: false,
          createdAt: serverTimestamp(),
          actionUrl: '/printing/material-requests',
        });
      }

      toast.success('تم رفض الطلب');
      setShowApprovalModal(false);
      setSelectedRequest(null);
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('فشل رفض الطلب');
    }
  };

  if (!user || user.role !== 'ceo') {
    return null;
  }

  const getDepartmentLabel = (dept: string) => {
    const labels: Record<string, string> = {
      printing: 'الطباعة',
      design: 'التصميم',
      dispatch: 'الإرسال',
      accounting: 'الحسابات',
    };
    return labels[dept] || dept;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8" dir="rtl">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">طلبات الخامات</h1>
              <p className="mt-2 text-gray-600">مراجعة والموافقة على طلبات الخامات من جميع الأقسام</p>
            </div>

            <button
              onClick={() => router.push('/ceo-dashboard/inventory')}
              className="px-4 py-2 bg-najd-blue text-white rounded-lg hover:bg-primary-700 transition"
            >
              📦 عرض المخزونات
            </button>
          </div>
        </div>

        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="قيد الانتظار"
            value={requests.filter((r) => r.status === 'pending').length}
            icon="⏳"
            color="yellow"
          />
          <StatCard
            title="موافق عليه"
            value={requests.filter((r) => r.status === 'approved').length}
            icon="✅"
            color="green"
          />
          <StatCard
            title="مرفوض"
            value={requests.filter((r) => r.status === 'rejected').length}
            icon="❌"
            color="red"
          />
          <StatCard
            title="إجمالي الطلبات"
            value={requests.length}
            icon="📋"
            color="blue"
          />
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
        </div>

        {/* قائمة الطلبات */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">جاري التحميل...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">لا توجد طلبات</p>
            </div>
          ) : (
            filteredRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                onApprove={() => {
                  setSelectedRequest(request);
                  setShowApprovalModal(true);
                }}
                getDepartmentLabel={getDepartmentLabel}
              />
            ))
          )}
        </div>
      </main>

      {/* Modal الموافقة/الرفض */}
      {showApprovalModal && selectedRequest && (
        <ApprovalModal
          request={selectedRequest}
          onApprove={() => handleApprove(selectedRequest.id)}
          onReject={(reason) => handleReject(selectedRequest.id, reason)}
          onClose={() => {
            setShowApprovalModal(false);
            setSelectedRequest(null);
          }}
        />
      )}
    </div>
  );
}

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
        <div className="text-4xl">{icon}</div>
      </div>
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

function RequestCard({
  request,
  onApprove,
  getDepartmentLabel,
}: {
  request: MaterialRequest;
  onApprove: () => void;
  getDepartmentLabel: (dept: string) => string;
}) {
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
      urgent: { text: 'عاجل', class: 'bg-red-100 text-red-800 animate-pulse' },
    };
    return badges[priority as keyof typeof badges];
  };

  const statusBadge = getStatusBadge(request.status);
  const priorityBadge = getPriorityBadge(request.priority);
  const totalCost = request.items.reduce((sum, item) => sum + (item.estimatedCost || 0), 0);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-gray-900">{request.requestNumber}</h3>
            <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-700">
              {getDepartmentLabel(request.department)}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            بواسطة: {request.requestedByName} •{' '}
            {request.createdAt &&
              format(
                request.createdAt.toDate?.() || new Date(request.createdAt),
                'dd MMMM yyyy HH:mm',
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
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
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
        {totalCost > 0 && (
          <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm font-medium text-green-900">
              التكلفة الإجمالية المقدرة: {totalCost.toFixed(2)} ر.س
            </p>
          </div>
        )}
      </div>

      {/* الملاحظات */}
      {request.notes && (
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700">ملاحظات:</p>
          <p className="text-sm text-gray-600">{request.notes}</p>
        </div>
      )}

      {/* أزرار الإجراءات */}
      {request.status === 'pending' && (
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={onApprove}
            className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
          >
            ✅ الموافقة
          </button>
          <button
            onClick={onApprove}
            className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
          >
            ❌ رفض
          </button>
        </div>
      )}

      {/* معلومات الموافقة/الرفض */}
      {request.status === 'approved' && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm text-green-800">
            ✅ تمت الموافقة بواسطة: {request.approvedByName} •{' '}
            {request.approvedAt &&
              format(
                request.approvedAt.toDate?.() || new Date(request.approvedAt),
                'dd MMMM yyyy',
                { locale: ar }
              )}
          </p>
        </div>
      )}

      {request.status === 'rejected' && request.rejectedReason && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm font-medium text-red-900">سبب الرفض:</p>
          <p className="text-sm text-red-800">{request.rejectedReason}</p>
        </div>
      )}
    </div>
  );
}

// Modal الموافقة/الرفض
function ApprovalModal({
  request,
  onApprove,
  onReject,
  onClose,
}: {
  request: MaterialRequest;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onClose: () => void;
}) {
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleSubmit = () => {
    if (action === 'approve') {
      onApprove();
    } else if (action === 'reject') {
      if (!rejectReason.trim()) {
        toast.error('يرجى إدخال سبب الرفض');
        return;
      }
      onReject(rejectReason);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {action === 'approve' ? 'الموافقة على الطلب' : 'رفض الطلب'}
          </h2>
          <p className="text-sm text-gray-600 mt-1">{request.requestNumber}</p>
        </div>

        <div className="p-6">
          {!action ? (
            <div className="space-y-3">
              <p className="text-gray-700 mb-4">اختر الإجراء المناسب:</p>
              <button
                onClick={() => setAction('approve')}
                className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
              >
                ✅ الموافقة على الطلب
              </button>
              <button
                onClick={() => setAction('reject')}
                className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
              >
                ❌ رفض الطلب
              </button>
              <button
                onClick={onClose}
                className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                إلغاء
              </button>
            </div>
          ) : action === 'approve' ? (
            <div className="space-y-4">
              <p className="text-gray-700">هل أنت متأكد من الموافقة على هذا الطلب؟</p>
              <div className="flex gap-3">
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  تأكيد الموافقة
                </button>
                <button
                  onClick={() => setAction(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  رجوع
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  سبب الرفض *
                </label>
                <textarea
                  rows={4}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                  placeholder="اشرح سبب رفض الطلب..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  تأكيد الرفض
                </button>
                <button
                  onClick={() => setAction(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  رجوع
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


