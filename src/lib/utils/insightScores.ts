import type { OilinessLevel, SeverityLevel } from '../../types/database';

export { SCALP_CONDITION_OPTIONS, SHEDDING_OPTIONS, getOptionLabel } from './constants';

export const DANDRUFF_SCORE_MAP: Record<SeverityLevel, number> = {
  none: 0,
  mild: 1,
  moderate: 2,
  severe: 3,
};

export const OILINESS_SCORE_MAP: Record<OilinessLevel, number> = {
  dry: 1,
  normal: 2,
  oily: 3,
  very_oily: 4,
};
