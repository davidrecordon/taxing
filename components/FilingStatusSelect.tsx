import { FilingStatus } from '@/lib/types';

interface Props {
  value: FilingStatus;
  onChange: (status: FilingStatus) => void;
}

const filingStatusOptions: { value: FilingStatus; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'marriedFilingJointly', label: 'Married Filing Jointly' },
  { value: 'marriedFilingSeparately', label: 'Married Filing Separately' },
];

export default function FilingStatusSelect({ value, onChange }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <label className="block text-sm font-medium text-gray-900 mb-2">
        Filing Status
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as FilingStatus)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {filingStatusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
