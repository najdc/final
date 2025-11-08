/**
 * صفحة إدارة مهام الفريق - للرؤساء
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders } from '@/hooks/useOrders';
import Navbar from '@/components/Layout/Navbar';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import type { Order, User } from '@/types/shared';
import { format } from 'date-fns/format';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { ar } from 'date-fns/locale/ar';

interface TeamMember extends User {
  activeTasks: number;
  completedTasks: number;
  completedToday: number;
  avgCompletionTime: number;
  completionRate: number;
}

export default function ManageTeamPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { orders, loading: ordersLoading } = useOrders();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }

    // التحقق من أن المستخدم رئيس قسم
    if (user && !user.isHead && user.role !== 'ceo') {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchTeamMembers();
    }
  }, [user]);

  const fetchTeamMembers = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // جلب موظفي القسم
      const q = query(
        collection(db, 'users'),
        where('department', '==', user.department),
        where('isActive', '==', true)
      );

      const snapshot = await getDocs(q);
      const members = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as User[];

      // حساب إحصائيات كل موظف
      const membersWithStats: TeamMember[] = members.map(member => {
        const department = user.department;
        const assignmentField = department === 'design' ? 'assignedToDesign' :
                                department === 'printing' ? 'assignedToPrinting' :
                                department === 'dispatch' ? 'assignedToDispatch' : null;

        const memberTasks = orders.filter(o => o[assignmentField as keyof Order] === member.uid);
        const activeTasks = memberTasks.filter(t => !(t as any)[`${department}Assignment`]?.completedAt);
        const completedTasks = memberTasks.filter(t => (t as any)[`${department}Assignment`]?.completedAt);
        
        // المكتملة اليوم
        const today = new Date().setHours(0, 0, 0, 0);
        const completedToday = completedTasks.filter(t => {
          const completedAt = (t as any)[`${department}Assignment`]?.completedAt;
          if (!completedAt) return false;
          const taskDate = new Date(completedAt).setHours(0, 0, 0, 0);
          return today === taskDate;
        }).length;

        // متوسط وقت الإنجاز
        const tasksWithDuration = completedTasks.filter(t => (t as any)[`${department}Assignment`]?.actualDuration);
        const avgTime = tasksWithDuration.length > 0
          ? tasksWithDuration.reduce((sum, t) => sum + ((t as any)[`${department}Assignment`]?.actualDuration || 0), 0) / tasksWithDuration.length
          : 0;

        // معدل الإنجاز
        const completionRate = memberTasks.length > 0
          ? (completedTasks.length / memberTasks.length) * 100
          : 0;

        return {
          ...member,
          activeTasks: activeTasks.length,
          completedTasks: completedTasks.length,
          completedToday,
          avgCompletionTime: Math.round(avgTime * 10) / 10,
          completionRate: Math.round(completionRate),
        };
      });

      setTeamMembers(membersWithStats);
    } catch (error) {
      console.error('Error fetching team members:', error);
    } finally {
      setLoading(false);
    }
  };

  // تعيين مهمة
  const handleAssignTask = async (orderId: string) => {
    if (!selectedUserId) {
      alert('يرجى اختيار موظف');
      return;
    }

    try {
      const assignTaskFn = httpsCallable(functions, 'assignTask');
      await assignTaskFn({
        orderId,
        userId: selectedUserId,
        department: user!.department,
        estimatedDuration: estimatedHours ? Number(estimatedHours) : null,
        notes: assignmentNotes || null,
      });

      alert('تم تعيين المهمة بنجاح!');
      
      // إعادة تعيين القيم
      setAssigningOrderId(null);
      setSelectedUserId('');
      setEstimatedHours('');
      setAssignmentNotes('');
      
      // إعادة تحميل البيانات
      window.location.reload();
    } catch (error: any) {
      console.error('Error assigning task:', error);
      alert(error.message || 'فشل تعيين المهمة');
    }
  };

  if (authLoading || !user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-najd-blue"></div>
      </div>
    );
  }

  // المهام الغير معينة
  const department = user.department;
  const assignmentField = department === 'design' ? 'assignedToDesign' :
                          department === 'printing' ? 'assignedToPrinting' :
                          department === 'dispatch' ? 'assignedToDispatch' : null;

  const relevantStatuses = department === 'design' ? ['pending_design', 'in_design', 'design_review', 'design_completed'] :
                           department === 'printing' ? ['pending_printing', 'in_printing', 'printing_completed'] :
                           department === 'dispatch' ? ['pending_materials', 'materials_in_progress', 'materials_ready', 'ready_for_dispatch', 'in_dispatch'] : [];

  const departmentOrders = orders.filter(o => relevantStatuses.includes(o.status));
  const unassignedOrders = departmentOrders.filter(o => !o[assignmentField as keyof Order]);
  const assignedOrders = departmentOrders.filter(o => o[assignmentField as keyof Order]);

  // إحصائيات الفريق
  const stats = {
    totalTasks: departmentOrders.length,
    assigned: assignedOrders.length,
    unassigned: unassignedOrders.length,
    inProgress: assignedOrders.filter(o => {
      const assignment = (o as any)[`${department}Assignment`];
      return assignment?.startedAt && !assignment?.completedAt;
    }).length,
    completed: assignedOrders.filter(o => (o as any)[`${department}Assignment`]?.completedAt).length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8" dir="rtl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">إدارة مهام الفريق</h1>
          <p className="text-gray-600">تعيين ومتابعة مهام فريق {
            department === 'design' ? 'التصميم' :
            department === 'printing' ? 'الطباعة' :
            department === 'dispatch' ? 'الإرسال' : ''
          }</p>
        </div>

        {/* نظرة عامة */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <StatCard title="إجمالي المهام" value={stats.totalTasks} color="bg-blue-500" />
          <StatCard title="معينة" value={stats.assigned} color="bg-purple-500" />
          <StatCard title="غير معينة" value={stats.unassigned} color="bg-yellow-500" />
          <StatCard title="قيد التنفيذ" value={stats.inProgress} color="bg-indigo-500" />
          <StatCard title="مكتملة" value={stats.completed} color="bg-green-500" />
        </div>

        {/* أداء الفريق */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">أداء الفريق</h2>
          
          {teamMembers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">لا يوجد موظفين في الفريق</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      الموظف
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      المهام النشطة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      المكتملة اليوم
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      إجمالي المكتملة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      متوسط الوقت
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      معدل الإنجاز
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {teamMembers.map((member) => (
                    <tr key={member.uid} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-najd-blue text-white flex items-center justify-center font-bold">
                            {member.displayName.charAt(0)}
                          </div>
                          <div className="mr-3">
                            <div className="text-sm font-medium text-gray-900">
                              {member.displayName}
                            </div>
                            <div className="text-sm text-gray-500">{member.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                          {member.activeTasks}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {member.completedToday}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {member.completedTasks}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {member.avgCompletionTime > 0 ? `${member.avgCompletionTime}h` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${
                            member.completionRate >= 90
                              ? 'bg-green-100 text-green-800'
                              : member.completionRate >= 70
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {member.completionRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* المهام الغير معينة */}
        {unassignedOrders.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              مهام تحتاج تعيين ({unassignedOrders.length})
            </h2>
            <div className="space-y-4">
              {unassignedOrders.map((order) => (
                <div key={order.id} className="border border-gray-200 rounded-lg p-4 hover:border-najd-blue transition">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-gray-900">{order.orderNumber}</h3>
                        {order.priority === 'urgent' && (
                          <span className="px-2 py-1 text-xs bg-red-500 text-white rounded">
                            عاجل ⚡
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700">{order.customerName}</p>
                      <p className="text-sm text-gray-500">{order.printType} - الكمية: {order.quantity}</p>
                    </div>

                    {assigningOrderId === order.id ? (
                      <div className="w-1/2 bg-gray-50 rounded-lg p-4 border-2 border-najd-blue">
                        <h4 className="font-bold mb-3">تعيين المهمة</h4>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium mb-1">اختر موظف:</label>
                            <select
                              value={selectedUserId}
                              onChange={(e) => setSelectedUserId(e.target.value)}
                              className="w-full border rounded px-3 py-2"
                            >
                              <option value="">اختر...</option>
                              {teamMembers.map((member) => (
                                <option key={member.uid} value={member.uid}>
                                  {member.displayName} 
                                  {member.activeTasks > 0 && ` (${member.activeTasks} مهام)`}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">الوقت المتوقع (ساعات):</label>
                            <input
                              type="number"
                              min="1"
                              value={estimatedHours}
                              onChange={(e) => setEstimatedHours(e.target.value)}
                              placeholder="مثال: 8"
                              className="w-full border rounded px-3 py-2"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">ملاحظات (اختياري):</label>
                            <textarea
                              rows={2}
                              value={assignmentNotes}
                              onChange={(e) => setAssignmentNotes(e.target.value)}
                              placeholder="تعليمات خاصة..."
                              className="w-full border rounded px-3 py-2"
                            />
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAssignTask(order.id)}
                              disabled={!selectedUserId}
                              className="flex-1 bg-najd-blue text-white px-4 py-2 rounded hover:bg-opacity-90 disabled:opacity-50"
                            >
                              ✓ تعيين
                            </button>
                            <button
                              onClick={() => {
                                setAssigningOrderId(null);
                                setSelectedUserId('');
                                setEstimatedHours('');
                                setAssignmentNotes('');
                              }}
                              className="px-4 py-2 border rounded hover:bg-gray-50"
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAssigningOrderId(order.id)}
                        className="bg-najd-blue text-white px-6 py-2 rounded-lg hover:bg-opacity-90"
                      >
                        تعيين للموظف
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* المهام المعينة */}
        {assignedOrders.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              المهام المعينة ({assignedOrders.length})
            </h2>
            <div className="space-y-4">
              {assignedOrders.map((order) => {
                const assignment = (order as any)[`${department}Assignment`];
                const isStarted = assignment?.startedAt;
                const isCompleted = assignment?.completedAt;

                return (
                  <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold">{order.orderNumber}</h3>
                          {isCompleted ? (
                            <span className="px-2 py-1 text-xs bg-green-500 text-white rounded">
                              ✓ مكتملة
                            </span>
                          ) : isStarted ? (
                            <span className="px-2 py-1 text-xs bg-blue-500 text-white rounded animate-pulse">
                              🔄 جاري العمل
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs bg-gray-500 text-white rounded">
                              ⏳ لم تبدأ
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700">{order.customerName}</p>
                        
                        <div className="mt-2 flex items-center gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">معين لـ: </span>
                            <span className="font-medium">{assignment?.userName}</span>
                          </div>
                          {assignment?.estimatedDuration && (
                            <div>
                              <span className="text-gray-500">متوقع: </span>
                              <span className="font-medium">{assignment.estimatedDuration}h</span>
                            </div>
                          )}
                          {assignment?.actualDuration && (
                            <div>
                              <span className="text-gray-500">فعلي: </span>
                              <span className={`font-medium ${
                                assignment.actualDuration <= (assignment.estimatedDuration || 0)
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}>
                                {assignment.actualDuration.toFixed(1)}h
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => router.push(`/orders/${order.id}`)}
                        className="text-najd-blue hover:underline text-sm"
                      >
                        عرض التفاصيل ←
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// مكون بطاقة الإحصائيات
function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <div className={`w-full h-2 ${color} rounded-full mt-2`} />
    </div>
  );
}

