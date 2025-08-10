'use client';

import { useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function ResultCard({ title = 'Semester Result', items = [] }) {
  const cardRef = useRef(null);

  const downloadPdf = async () => {
    const node = cardRef.current;
    if (!node) return;
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let position = 0;
    if (imgHeight > pageHeight) {
      let heightLeft = imgHeight;
      while (heightLeft > 0) {
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        if (heightLeft > 0) {
          pdf.addPage();
          position = 0;
        }
      }
    } else {
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    }

    pdf.save(`${title.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="bg-white shadow rounded-lg p-6" ref={cardRef}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <button
          onClick={downloadPdf}
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          Download PDF
        </button>
      </div>
      <div className="divide-y divide-gray-200">
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">No subjects found.</p>
        ) : (
          items.map((it, idx) => (
            <div key={idx} className="py-2 flex justify-between text-sm">
              <span className="font-medium text-gray-700">{it.subject_code} — {it.subject_name}</span>
              <span className="text-gray-900">{it.grade}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
