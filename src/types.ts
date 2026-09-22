export interface StageForm {
  id: number;
  driverMin: string;
  driverMax: string;
  drivenMin: string;
  drivenMax: string;
  lockDriver: boolean;
  lockDriven: boolean;
}

export const MIN_TEETH = 8;
export const MAX_TEETH = 240;
/** 单边范围跨度上限，防止误输入导致枚举空间爆炸 */
export const MAX_SPAN = 120;

export const DEFAULT_TARGET = '6';
export const DEFAULT_MIN_DIFF = '4';

let nextStageId = 1;
export function makeStage(partial?: Partial<StageForm>): StageForm {
  return {
    id: nextStageId++,
    driverMin: '15',
    driverMax: '35',
    drivenMin: '35',
    drivenMax: '70',
    lockDriver: false,
    lockDriven: false,
    ...partial,
  };
}

export function makeDefaultStages(): StageForm[] {
  return [makeStage(), makeStage()];
}
