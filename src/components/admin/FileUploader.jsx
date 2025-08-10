'use client';

import { useState } from 'react';
import { supabase } from '@/utils/supabaseClient';

export default function FileUploader() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | uploading | success | error
  const [message, setMessage] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] ?? null);
    setMessage('');
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setMessage('Please select a file first.');
      return;
    }

    setStatus('uploading');
    setMessage('');

    try {
      // Generate a unique path, you can also prefix with user id if needed
      const filePath = `${Date.now()}-${file.name}`;

      const { error } = await supabase.storage
        .from('result-uploads')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      setStatus('success');
      setMessage('Upload successful. Parsing will be triggered via Edge Function.');
      setFile(null);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage(err.message || 'Upload failed');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Upload Result File</h2>
      <form onSubmit={handleUpload} className="space-y-4">
        <input
          type="file"
          accept=".csv,.xlsx,.xls,.json,.txt,.pdf"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        <button
          type="submit"
          disabled={status === 'uploading'}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {status === 'uploading' ? 'Uploading...' : 'Upload'}
        </button>
      </form>
      {message && (
        <p className={`mt-3 text-sm ${status === 'error' ? 'text-red-600' : 'text-green-700'}`}>{message}</p>
      )}
      <p className="mt-2 text-xs text-gray-500">Accepted: CSV, Excel, JSON, TXT, PDF</p>
    </div>
  );
}
