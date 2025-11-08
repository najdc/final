/**
 * صفحة مهامي - My Tasks
 * لوحة تاسكات مخصصة للموظفين
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Layout/Navbar';
import EmployeeKanbanBoard from '@/components/Employee/EmployeeKanbanBoard';

export default function MyTasksPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-najd-blue"></div>
      </div>
    );
  }

  // التحقق من أن المستخدم موظف عادي (ليس CEO أو مبيعات)
  if (!user.department || user.role === 'ceo' || user.department === 'sales') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto py-12 px-4 text-center">
          <p className="text-red-600">هذه الصفحة مخصصة للموظفين فقط</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-[1920px] mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <EmployeeKanbanBoard />
      </main>
    </div>
  );
}
