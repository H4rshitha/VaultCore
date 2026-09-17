import React from 'react';

export const Table = ({ children, className = '', containerClassName = '', ...props }) => {
  return (
    <div className={`w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0D1322] shadow-sm dark:shadow-md ${containerClassName}`}>
      <table className={`w-full text-left text-sm text-slate-800 dark:text-slate-200 divide-y divide-slate-200 dark:divide-slate-800/80 ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
};

export const TableHeader = ({ children, className = '', ...props }) => {
  return (
    <thead className={`bg-slate-50 dark:bg-slate-900/60 uppercase text-[11px] font-semibold text-slate-500 dark:text-slate-400 tracking-wider ${className}`} {...props}>
      {children}
    </thead>
  );
};

export const TableBody = ({ children, className = '', ...props }) => {
  return (
    <tbody className={`divide-y divide-slate-200 dark:divide-slate-800/60 ${className}`} {...props}>
      {children}
    </tbody>
  );
};

export const TableRow = ({ children, className = '', hoverable = true, ...props }) => {
  return (
    <tr
      className={`transition-colors ${
        hoverable ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
};

export const TableHead = ({ children, className = '', ...props }) => {
  return (
    <th className={`px-4 sm:px-6 py-3.5 text-left font-semibold ${className}`} {...props}>
      {children}
    </th>
  );
};

export const TableCell = ({ children, className = '', ...props }) => {
  return (
    <td className={`px-4 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm ${className}`} {...props}>
      {children}
    </td>
  );
};
