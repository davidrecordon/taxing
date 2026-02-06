import dynamic from "next/dynamic";
import { ComponentType, memo } from "react";
import {
  CalculationResults,
  TaxState,
  TaxCalculationResult,
} from "@/lib/types";
import { TaxYear } from "@/lib/config";
import FederalBreakdown from "./FederalBreakdown";

interface StateBreakdownProps {
  result: TaxCalculationResult;
  taxYear: TaxYear;
}

// Dynamic imports for state breakdown components - only loaded when needed
const stateBreakdownComponents: Record<
  TaxState,
  ComponentType<StateBreakdownProps>
> = {
  california: dynamic(() => import("../States/CaliforniaBreakdown")),
  colorado: dynamic(() => import("../States/ColoradoBreakdown")),
  dc: dynamic(() => import("../States/DCBreakdown")),
  florida: dynamic(() => import("../States/FloridaBreakdown")),
  illinois: dynamic(() => import("../States/IllinoisBreakdown")),
  newyork: dynamic(() => import("../States/NewYorkBreakdown")),
  washington: dynamic(() => import("../States/WashingtonBreakdown")),
};

interface Props {
  results: CalculationResults;
  taxYear: TaxYear;
}

export default memo(function TaxResultsDisplay({ results, taxYear }: Props) {
  const StateBreakdown = stateBreakdownComponents[results.selectedState];

  return (
    <div className="space-y-6">
      <FederalBreakdown result={results.federal} taxYear={taxYear} />
      <StateBreakdown result={results.state} taxYear={taxYear} />
    </div>
  );
});
