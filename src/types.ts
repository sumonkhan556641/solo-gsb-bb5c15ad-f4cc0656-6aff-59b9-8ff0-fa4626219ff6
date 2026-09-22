export interface StageForm {
  driverMin: string
  driverMax: string
  drivenMin: string
  drivenMax: string
  lockedDriver: string
  lockedDriven: string
}

export interface StationState {
  target: string
  stageCount: number
  stages: StageForm[]
  minToothDiff: string
  maxErrorEnabled: boolean
  maxError: string
}

export const DEFAULT_STATE: StationState = {
  target: '8',
  stageCount: 2,
  stages: [
    {
      driverMin: '17',
      driverMax: '60',
      drivenMin: '17',
      drivenMax: '120',
      lockedDriver: '',
      lockedDriven: ''
    },
    {
      driverMin: '17',
      driverMax: '60',
      drivenMin: '17',
      drivenMax: '120',
      lockedDriver: '',
      lockedDriven: ''
    },
    {
      driverMin: '17',
      driverMax: '60',
      drivenMin: '17',
      drivenMax: '120',
      lockedDriver: '',
      lockedDriven: ''
    }
  ],
  minToothDiff: '3',
  maxErrorEnabled: true,
  maxError: '1'
}

export function emptyStage(): StageForm {
  return {
    driverMin: '17',
    driverMax: '60',
    drivenMin: '17',
    drivenMax: '120',
    lockedDriver: '',
    lockedDriven: ''
  }
}
