/**
 * صفحة إدارة المستخدمين
 * للمدير (CEO) فقط
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Layout/Navbar';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/types/shared';
import { format } from 'date-fns/format';
import { ar } from 'date-fns/locale/ar';
import toast from 'react-hot-toast';

interface User {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  role: string;
  department: string;
  isHead: boolean;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

const ROLE_LABELS: Record<string, string> = {
  ceo: 'المدير التنفيذي',
  sales: 'موظف مبيعات',
  sales_head: 'مدير المبيعات',
  design: 'مصمم',
  design_head: 'مدير التصميم',
  printing: 'موظف طباعة',
  printing_head: 'مدير الطباعة',
  accounting: 'محاسب',
  accounting_head: 'مدير الحسابات',
  dispatch: 'موظف إرسال',
  dispatch_head: 'مدير الإرسال',
};

const DEPARTMENT_LABELS: Record<string, string> = {
  management: 'الإدارة',
  sales: 'المبيعات',
  design: 'التصميم',
  printing: 'الطباعة',
  accounting: 'الحسابات',
  dispatch: 'الإرسال',
};

export default function UsersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    if (!user) return;

    // فقط CEO يمكنه الوصول لهذه الصفحة
    if (user.role !== 'ceo') {
      toast.error('ليس لديك صلاحية لعرض هذه الصفحة');
      router.push('/dashboard');
      return;
    }

    fetchUsers();
  }, [user, router]);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, COLLECTIONS.USERS), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const usersData = querySnapshot.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      })) as User[];

      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('فشل تحميل المستخدمين');
    } finally {
      setLoading(false);
    }
  };

  // تصفية المستخدمين
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !searchQuery ||
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.phoneNumber && u.phoneNumber.includes(searchQuery));

    const matchesDepartment = !departmentFilter || u.department === departmentFilter;
    const matchesRole = !roleFilter || u.role === roleFilter;

    return matchesSearch && matchesDepartment && matchesRole;
  });

  // إحصائيات
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.isActive).length;
  const inactiveUsers = totalUsers - activeUsers;
  const departmentCounts = users.reduce((acc, u) => {
    acc[u.department] = (acc[u.department] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (!user || user.role !== 'ceo') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8" dir="rtl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">إدارة المستخدمين</h1>
              <p className="text-sm text-gray-600 mt-1">إدارة حسابات الموظفين والصلاحيات</p>
            </div>
            
            <button
              onClick={() => router.push('/users/new')}
              className="w-full sm:w-auto px-6 py-3 bg-najd-gold text-najd-blue rounded-lg hover:bg-yellow-500 transition font-medium shadow-md flex items-center justify-center gap-2"
            >
              <span className="text-xl">+</span>
              إضافة مستخدم
            </button>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">إجمالي المستخدمين</p>
                  <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
                </div>
                <div className="text-4xl">👥</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">نشط</p>
                  <p className="text-2xl font-bold text-green-600">{activeUsers}</p>
                </div>
                <div className="text-4xl">✅</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">غير نشط</p>
                  <p className="text-2xl font-bold text-red-600">{inactiveUsers}</p>
                </div>
                <div className="text-4xl">❌</div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <input
                type="text"
                placeholder="بحث (الاسم، البريد، الهاتف...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
              />
            </div>

            <div>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
              >
                <option value="">كل الأقسام</option>
                {Object.entries(DEPARTMENT_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-najd-blue focus:border-najd-blue"
              >
                <option value="">كل الأدوار</option>
                {Object.entries(ROLE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-najd-blue"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600 text-lg">لا يوجد مستخدمون</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الاسم
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      البريد الإلكتروني
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الهاتف
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      القسم
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الدور
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الحالة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      تاريخ الإنشاء
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((u) => (
                    <tr key={u.uid} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-najd-blue text-white rounded-full flex items-center justify-center font-bold">
                            {u.displayName.charAt(0)}
                          </div>
                          <div className="mr-4">
                            <div className="text-sm font-medium text-gray-900">
                              {u.displayName}
                            </div>
                            {u.isHead && (
                              <div className="text-xs text-najd-gold">👑 رئيس قسم</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {u.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {u.phoneNumber || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {DEPARTMENT_LABELS[u.department]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {ROLE_LABELS[u.role]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            u.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {u.isActive ? 'نشط' : 'غير نشط'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {u.createdAt &&
                          format(
                            typeof u.createdAt === 'string'
                              ? new Date(u.createdAt)
                              : u.createdAt.toDate(),
                            'dd MMM yyyy',
                            { locale: ar }
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary */}
        {!loading && filteredUsers.length > 0 && (
          <div className="mt-4 text-sm text-gray-600 text-center">
            عرض {filteredUsers.length} من أصل {totalUsers} مستخدم
          </div>
        )}

        {/* Department Statistics */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">توزيع المستخدمين حسب القسم</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.entries(departmentCounts).map(([dept, count]) => (
              <div
                key={dept}
                className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200"
              >
                <p className="text-sm text-gray-600 mb-1">{DEPARTMENT_LABELS[dept]}</p>
                <p className="text-2xl font-bold text-najd-blue">{count}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}


