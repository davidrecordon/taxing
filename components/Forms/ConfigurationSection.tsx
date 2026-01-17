import { FilingStatus, TaxState } from "@/lib/types";

interface Props {
  filingStatus: FilingStatus;
  selectedState: TaxState;
  isNYCResident?: boolean;
  onFilingStatusChange: (status: FilingStatus) => void;
  onStateChange: (state: TaxState) => void;
  onNYCResidentChange?: (isNYC: boolean) => void;
  onCompareFilingStatus?: () => void;
  onStateHover?: (state: TaxState) => void;
}

const filingStatusOptions: { value: FilingStatus; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "marriedFilingJointly", label: "Married Filing Jointly" },
  { value: "marriedFilingSeparately", label: "Married Filing Separately" },
];

const stateOptions: { value: TaxState; label: string }[] = [
  { value: "california", label: "California" },
  { value: "colorado", label: "Colorado" },
  { value: "dc", label: "District of Columbia" },
  { value: "florida", label: "Florida" },
  { value: "illinois", label: "Illinois" },
  { value: "newyork", label: "New York" },
  { value: "washington", label: "Washington" },
];

export default function ConfigurationSection({
  filingStatus,
  selectedState,
  isNYCResident,
  onFilingStatusChange,
  onStateChange,
  onNYCResidentChange,
  onCompareFilingStatus,
  onStateHover,
}: Props) {
  // Preload all state data when user focuses on state dropdown
  const handleStateFocus = () => {
    if (onStateHover) {
      stateOptions.forEach((option) => onStateHover(option.value));
    }
  };
  const showCompareButton =
    (filingStatus === "marriedFilingJointly" ||
      filingStatus === "marriedFilingSeparately") &&
    onCompareFilingStatus;
  return (
    <div className="theme-card p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Filing Status
          </label>
          <select
            value={filingStatus}
            onChange={(e) =>
              onFilingStatusChange(e.target.value as FilingStatus)
            }
            className="theme-input w-full px-3 py-2"
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
              className="mt-2 text-sm text-accent hover:text-accent-hover hover:underline transition-colors"
            >
              Compare MFJ vs MFS
            </button>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            State
          </label>
          <select
            value={selectedState}
            onChange={(e) => onStateChange(e.target.value as TaxState)}
            onFocus={handleStateFocus}
            className="theme-input w-full px-3 py-2"
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
      {selectedState === "newyork" && onNYCResidentChange && (
        <div className="mt-4 pt-4 border-t border-border">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isNYCResident ?? false}
              onChange={(e) => onNYCResidentChange(e.target.checked)}
              className="w-4 h-4 accent-accent border-border rounded focus:ring-accent"
            />
            <span className="text-sm font-medium text-text-primary">
              NYC Resident
            </span>
            <span className="text-xs text-text-muted">
              (adds NYC local income tax)
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
