/**
 * شريط التنقل الرئيسي
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const { unreadCount } = useNotifications();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('خطأ في تسجيل الخروج:', error);
    }
  };

  if (!user) return null;

  return (
    <nav className="bg-najd-blue text-white shadow-lg" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Main Nav */}
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center space-x-2 space-x-reverse">
              <span className="text-2xl font-bold text-najd-gold">نجد</span>
            </Link>

            <div className="mr-8 flex space-x-4 space-x-reverse">
              {/* للموظفين العاديين - واجهة مبسطة */}
              {user.department && !user.isHead && user.role !== 'ceo' && user.role !== 'sales' && user.role !== 'sales_head' && user.department !== 'accounting' ? (
                <>
                  <Link
                    href="/my-tasks"
                    className="px-4 py-2 rounded-md text-base font-medium bg-green-600 hover:bg-green-700 transition shadow-md"
                  >
                    📋 مهامي
                  </Link>
                </>
              ) : (
                <>
                  {/* الواجهة الكاملة للمديرين والمبيعات والمحاسبة */}
                  <Link
                    href="/dashboard"
                    className="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-700 transition"
                  >
                    لوحة التحكم
                  </Link>

                  {user.role === 'ceo' && (
                    <Link
                      href="/ceo-dashboard"
                      className="px-3 py-2 rounded-md text-sm font-medium bg-yellow-500 text-najd-blue hover:bg-yellow-400 transition"
                    >
                      👑 لوحة المدير
                    </Link>
                  )}

                  <Link
                    href="/orders"
                    className="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-700 transition"
                  >
                    الطلبات
                  </Link>

                  {/* مهامي - للموظفين غير العاديين */}
                  {user.role !== 'ceo' && user.role !== 'sales' && user.role !== 'sales_head' && user.department && (
                    <Link
                      href="/my-tasks"
                      className="px-3 py-2 rounded-md text-sm font-medium bg-green-600 hover:bg-green-700 transition"
                    >
                      📋 مهامي
                    </Link>
                  )}

                  {/* إدارة الفريق - للرؤساء فقط */}
                  {user.isHead && (
                    <Link
                      href="/manage-team"
                      className="px-3 py-2 rounded-md text-sm font-medium bg-orange-600 hover:bg-orange-700 transition"
                    >
                      👥 إدارة الفريق
                    </Link>
                  )}

                  {(user.department === 'sales' || user.department === 'accounting' || user.role === 'ceo') && (
                    <Link
                      href="/quotations"
                      className="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-700 transition flex items-center gap-1"
                    >
                      💰 عروض الأسعار
                    </Link>
                  )}

                  {user.department === 'accounting' && (
                    <Link
                      href="/accounting"
                      className="px-3 py-2 rounded-md text-sm font-medium bg-green-600 hover:bg-green-700 transition"
                    >
                      💼 لوحة الحسابات
                    </Link>
                  )}

                  {user.department === 'design' && user.isHead && (
                    <Link
                      href="/designer"
                      className="px-3 py-2 rounded-md text-sm font-medium bg-purple-600 hover:bg-purple-700 transition"
                    >
                      🎨 لوحة المصمم
                    </Link>
                  )}

                  {user.department === 'printing' && user.isHead && (
                    <Link
                      href="/printing"
                      className="px-3 py-2 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-700 transition"
                    >
                      🖨️ لوحة الطباعة
                    </Link>
                  )}

                  {(user.role === 'sales' || user.role === 'sales_head') && (
                    <>
                      <Link
                        href="/orders/new"
                        className="px-3 py-2 rounded-md text-sm font-medium bg-najd-gold text-najd-blue hover:bg-yellow-500 transition"
                      >
                        + طلب طباعة
                      </Link>
                      <Link
                        href="/quotation-requests/new"
                        className="px-3 py-2 rounded-md text-sm font-medium bg-yellow-400 text-gray-900 hover:bg-yellow-300 transition font-bold"
                      >
                        💰 طلب عرض سعر
                      </Link>
                      <Link
                        href="/customers"
                        className="px-3 py-2 rounded-md text-sm font-medium bg-blue-500 hover:bg-blue-600 transition"
                      >
                        👥 العملاء
                      </Link>
                    </>
                  )}

                  {user.role === 'ceo' && (
                    <>
                      <Link
                        href="/users"
                        className="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-700 transition"
                      >
                        المستخدمين
                      </Link>
                      <Link
                        href="/customers"
                        className="px-3 py-2 rounded-md text-sm font-medium bg-blue-500 hover:bg-blue-600 transition"
                      >
                        👥 العملاء
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* User Info and Actions */}
          <div className="flex items-center space-x-4 space-x-reverse">
            {/* Chat */}
            <Link
              href="/chat"
              className="relative p-2 rounded-full hover:bg-primary-700 transition"
              title="المحادثات"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </Link>

            {/* Notifications */}
            <Link
              href="/notifications"
              className="relative p-2 rounded-full hover:bg-primary-700 transition"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                  {unreadCount}
                </span>
              )}
            </Link>

            {/* User Menu */}
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="text-right">
                <p className="text-sm font-medium">{user.displayName}</p>
                <p className="text-xs text-gray-300">{getRoleLabel(user.role)}</p>
              </div>

              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 hover:bg-red-700 transition"
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    ceo: 'المدير التنفيذي',
    sales: 'مبيعات',
    sales_head: 'مدير المبيعات',
    design: 'مصمم',
    design_head: 'مدير التصميم',
    printing: 'طباعة',
    printing_head: 'مدير الطباعة',
    accounting: 'محاسب',
    accounting_head: 'مدير الحسابات',
    dispatch: 'إرسال',
    dispatch_head: 'مدير الإرسال',
  };

  return labels[role] || role;
}

