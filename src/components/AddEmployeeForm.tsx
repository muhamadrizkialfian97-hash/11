import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, Save, X, Sparkles } from 'lucide-react';
import { Employee, EmployeeFormInput, EmployeeStatus } from '../types';

interface AddEmployeeFormProps {
  onSave: (data: EmployeeFormInput) => Promise<void>;
  editingEmployee: Employee | null;
  onCancelEdit: () => void;
  isSubmitting: boolean;
}

const DEPARTMENTS = [
  'Teknologi / IT',
  'Sumber Daya Manusia / HRD',
  'Keuangan & Akuntansi',
  'Pemasaran & Kreatif',
  'Hubungan Pelanggan / CS',
  'Operasional & Umum'
];

const INITIAL_STATE: EmployeeFormInput = {
  name: '',
  role: '',
  department: 'Teknologi / IT',
  email: '',
  phone: '',
  status: 'Onboarding',
  joinedAt: new Date().toISOString().split('T')[0],
};

export default function AddEmployeeForm({
  onSave,
  editingEmployee,
  onCancelEdit,
  isSubmitting,
}: AddEmployeeFormProps) {
  const [formData, setFormData] = useState<EmployeeFormInput>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingEmployee) {
      setFormData({
        name: editingEmployee.name,
        role: editingEmployee.role,
        department: editingEmployee.department,
        email: editingEmployee.email,
        phone: editingEmployee.phone,
        status: editingEmployee.status,
        joinedAt: editingEmployee.joinedAt,
      });
      setError(null);
    } else {
      setFormData(INITIAL_STATE);
    }
  }, [editingEmployee]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic Validation
    if (!formData.name.trim()) return setError('Nama lengkap tidak boleh kosong');
    if (!formData.role.trim()) return setError('Jabatan tidak boleh kosong');
    if (!formData.email.trim()) return setError('Email tidak boleh kosong');
    if (!formData.phone.trim()) return setError('Nomor telepon tidak boleh kosong');
    if (!formData.joinedAt) return setError('Tanggal bergabung harus diisi');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return setError('Format email kantor tidak valid');
    }

    try {
      await onSave(formData);
      if (!editingEmployee) {
        setFormData({
          ...INITIAL_STATE,
          joinedAt: new Date().toISOString().split('T')[0], // reset to current date
        });
      }
    } catch (err: any) {
      // Parse JSON database error if it conforms to our model, otherwise show normal message
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error) {
          setError(`Gagal menyimpan ke database (Firebase rule block): ${parsed.error}`);
        } else {
          setError(err.message || 'Terjadi kesalahan saat menyimpan data');
        }
      } catch {
        setError(err.message || 'Terjadi kesalahan saat menyimpan data');
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      id="add-employee-form-container"
      className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 self-start"
    >
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <h3 id="form-title" className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          {editingEmployee ? 'Edit Profil Karyawan' : 'Registrasi Karyawan Baru'}
        </h3>
        {editingEmployee && (
          <button
            id="cancel-edit-btn"
            type="button"
            onClick={onCancelEdit}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            title="Selesai Mengedit"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <form id="employee-registration-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            id="form-error-alert"
            className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 font-medium"
          >
            {error}
          </div>
        )}

        <div>
          <label htmlFor="name-input" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
            Nama Lengkap
          </label>
          <input
            id="name-input"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Contoh: Budi Susanto"
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition-all text-sm"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="role-input" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Jabatan / Posisi
            </label>
            <input
              id="role-input"
              type="text"
              name="role"
              value={formData.role}
              onChange={handleChange}
              placeholder="Contoh: Frontend Developer"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition-all text-sm"
            />
          </div>

          <div>
            <label htmlFor="department-select" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Departemen / Divisi
            </label>
            <select
              id="department-select"
              name="department"
              value={formData.department}
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition-all text-sm cursor-pointer"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="email-input" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Email Kantor
            </label>
            <input
              id="email-input"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="budi@perusahaan.com"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition-all text-sm"
            />
          </div>

          <div>
            <label htmlFor="phone-input" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Nomor Telepon
            </label>
            <input
              id="phone-input"
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="081234567890"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition-all text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="joinedAt-input" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Tanggal Bergabung
            </label>
            <input
              id="joinedAt-input"
              type="date"
              name="joinedAt"
              value={formData.joinedAt}
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition-all text-sm cursor-pointer"
            />
          </div>

          <div>
            <label htmlFor="status-select" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Status Kepegawaian
            </label>
            <select
              id="status-select"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition-all text-sm cursor-pointer"
            >
              <option value="Onboarding">Onboarding</option>
              <option value="Active">Aktif (Active)</option>
              <option value="Suspended">Dinonaktifkan (Suspended)</option>
            </select>
          </div>
        </div>

        <div className="pt-3 flex gap-2">
          {editingEmployee && (
            <button
              id="btn-cancel-edit"
              type="button"
              onClick={onCancelEdit}
              className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-all font-medium text-sm text-center"
            >
              Batal
            </button>
          )}

          <button
            id="submit-register-btn"
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-2.5 rounded-xl font-medium transition-all text-sm shadow-sm hover:shadow-indigo-500/10 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : editingEmployee ? (
              <>
                <Save className="w-4 h-4" />
                Simpan Perubahan
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Daftarkan Karyawan
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
