// Supabase Edge Function: parse-results
// Trigger: Storage webhook on bucket `result-uploads`
// Parses CSV uploads and inserts rows into students, semesters, and subjects tables.
// Expected CSV columns:
// roll_no,name,course,semester_number,gpa,credits_earned,subject_code,subject_name,grade

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { parse } from "https://deno.land/std@0.177.0/csv/parse.ts";
import * as XLSX from "https://esm.sh/xlsx@0.18.5?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type StorageRecord = {
  bucket_id: string;
  name: string;
  size?: number;
  mime_type?: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

const admin = createClient(SUPABASE_URL!, SERVICE_ROLE!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const payload = await req.json();
    const record: StorageRecord | undefined = payload?.record;
    if (!record || record.bucket_id !== 'result-uploads') {
      return json({ ok: false, error: 'Invalid payload or bucket' }, 400);
    }

    // 1) Download file from storage
    const { data: fileData, error: dlErr } = await admin.storage
      .from('result-uploads')
      .download(record.name);
    if (dlErr || !fileData) throw dlErr ?? new Error('Download failed');

    // 2) Parse file
    const lower = record.name.toLowerCase();
    let rows: any[] = [];
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      const ab = await fileData.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(ab), { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];
    } else if (lower.endsWith('.csv')) {
      const text = await fileData.text();
      const parsed = await parse(text, { skipFirstRow: false, columns: true });
      if (!Array.isArray(parsed)) throw new Error('CSV parse failed');
      rows = parsed as any[];
    } else {
      // Try Excel by default if unknown extension
      const ab = await fileData.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(ab), { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];
    }

    // 3) Process rows
    // Cache map: roll_no -> student_id, to reduce DB hits
    const studentIdByRoll = new Map<string, string>();

    for (const raw of rows as any[]) {
      const roll_no = String(raw.roll_no ?? '').trim();
      const name = String(raw.name ?? '').trim();
      const course = String(raw.course ?? '').trim();
      const semester_number = Number(raw.semester_number ?? 0);
      const gpa = Number(raw.gpa ?? 0);
      const credits_earned = Number(raw.credits_earned ?? 0);
      const subject_code = String(raw.subject_code ?? '').trim();
      const subject_name = String(raw.subject_name ?? '').trim();
      const grade = String(raw.grade ?? '').trim();

      if (!roll_no || !name || !course || !semester_number || !subject_code || !subject_name || !grade) {
        console.warn('Skipping invalid row:', raw);
        continue;
      }

      // 3a) Upsert student by roll_no (no user_id link in migration; optional to backfill later)
      let student_id = studentIdByRoll.get(roll_no);
      if (!student_id) {
        const { data: sRow, error: sErr } = await upsertStudent({ roll_no, name, course });
        if (sErr) throw sErr;
        student_id = sRow.id;
        studentIdByRoll.set(roll_no, student_id);
      }

      // 3b) Upsert semester by (student_id, semester_number)
      const { data: semRow, error: semErr } = await upsertSemester({ student_id, semester_number, gpa, credits_earned });
      if (semErr) throw semErr;

      // 3c) Insert subject row
      const { error: subErr } = await admin
        .from('subjects')
        .insert({
          semester_id: semRow.id,
          subject_code,
          subject_name,
          grade,
        });
      if (subErr) throw subErr;
    }

    return json({ ok: true, inserted: true });
  } catch (e) {
    console.error('parse-results error:', e);
    return json({ ok: false, error: String(e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

async function upsertStudent(
  input: { roll_no: string; name: string; course: string }
): Promise<{ data: { id: string }; error: any }> {
  // Try find by roll_no
  const { data: existing, error: selErr } = await admin
    .from('students')
    .select('id')
    .eq('roll_no', input.roll_no)
    .maybeSingle();
  if (selErr) return { data: undefined as any, error: selErr };
  if (existing?.id) return { data: { id: existing.id }, error: null };

  // Insert new
  const { data, error } = await admin
    .from('students')
    .insert({ roll_no: input.roll_no, name: input.name, course: input.course })
    .select('id')
    .single();
  return { data: data as any, error };
}

async function upsertSemester(
  input: { student_id: string; semester_number: number; gpa: number; credits_earned: number }
): Promise<{ data: { id: number }; error: any }> {
  // Try find existing semester
  const { data: existing, error: selErr } = await admin
    .from('semesters')
    .select('id')
    .eq('student_id', input.student_id)
    .eq('semester_number', input.semester_number)
    .maybeSingle();
  if (selErr) return { data: undefined as any, error: selErr };
  if (existing?.id) return { data: { id: existing.id }, error: null };

  // Insert
  const { data, error } = await admin
    .from('semesters')
    .insert({
      student_id: input.student_id,
      semester_number: input.semester_number,
      gpa: input.gpa,
      credits_earned: input.credits_earned,
    })
    .select('id')
    .single();
  return { data: data as any, error };
}
