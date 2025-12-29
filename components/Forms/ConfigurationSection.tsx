import { FilingStatus, TaxState } from '@/lib/types';

interface Props {
  filingStatus: FilingStatus;
  selectedState: TaxState;
  isNYCResident?: boolean;
  onFilingStatusChange: (status: FilingStatus) => void;
  onStateChange: (state: TaxState) => void;
  onNYCResidentChange?: (isNYC: boolean) => void;
  onCompareFilingStatus?: () => void;
}

const filingStatusOptions: { value: FilingStatus; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'marriedFilingJointly', label: 'Married Filing Jointly' },
  { value: 'marriedFilingSeparately', label: 'Married Filing Separately' },
];

const stateOptions: { value: TaxState; label: string }[] = [
  { value: 'california', label: 'California' },
  { value: 'colorado', label: 'Colorado' },
  { value: 'dc', label: 'District of Columbia' },
  { value: 'florida', label: 'Florida' },
  { value: 'illinois', label: 'Illinois' },
  { value: 'newyork', label: 'New York' },
  { value: 'washington', label: 'Washington' },
];

export default function ConfigurationSection({
  filingStatus,
  selectedState,
  isNYCResident,
  onFilingStatusChange,
  onStateChange,
  onNYCResidentChange,
  onCompareFilingStatus,
}: Props) {
  const showCompareButton =
    (filingStatus === 'marriedFilingJointly' || filingStatus === 'marriedFilingSeparately') &&
    onCompareFilingStatus;
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
          {showCompareButton && (
            <button
              onClick={onCompareFilingStatus}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              Compare MFJ vs MFS
            </button>
          )}
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

      {/* NYC Resident Checkbox - only shown when NY is selected */}
      {selectedState === 'newyork' && onNYCResidentChange && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isNYCResident ?? false}
              onChange={(e) => onNYCResidentChange(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-900">
              NYC Resident
            </span>
            <span className="text-xs text-gray-500">
              (adds NYC local income tax)
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
