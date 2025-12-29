import { CalculationResults } from '@/lib/types';
import FederalBreakdown from './FederalBreakdown';
import CaliforniaBreakdown from '../States/CaliforniaBreakdown';
import ColoradoBreakdown from '../States/ColoradoBreakdown';
import DCBreakdown from '../States/DCBreakdown';
import FloridaBreakdown from '../States/FloridaBreakdown';
import IllinoisBreakdown from '../States/IllinoisBreakdown';
import NewYorkBreakdown from '../States/NewYorkBreakdown';
import WashingtonBreakdown from '../States/WashingtonBreakdown';

interface Props {
  results: CalculationResults;
}

export default function TaxResultsDisplay({ results }: Props) {
  return (
    <div className="space-y-6">
      <FederalBreakdown result={results.federal} />

      {results.selectedState === 'california' && (
        <CaliforniaBreakdown result={results.state} />
      )}
      {results.selectedState === 'colorado' && (
        <ColoradoBreakdown result={results.state} />
      )}
      {results.selectedState === 'dc' && (
        <DCBreakdown result={results.state} />
      )}
      {results.selectedState === 'florida' && (
        <FloridaBreakdown result={results.state} />
      )}
      {results.selectedState === 'illinois' && (
        <IllinoisBreakdown result={results.state} />
      )}
      {results.selectedState === 'newyork' && (
        <NewYorkBreakdown result={results.state} />
      )}
      {results.selectedState === 'washington' && (
        <WashingtonBreakdown result={results.state} />
      )}
    </div>
  );
}
