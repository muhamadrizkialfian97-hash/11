/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  getDocFromServer,
  onSnapshot
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { Employee, EmployeeFormInput } from './types';
import AddEmployeeForm from './components/AddEmployeeForm';
import EmployeeList from './components/EmployeeList';
import {
  LogOut,
  Building2,
  Users,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  Lock,
  Sparkles,
  Search
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 1. Validate connection to Firestore on initialization
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('offline')) {
          console.error("Please check your Firebase configuration or network status.");
        }
      }
    }
    testConnection();
  }, []);

  // 2. Listen to authentication changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 3. Listen to employees update collection real-time
  useEffect(() => {
    if (!user) {
      setEmployees([]);
      setEmployeesLoading(false);
      return;
    }

    setEmployeesLoading(true);
    // Bind subscription cleanly
    const unsubscribe = onSnapshot(
      collection(db, 'employees'),
      (snapshot) => {
        const list: Employee[] = [];
        snapshot.forEach((docSnapshot) => {
          list.push({
            id: docSnapshot.id,
            ...docSnapshot.data(),
          } as Employee);
        });

        // Robust client-side sort on field createdAt to avoid index requirement limitations
        list.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });

        setEmployees(list);
        setEmployeesLoading(false);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, 'employees');
        } catch (wrappedError: any) {
          console.error('Realtime sync exception caught:', wrappedError);
          setNotification({
            type: 'error',
            message: 'Gagal sinkronisasi data: Akses ditolak oleh aturan Firestore. Pastikan akun email Anda terverifikasi.'
          });
        }
        setEmployeesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Alert Auto-dismiss in 4 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setNotification({
        type: 'success',
        message: 'Masuk berhasil! Selamat datang di Portal Manajemen Karyawan.'
      });
    } catch (err: any) {
      console.error('Login error: ', err);
      setNotification({
        type: 'error',
        message: `Gagal masuk: ${err.message || 'Harap coba lagi'}`
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setEditingEmployee(null);
      setNotification({
        type: 'success',
        message: 'Berhasil keluar dari sistem.'
      });
    } catch (err: any) {
      console.error('Logout error: ', err);
    }
  };

  const handleSaveEmployee = async (input: EmployeeFormInput) => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      if (editingEmployee) {
        // Update Action - Must retain creation data to align with firestore rules
        const docRef = doc(db, 'employees', editingEmployee.id);
        const payload = {
          name: input.name,
          role: input.role,
          department: input.department,
          email: input.email,
          phone: input.phone,
          status: input.status,
          joinedAt: input.joinedAt,
          createdBy: editingEmployee.createdBy,
          createdAt: editingEmployee.createdAt,
          updatedAt: serverTimestamp() // Sets tenth key and triggers temporal request checker
        };

        await setDoc(docRef, payload);
        setEditingEmployee(null);
        setNotification({
          type: 'success',
          message: `Berhasil memperbarui data karyawan: ${input.name}`
        });
      } else {
        // Create Action - 9 keys exact matching rules
        const employeesCol = collection(db, 'employees');
        const newDocRef = doc(employeesCol);
        const payload = {
          name: input.name,
          role: input.role,
          department: input.department,
          email: input.email,
          phone: input.phone,
          status: input.status,
          joinedAt: input.joinedAt,
          createdBy: user.uid,
          createdAt: serverTimestamp()
        };

        await setDoc(newDocRef, payload);
        setNotification({
          type: 'success',
          message: `Karyawan baru ${input.name} berhasil didaftarkan!`
        });
      }
    } catch (err: any) {
      console.error('Database write error: ', err);
      // Bubble to form component to display locally
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    const target = employees.find((e) => e.id === id);
    if (!target) return;

    const confirmed = window.confirm(
      `Apakah Anda yakin ingin menghapus data karyawan "${target.name}"? Tindakan ini tidak dapat dibatalkan.`
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'employees', id));
      setNotification({
        type: 'success',
        message: 'Data karyawan berhasil dihapus dari database.'
      });
    } catch (err: any) {
      try {
        handleFirestoreError(err, OperationType.DELETE, `employees/${id}`);
      } catch (wrappedError: any) {
        console.error(wrappedError);
        setNotification({
          type: 'error',
          message: 'Gagal menghapus: Anda tidak memiliki wewenang atau hak akses pembuat.'
        });
      }
    }
  };

  const handleSelectEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    // Smooth scroll view to form on mobile devices
    const formElement = document.getElementById('add-employee-form-container');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div id="full-app-viewport" className="bg-slate-50/50 min-h-screen text-slate-700 flex flex-col font-sans select-none antialiased">
      {/* Top Navigation Header */}
      <header id="app-top-header" className="sticky top-0 z-40 bg-white border-b border-slate-100 py-4 px-6 shadow-sm shadow-slate-100/30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-extrabold shadow-md shadow-indigo-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 id="app-primary-title" className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Portal Data Karyawan
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono font-medium border border-slate-200">v1.2</span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">Sistem Registrasi Karyawan Realtime · Terintegrasi Firebase</p>
            </div>
          </div>

          {/* User auth state banner */}
          <div className="flex items-center gap-3">
            {authLoading ? (
              <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
            ) : user ? (
              <div className="flex items-center gap-3 bg-slate-50 p-1.5 pl-3 rounded-2xl border border-slate-100">
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-800 flex items-center justify-end gap-1">
                    {user.displayName || 'Akun Google'}
                    {user.emailVerified ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" title="Email Terverifikasi" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" title="Email Belum Terverifikasi" />
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium font-mono lowercase">{user.email}</div>
                </div>
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    referrerPolicy="no-referrer"
                    alt={user.displayName || 'Avatar'}
                    className="w-8 h-8 rounded-xl object-cover border border-slate-200 shadow-inner"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center uppercase text-xs">
                    {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </div>
                )}
                <button
                  id="top-logout-btn"
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all ml-1"
                  title="Keluar dari sistem"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="top-login-btn"
                onClick={handleLogin}
                className="bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl px-4 py-2.5 transition-all flex items-center gap-2 shadow-sm shadow-slate-900/10 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                Masuk dengan Google
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Floating alert notifications */}
      <AnimatePresence>
        {notification && (
          <div className="fixed top-20 right-6 z-50 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={`p-4 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-3 max-w-sm pointer-events-auto bg-white ${
                notification.type === 'success'
                  ? 'border-emerald-100 text-slate-800 shadow-emerald-500/5'
                  : 'border-red-100 text-red-800 shadow-red-500/5'
              }`}
            >
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              )}
              <span>{notification.message}</span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main id="app-main-content-layout" className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col justify-stretch">
        {authLoading ? (
          <div id="auth-main-loader" className="flex-1 flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-slate-400 font-medium text-sm">Menyiapkan koneksi keamanan...</p>
          </div>
        ) : !user ? (
          /* Unauthenticated Gate View */
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="my-auto py-12 px-6 flex flex-col items-center text-center max-w-md mx-auto bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50"
          >
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            <h2 id="locked-state-heading" className="text-xl font-bold text-slate-900 tracking-tight">Portal Terproteksi</h2>
            <p id="locked-state-body" className="text-slate-400 text-sm mt-2.5 max-w-sm leading-relaxed">
              Selamat datang di Portal Data Karyawan. Untuk menjaga privasi dan integritas data organisasi, Anda wajib masuk menggunakan Akun Google terverifikasi.
            </p>
            <button
              id="middle-login-btn"
              onClick={handleLogin}
              className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl py-3 px-5 transition-all text-sm shadow-md shadow-indigo-500/10 flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              Masuk dengan Akun Google
            </button>
            <div className="mt-6 flex items-center gap-2 text-slate-400 text-xs bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl">
              <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Tertaut langsung ke basis data Firebase</span>
            </div>
          </motion.div>
        ) : !user.emailVerified ? (
          /* Email Not-Verified Warn Gate */
          <div className="my-auto py-12 px-6 flex flex-col items-center text-center max-w-md mx-auto bg-white rounded-3xl border border-rose-100 shadow-xl shadow-rose-100/10">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-6">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 id="unverified-state-heading" className="text-xl font-bold text-slate-900 tracking-tight">Email Belum Terverifikasi</h2>
            <p id="unverified-state-body" className="text-slate-400 text-sm mt-2.5 max-w-sm leading-relaxed">
              Aturan otorisasi Zero-Trust Firestore kami mewajibkan akun login memiliki status email yang terverifikasi secara resmi (`email_verified == true`).
            </p>
            <p className="mt-2 text-xs text-red-500 font-medium">
              Silakan verifikasi email Google Anda sebelum melanjutkan.
            </p>
          </div>
        ) : (
          /* Logged In, Verified Active Dashboard */
          <div id="active-dashboard-grid" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Form Section */}
            <div className="lg:col-span-4 space-y-4">
              <AddEmployeeForm
                onSave={handleSaveEmployee}
                editingEmployee={editingEmployee}
                onCancelEdit={() => setEditingEmployee(null)}
                isSubmitting={isSubmitting}
              />

              {/* Informative Security Card */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 text-xs text-slate-500 space-y-2.5 shadow-inner">
                <h4 className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-500" />
                  Kebijakan Keamanan Aturan Firestore
                </h4>
                <p className="leading-relaxed">
                  Sistem ini diamankan oleh <strong className="text-indigo-600">Attribute-Based Access Control (ABAC)</strong>. Data yang Anda daftarkan melekat dengan ID Anda.
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>Siapa saja yang ter autentikasi dapat melihat daftar karyawan.</li>
                  <li>Hanya <strong className="text-slate-600">pendaftar asli (creator)</strong> yang dapat mengedit atau menghapus data karyawannya sendiri.</li>
                </ul>
              </div>
            </div>

            {/* List Table Section */}
            <div className="lg:col-span-8">
              <EmployeeList
                employees={employees}
                currentUserId={user.uid}
                onEdit={handleSelectEditEmployee}
                onDelete={handleDeleteEmployee}
                isLoading={employeesLoading}
              />
            </div>
          </div>
        )}
      </main>

      {/* Humble Footer */}
      <footer id="app- humble-footer" className="bg-white border-t border-slate-100 py-5 text-center text-xs text-slate-400">
        <p className="font-medium">© 2026 Portal Karyawan Baru · Hubungan Cloud Run & Firebase Firestore Mandiri</p>
      </footer>
    </div>
  );
}
