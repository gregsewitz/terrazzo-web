import type { TripCoreState } from './tripCoreSlice';
import type { TripPlacementState } from './tripPlacementSlice';
import type { TripDayState } from './tripDaySlice';
import type { TripDreamBoardState } from './tripDreamBoardSlice';

export type TripState = TripCoreState & TripPlacementState & TripDayState & TripDreamBoardState;
