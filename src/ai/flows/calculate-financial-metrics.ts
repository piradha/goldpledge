
'use server';

/**
 * @fileOverview Flow for calculating estimated interest per month and total amount payable to date.
 *
 * - calculateFinancialMetrics - Calculates financial metrics based on input parameters.
 * - CalculateFinancialMetricsInput - The input type for the calculateFinancialMetrics function.
 * - CalculateFinancialMetricsOutput - The return type for the calculateFinancialMetrics function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CalculateFinancialMetricsInputSchema = z.object({
  itemValue: z.number().describe('Estimated value of the pledged item.'),
  weight: z.number().describe('Weight of the pledged item in grams.'),
  loanAmount: z.number().describe('The amount of the loan provided.'),
  interestRate: z.number().describe('Annual interest rate of the loan (e.g., 0.10 for 10%).'),
  loanDurationMonths: z.number().describe('Duration of the loan in months.'),
  paymentDate: z.string().describe('The date for which to calculate the total payable, in ISO format (YYYY-MM-DD).'),
});
export type CalculateFinancialMetricsInput = z.infer<typeof CalculateFinancialMetricsInputSchema>;

const CalculateFinancialMetricsOutputSchema = z.object({
  estimatedInterestPerMonth: z.number().describe('Estimated interest payable per month.'),
  totalPayableToDate: z.number().describe('Total amount payable, including principal and interest, up to the specified payment date.'),
});
export type CalculateFinancialMetricsOutput = z.infer<typeof CalculateFinancialMetricsOutputSchema>;

export async function calculateFinancialMetrics(
  input: CalculateFinancialMetricsInput
): Promise<CalculateFinancialMetricsOutput> {
  return calculateFinancialMetricsFlow(input);
}

const calculateFinancialMetricsPrompt = ai.definePrompt({
  name: 'calculateFinancialMetricsPrompt',
  input: {schema: CalculateFinancialMetricsInputSchema},
  output: {schema: CalculateFinancialMetricsOutputSchema},
  prompt: `You are a financial expert specializing in loan calculations. Based on the following loan details, calculate the estimated interest per month and the total amount payable to date.

Item Value: {{{itemValue}}}
Weight: {{{weight}}} grams
Loan Amount: {{{loanAmount}}}
Interest Rate (Annual): {{{interestRate}}}
Loan Duration: {{{loanDurationMonths}}} months
Payment Date: {{{paymentDate}}}

Ensure the calculations are accurate and provide the results in the specified JSON format.  Assume a simple interest calculation.

Estimated Interest Per Month: Calculate as (Loan Amount * Annual Interest Rate) / 12
Total Payable to Date: Calculate the number of months passed from the start of the loan to the payment date. This is NOT the loan duration. Let's say loan started on Jan 1 2024 and payment date is Mar 15 2024, the months passed is 2.5. Multiply months passed by the "Estimated Interest Per Month" and add it to the Loan Amount. For the calculation of months passed, assume a loan always starts 'now' when this function is called.`,
});

const calculateFinancialMetricsFlow = ai.defineFlow(
  {
    name: 'calculateFinancialMetricsFlow',
    inputSchema: CalculateFinancialMetricsInputSchema,
    outputSchema: CalculateFinancialMetricsOutputSchema,
    retries: 3,
  },
  async input => {
    const {output} = await calculateFinancialMetricsPrompt(input);
    return output!;
  }
);

    