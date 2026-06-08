import React, { useState } from 'react';
import { Search, Edit2, Trash2, ShieldCheck, Mail, Phone, Calendar, UserCheck } from 'lucide-react';
import { Employee } from '../types';

interface EmployeeListProps {
  employees: Employee[];
  currentUserId: string | null;
  onEdit: (employee: Employee) => void;
  onDelete: (id: string) => Promise<void>;
  isLoading: boolean;
}

export default function EmployeeList({
  employees,
  currentUserId,
  onEdit,
  onDelete,
  isLoading,
}: EmployeeListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('All');

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDept = filterDept === 'All' || emp.department === filterDept;

    return matchesSearch && matchesDept;
  });

  // Collect active departments for filter options
  const departments = ['All', ...Array.from(new Set(employees.map((e) => e.department)))];

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Onboarding':
        return 'bg-sky-50 text-sky-700 border-sky-100';
      case 'Suspended':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const getStatusLabelInIndonesian = (status: string) => {
    switch (status) {
      case 'Active':
        return 'Aktif';
      case 'Onboarding':
        return 'Masa Onboarding';
      case 'Suspended':
        return 'Dinonaktifkan';
      default:
        return status;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
      return new Date(dateStr).toLocaleDateString('id-ID', options);
    } catch {
      return dateStr;
    }
  };

  return (
    <div id="employee-list-container" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      {/* Filters and Search Header */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center mb-6 pb-6 border-b border-slate-100">
        <div>
          <h3 id="employee-list-heading" className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-500" />
            Daftar Karyawan Terdaftar
          </h3>
          <p className="text-sm text-slate-400 mt-0.5">
            Total: {employees.length} Karyawan (Tersinkronisasi Realtime)
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="search-employee-input"
              type="text"
              placeholder="Cari nama, jabatan, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition-all text-sm"
            />
          </div>

          {/* Department filter */}
          <select
            id="dept-filter"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-600 transition-all text-sm cursor-pointer"
          >
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept === 'All' ? 'Semua Departemen' : dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div id="list-loader" className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-10 h-10 border-3 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Memuat data dari Firebase...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div id="empty-list-placeholder" className="text-center py-16 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <UserCheck className="w-6 h-6" />
          </div>
          <p className="text-slate-700 font-semibold text-base">Tidak Ada Karyawan Ditemukan</p>
          <p className="text-sm text-slate-400 max-w-sm mx-auto mt-1">
            {employees.length === 0
              ? 'Silakan daftarkan karyawan baru Anda melalui formulir pendaftaran di sebelah kiri.'
              : 'Cobalah gunakan kata kunci pencarian lain atau pilih divisi yang berbeda.'}
          </p>
        </div>
      ) : (
        /* Table responsive view */
        <div id="table-scroll-wrapper" className="overflow-x-auto">
          <table id="employees-table" className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 font-semibold">Nama Karyawan</th>
                <th className="py-3.5 px-4 font-semibold">Divisi & Posisi</th>
                <th className="py-3.5 px-4 font-semibold">Hubungi</th>
                <th className="py-3.5 px-4 font-semibold">Bergabung</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 text-right font-semibold">Kelola</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/70 text-sm">
              {filteredEmployees.map((emp) => {
                const isCreator = currentUserId === emp.createdBy;

                return (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                    {/* Name column */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-100 rounded-full text-slate-700 font-bold flex items-center justify-center uppercase shadow-inner text-xs">
                          {emp.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            {emp.name}
                            {isCreator && (
                              <span
                                title="Anda yang mendaftarkan karyawan ini"
                                className="flex items-center gap-0.5 text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold"
                              >
                                <ShieldCheck className="w-3 h-3 text-indigo-500" />
                                Anda
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">ID: {emp.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>

                    {/* Role & Dept Column */}
                    <td className="py-4 px-4">
                      <div className="font-medium text-slate-700">{emp.role}</div>
                      <div className="text-xs text-indigo-500 font-medium mt-0.5">{emp.department}</div>
                    </td>

                    {/* Contact info column */}
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {emp.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {emp.phone}
                        </span>
                      </div>
                    </td>

                    {/* Calendar Joined Column */}
                    <td className="py-4 px-4 text-slate-600 font-medium">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {formatDate(emp.joinedAt)}
                      </div>
                    </td>

                    {/* Employment Status Badge Column */}
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusBadgeClass(emp.status)}`}>
                        {getStatusLabelInIndonesian(emp.status)}
                      </span>
                    </td>

                    {/* Action buttons if owner of the document */}
                    <td className="py-4 px-4 text-right">
                      {isCreator ? (
                        <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            id={`edit-btn-${emp.id}`}
                            onClick={() => onEdit(emp)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                            title="Edit data karyawan ini"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            id={`delete-btn-${emp.id}`}
                            onClick={() => onDelete(emp.id)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Hapus data karyawan ini"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic font-medium pr-2 select-none" title="Hanya pembuat yang dapat mengelola">
                          Hanya Pembuat
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
