import type { TripCoreState } from './tripCoreSlice';
import type { TripPlacementState } from './tripPlacementSlice';
import type { TripDayState } from './tripDaySlice';
import type { TripDreamBoardState } from './tripDreamBoardSlice';
import type { TripHistoryState } from './tripHistorySlice';

export type TripState = TripCoreState & TripPlacementState & TripDayState & TripDreamBoardState & TripHistoryState;
