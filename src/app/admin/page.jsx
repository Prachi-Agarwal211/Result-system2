'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/layout/Navbar';
import FileUploader from '@/components/admin/FileUploader';
import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';

export default function AdminPage() {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase.storage.from('result-uploads').list('', {
        limit: 20,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      });
      if (!error) setUploads(data || []);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <ProtectedRoute adminOnly>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="py-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-600">Upload result files to trigger parsing via Edge Function.</p>

            <FileUploader />

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-2">Recent Uploads</h2>
              {loading ? (
                <p className="text-sm text-gray-500">Loading...</p>
              ) : uploads.length === 0 ? (
                <p className="text-sm text-gray-500">No uploads yet.</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {uploads.map((f) => (
                    <li key={f.name} className="py-2 flex items-center justify-between text-sm">
                      <span className="text-gray-800 break-all">{f.name}</span>
                      <span className="text-gray-500">{f?.metadata?.mimetype || f.id || ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
