'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/layout/Navbar';
import { supabase } from '@/utils/supabaseClient';
import ResultCard from '@/components/ResultCard';

export default function ResultDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [semester, setSemester] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setError('');
      setLoading(true);
      try {
        const semesterId = Array.isArray(params?.id) ? params.id[0] : params?.id;
        if (!semesterId) return;

        // Fetch semester row (RLS ensures it belongs to current user)
        const { data: sem, error: semErr } = await supabase
          .from('semesters')
          .select('id, semester_number, gpa, credits_earned, student_id')
          .eq('id', Number(semesterId))
          .maybeSingle();
        if (semErr) throw semErr;
        if (!sem) throw new Error('Semester not found');

        setSemester(sem);

        // Fetch subjects for this semester
        const { data: subs, error: subErr } = await supabase
          .from('subjects')
          .select('id, subject_code, subject_name, grade')
          .eq('semester_id', sem.id)
          .order('id', { ascending: true });
        if (subErr) throw subErr;

        setSubjects(subs || []);
      } catch (e) {
        console.error(e);
        setError(e.message || 'Failed to load results');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params?.id]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="py-10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <button
              onClick={() => router.back()}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ← Back
            </button>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
              </div>
            ) : error ? (
              <div className="rounded-md bg-red-50 p-4 text-red-700 text-sm">{error}</div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white shadow rounded-lg p-6">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Semester {semester?.semester_number}
                  </h1>
                  <p className="text-sm text-gray-600">GPA: {semester?.gpa} | Credits: {semester?.credits_earned}</p>
                </div>

                <ResultCard
                  title={`Semester ${semester?.semester_number} - Subjects`}
                  items={subjects?.map(s => ({
                    subject_code: s.subject_code,
                    subject_name: s.subject_name,
                    grade: s.grade,
                  }))}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
