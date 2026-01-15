import dynamic from 'next/dynamic';
import { ComponentType, memo } from 'react';
import { CalculationResults, TaxState, TaxCalculationResult } from '@/lib/types';
import FederalBreakdown from './FederalBreakdown';

interface StateBreakdownProps {
  result: TaxCalculationResult;
}

// Dynamic imports for state breakdown components - only loaded when needed
const stateBreakdownComponents: Record<TaxState, ComponentType<StateBreakdownProps>> = {
  california: dynamic(() => import('../States/CaliforniaBreakdown')),
  colorado: dynamic(() => import('../States/ColoradoBreakdown')),
  dc: dynamic(() => import('../States/DCBreakdown')),
  florida: dynamic(() => import('../States/FloridaBreakdown')),
  illinois: dynamic(() => import('../States/IllinoisBreakdown')),
  newyork: dynamic(() => import('../States/NewYorkBreakdown')),
  washington: dynamic(() => import('../States/WashingtonBreakdown')),
};

interface Props {
  results: CalculationResults;
}

export default memo(function TaxResultsDisplay({ results }: Props) {
  const StateBreakdown = stateBreakdownComponents[results.selectedState];

  return (
    <div className="space-y-6">
      <FederalBreakdown result={results.federal} />
      <StateBreakdown result={results.state} />
    </div>
  );
})
