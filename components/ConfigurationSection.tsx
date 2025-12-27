import { FilingStatus, TaxState } from '@/lib/types';

interface Props {
  filingStatus: FilingStatus;
  selectedState: TaxState;
  onFilingStatusChange: (status: FilingStatus) => void;
  onStateChange: (state: TaxState) => void;
}

const filingStatusOptions: { value: FilingStatus; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'marriedFilingJointly', label: 'Married Filing Jointly' },
  { value: 'marriedFilingSeparately', label: 'Married Filing Separately' },
];

const stateOptions: { value: TaxState; label: string }[] = [
  { value: 'california', label: 'California' },
  { value: 'washington', label: 'Washington' },
];

export default function ConfigurationSection({
  filingStatus,
  selectedState,
  onFilingStatusChange,
  onStateChange,
}: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Filing Status
          </label>
          <select
            value={filingStatus}
            onChange={(e) => onFilingStatusChange(e.target.value as FilingStatus)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {filingStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            State
          </label>
          <select
            value={selectedState}
            onChange={(e) => onStateChange(e.target.value as TaxState)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {stateOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
