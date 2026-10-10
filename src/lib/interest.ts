import { Pledge, Payment, InterestTier, Scheme } from './types';

export interface InterestBreakdownItem {
  monthIndex: number;
  rate: number;
  principal: number;
  interestAccrued: number;
}

/**
 * Helper to calculate calendar months passed.
 * Any extra days beyond completed calendar months round UP to enter the next month.
 * E.g.,
 *   Aug 14 to Sep 14 = 1 month
 *   Aug 14 to Sep 15 = 2 months (enters 2nd month)
 */
function calculateCalendarMonthsPassed(startDate: Date, evaluationDate: Date): number {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const evalDate = new Date(evaluationDate);
  evalDate.setHours(0, 0, 0, 0);

  if (evalDate.getTime() <= start.getTime()) return 0;

  let fullMonths = (evalDate.getFullYear() - start.getFullYear()) * 12 + (evalDate.getMonth() - start.getMonth());

  if (evalDate.getDate() < start.getDate()) {
    fullMonths -= 1;
  }

  const completedBoundaryDate = addCalendarMonths(start, Math.max(0, fullMonths));

  if (evalDate > completedBoundaryDate) {
    return fullMonths + 1;
  }

  return Math.max(1, fullMonths);
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

  if (newDate.getMonth() !== targetMonth) {
    newDate.setDate(0);
  }
  newDate.setHours(0, 0, 0, 0);
  return newDate;
}

export function getApplicableInterestRate(
  pledge: Pledge,
  scheme: Scheme | undefined,
  currentMonth: number
): number {
  if (currentMonth <= (pledge.loanDuration ?? 0)) {
    return pledge.interestRate;
  }

  const tiers = [...(scheme?.interestTiers ?? [])].sort((a, b) => a.duration - b.duration);

  if (tiers.length === 0) {
    return pledge.overdueInterestRate ?? pledge.interestRate;
  }

  for (const tier of tiers) {
    if (currentMonth <= tier.duration) {
      return tier.rate;
    }
  }

  return tiers[tiers.length - 1].rate;
}

/**
 * Calculates simple interest due on a pledge, accounting for partial payments.
 */
export function calculateInterest(
  pledge: Pledge,
  scheme: Scheme | null | undefined,
  evaluationDate: Date = new Date(),
  payments: Payment[] = []
): { interestDue: number; monthsPassed: number; breakdown: InterestBreakdownItem[]; rate: number } {
  if (!pledge.createdAt || pledge.status === 'CLOSED') {
    return { interestDue: 0, monthsPassed: 0, breakdown: [], rate: 0 };
  }

  const startDate = new Date(pledge.createdAt);
  startDate.setHours(0, 0, 0, 0);

  const evaluation = new Date(evaluationDate);
  evaluation.setHours(0, 0, 0, 0);

  const partialPayments = payments
    .filter(p => p.paymentType === 'Partial')
    .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());

  if (partialPayments.length > 0) {
    const lastPartial = partialPayments[partialPayments.length - 1];
    const lastPartialDate = new Date(lastPartial.paymentDate);
    lastPartialDate.setHours(0, 0, 0, 0);

    const interestPaidBeforeOrAtLastPartial = payments
      .filter(p => {
        if (p.paymentType !== 'Interest') return false;
        const pDate = new Date(p.paymentDate);
        pDate.setHours(0, 0, 0, 0);
        return pDate.getTime() <= lastPartialDate.getTime();
      })
      .reduce((sum, p) => sum + p.amount, 0);

    const monthsPassedSincePayment = calculateCalendarMonthsPassed(lastPartialDate, evaluation);
    const outstandingPrincipal = pledge.loanAmount - pledge.paidAmount;

    let interestAccruedSincePayment = 0;
    const totalMonthsPassed = calculateCalendarMonthsPassed(startDate, evaluation);
    const startMonthIndex = Math.max(1, totalMonthsPassed - monthsPassedSincePayment + 1);
    const breakdown: InterestBreakdownItem[] = [];

    const currentRate = getApplicableInterestRate(pledge, scheme || undefined, Math.max(1, totalMonthsPassed));

    for (let m = startMonthIndex; m <= totalMonthsPassed; m++) {
      const monthRate = getApplicableInterestRate(pledge, scheme || undefined, m);
      const monthlyInterest = outstandingPrincipal * (monthRate / 100);

      interestAccruedSincePayment += monthlyInterest;

      breakdown.push({
        monthIndex: m,
        rate: monthRate,
        principal: outstandingPrincipal,
        interestAccrued: monthlyInterest
      });
    }

    const totalInterest = interestPaidBeforeOrAtLastPartial + interestAccruedSincePayment;

    return {
      interestDue: Math.max(0, totalInterest),
      monthsPassed: totalMonthsPassed,
      breakdown,
      rate: currentRate
    };
  }

  // Fallback calculation without partial payments
  const monthsPassed = calculateCalendarMonthsPassed(startDate, evaluation);

  // Month 1 was paid in advance at creation. Billable months start from Month 2.
  const billableMonths = Math.max(0, monthsPassed - 1);

  const outstandingPrincipal = pledge.loanAmount - pledge.paidAmount;
  let totalInterest = 0;
  const breakdown: InterestBreakdownItem[] = [];
  const currentRate = getApplicableInterestRate(pledge, scheme || undefined, Math.max(1, monthsPassed));

  if (billableMonths === 0) {
    return { interestDue: 0, monthsPassed, breakdown: [], rate: currentRate };
  }

  for (let m = 2; m <= monthsPassed; m++) {
    const monthRate = getApplicableInterestRate(pledge, scheme || undefined, m);
    const monthlyInterest = outstandingPrincipal * (monthRate / 100);

    totalInterest += monthlyInterest;

    breakdown.push({
      monthIndex: m,
      rate: monthRate,
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