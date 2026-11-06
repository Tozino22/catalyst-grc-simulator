'use client';

export function PrintButton() {
  return (
    <button className="btn btn-primary btn-sm no-print" type="button" onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}
