import { useMemoFirebase } from '@/firebase';
import { Pledge, Payment, InterestTier, Scheme } from './types';

export interface InterestBreakdownItem {
  monthIndex: number;
  rate: number;
  principal: number;
  interestAccrued: number;
}

/**
 * Helper to calculate calendar months passed since the start date.
 * E.g., Oct 8 to Nov 8 is 1 month. Nov 9 enters Month 2, so 2 months passed.
 */
function calculateCalendarMonthsPassed(startDate: Date, evaluationDate: Date): number {
  if (evaluationDate <= startDate) return 0;
  
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth();
  const startDay = startDate.getDate();
  
  const evalYear = evaluationDate.getFullYear();
  const evalMonth = evaluationDate.getMonth();
  const evalDay = evaluationDate.getDate();
  
  let months = (evalYear - startYear) * 12 + (evalMonth - startMonth);
  
  if (evalDay > startDay) {
    months += 1;
  }
  
  return Math.max(0, months);
}

/**
 * Helper to add calendar months to a date, handling varying month lengths safely.
 */
function addCalendarMonths(date: Date, months: number): Date {
  const newDate = new Date(date);
  const targetDay = date.getDate();
  newDate.setDate(1);
  newDate.setMonth(newDate.getMonth() + months);
  
  const targetMonth = newDate.getMonth();
  newDate.setDate(targetDay);
  
  // If we rolled over to the next month due to shorter month length (e.g. Feb 31 -> March 3),
  // set the date to the last day of the target month.
  if (newDate.getMonth() !== targetMonth) {
    newDate.setDate(0);
  }
  newDate.setHours(0, 0, 0, 0);
  return newDate;
}

/**
 * Helper to find the interest rate for a specific calendar month index (1-indexed).

export function getInterestRateForMonth(pledge: Pledge, monthIndex: number): number {
  const fixedDuration = pledge.loanDuration || 0;
  const fixedRate = pledge.interestRate;

  if (monthIndex <= fixedDuration) {
    return fixedRate;
  }

  // If that period is crossed, look at next slots (tiers)
  const tiers = pledge.interestTiers;
  if (tiers && Array.isArray(tiers) && tiers.length > 0) {
    // Find the first tier that covers this month index and has a duration greater than the fixed duration
    // Sort tiers by duration ascending to make sure we find the smallest duration that satisfies
    const sortedTiers = [...tiers].sort((a, b) => a.duration - b.duration);
    const nextTier = sortedTiers.find(t => t.duration >= monthIndex);
    if (nextTier) {
      return nextTier.rate;
    }
  }

  // If we crossed all tiers or no tiers exist, take the overdue rate
  if (pledge.overdueInterestRate !== undefined && pledge.overdueInterestRate > 0) {
    return pledge.overdueInterestRate;
  }

  // Fallback to the fixed rate if no other rate applies
  return fixedRate;
} */export function getApplicableInterestRate(
  pledge: Pledge,
  scheme: Scheme | undefined,
  currentMonth: number
): number {

  // Base interest during loan period
  if (currentMonth <= (pledge.loanDuration ?? 0)) {
    return pledge.interestRate;
  }

  const tiers = [...(scheme?.interestTiers ?? [])]
    .sort((a, b) => a.duration - b.duration);

  if (tiers.length === 0) {
    return pledge.overdueInterestRate ?? pledge.interestRate;
  }

  // Find the first tier covering this month
  for (const tier of tiers) {
    if (currentMonth <= tier.duration) {
      return tier.rate;
    }
  }

  // If month exceeds all configured tiers,
  // continue using the LAST tier rate.
  return tiers[tiers.length - 1].rate;
}
/**
 * Calculates the simple interest due on a pledge, accounting for partial payments.
 */
export function calculateInterest(
  pledge: Pledge,
  scheme: Scheme | null | undefined = null,
  evaluationDate: Date = new Date(),
  payments: Payment[] = []
): { interestDue: number; monthsPassed: number; breakdown: InterestBreakdownItem[],rate:number } {
  if (!pledge.createdAt || pledge.status === 'CLOSED') {
    return { interestDue: 0, monthsPassed: 0, breakdown: [],rate:0 };
  }

  const startDate = new Date(pledge.createdAt);
  startDate.setHours(0, 0, 0, 0);
  
  const evaluation = new Date(evaluationDate);
  evaluation.setHours(0, 0, 0, 0);

  // Filter and sort partial payments
  const partialPayments = payments
    .filter(p => p.paymentType === 'Partial')
    .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());

  if (partialPayments.length > 0) {
    const lastPartial = partialPayments[partialPayments.length - 1];
    const lastPartialDate = new Date(lastPartial.paymentDate);
    lastPartialDate.setHours(0, 0, 0, 0);

    // Sum all interest payments made on or before the last partial payment date
    const interestPaidBeforeOrAtLastPartial = payments
      .filter(p => {
        if (p.paymentType !== 'Interest') return false;
        const pDate = new Date(p.paymentDate);
        pDate.setHours(0, 0, 0, 0);
        return pDate.getTime() <= lastPartialDate.getTime();
      })
      .reduce((sum, p) => sum + p.amount, 0);

    // Calculate months passed since the last partial payment date
    const monthsPassedSincePayment = calculateCalendarMonthsPassed(lastPartialDate, evaluation);

    // Current outstanding principal
    const outstandingPrincipal = pledge.loanAmount - pledge.paidAmount;

    // Interest accrued since the last partial payment (no advance month deduction)
    let interestAccruedSincePayment = 0;
    const totalMonthsPassed = calculateCalendarMonthsPassed(startDate, evaluation);
    const startMonthIndex = Math.max(1, totalMonthsPassed - monthsPassedSincePayment + 1);
    const breakdown: InterestBreakdownItem[] = [];

   const currentRate = getApplicableInterestRate(pledge, scheme|| null || undefined,totalMonthsPassed);

for (let m = startMonthIndex; m <= totalMonthsPassed; m++) {

    const monthlyInterest =
        outstandingPrincipal * (currentRate / 100);

    interestAccruedSincePayment += monthlyInterest;

    breakdown.push({
        monthIndex: m,
        rate: currentRate,
        principal: outstandingPrincipal,
        interestAccrued: monthlyInterest
    });
}
    // Total interest accrued over the life of the pledge
    const totalInterest = interestPaidBeforeOrAtLastPartial + interestAccruedSincePayment;

    return { 
      interestDue: Math.max(0, totalInterest), 
      monthsPassed: monthsPassedSincePayment,
      breakdown,
      rate: currentRate
    };
  }

  // Fallback to original calculation when there are no partial payments
  const monthsPassed = calculateCalendarMonthsPassed(startDate, evaluation);
  const billableMonths = Math.max(0, monthsPassed - 1);
  
  if (billableMonths === 0) {
    return { interestDue: 0, monthsPassed, breakdown: [],rate:0 };
  }

  const outstandingPrincipal = pledge.loanAmount - pledge.paidAmount;
  let totalInterest = 0;
  const breakdown: InterestBreakdownItem[] = [];
  const currentRate = getApplicableInterestRate(pledge, scheme|| null || undefined, monthsPassed);

for (let m = 2; m <= monthsPassed; m++) {

    const monthlyInterest =
        outstandingPrincipal * (currentRate / 100);

    totalInterest += monthlyInterest;

    breakdown.push({
        monthIndex: m,
        rate: currentRate,
        principal: outstandingPrincipal,
        interestAccrued: monthlyInterest
    });
}
  return { 
    interestDue: Math.max(0, totalInterest), 
    monthsPassed,
    breakdown,
    rate: currentRate
  };
}
