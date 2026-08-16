import { DBotStrategy } from '../types/deriv';

export const ADDITIONAL_BOT_STRATEGIES: DBotStrategy[] = [
  {
    id: 'bot_sdiffer_quad_pattern',
    name: 'S-Differ Quad Pattern Bot (XYXX & XXYX)',
    description: 'DIGITDIFF 1-tick strategy. Trades when the latest four digits form XYXX or XXYX, with Y different from X. The recurring final digit X is used as the DIGITDIFF prediction/barrier.',
    symbol: 'R_100', category: 'DIGITS', contractType: 'DIGITDIFF',
    initialStake: 10, durationTicks: 1, martingaleFactor: 11.5,
    takeProfit: 50, stopLoss: 100, maxLossStreak: 2,
    rules: { indicatorTrigger: 'S_DIFFER_QUAD_PATTERN', paramValue: 0 },
    totalRuns: 0, wins: 0, losses: 0, totalProfit: 0,
  },
  {
    id: 'bot_alternating_digit_diff',
    name: 'Alternating Digit Difference Bot',
    description: 'DIGITDIFF 1-tick strategy that arms when the last two digits differ, with a 5-second interval guard between entries.',
    symbol: 'R_100', category: 'DIGITS', contractType: 'DIGITDIFF',
    initialStake: 10, durationTicks: 1, martingaleFactor: 11.5,
    takeProfit: 50, stopLoss: 100, maxLossStreak: 2,
    rules: { indicatorTrigger: 'ALTERNATING_DIGIT_DIFF', paramValue: 5 },
    totalRuns: 0, wins: 0, losses: 0, totalProfit: 0,
  },
];
